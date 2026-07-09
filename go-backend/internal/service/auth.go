package service

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type AuthService struct {
	db *gorm.DB
}

func NewAuthService(db *gorm.DB) *AuthService {
	return &AuthService{db: db}
}

// AuthResponse represents the response sent after login/register/refresh
type AuthResponse struct {
	AccessToken     string           `json:"accessToken"`
	RefreshToken    string           `json:"refreshToken"`
	UserID          int              `json:"userId"`
	Name            string           `json:"name"`
	Email           string           `json:"email"`
	Roles           []string         `json:"roles"`
	OutletID        *int             `json:"outletId"`
	OutletName      *string          `json:"outletName"`
	CardPermissions *CardPermissions `json:"cardPermissions"`
	Permissions     []string         `json:"permissions"`
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// RegisterRequest represents the register request body
type RegisterRequest struct {
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Password string   `json:"password"`
	Phone    *string  `json:"phone"`
	Roles    []string `json:"roles"`
	OutletID *int     `json:"outletId"`
}

// RefreshTokenRequest represents the refresh token request body
type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// getUserWithRoles loads a user with their roles and outlet info
func (s *AuthService) getUserWithRoles(email string) (*models.User, error) {
	var user models.User
	err := s.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Where("email = ?", email).
		First(&user).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

// buildAuthResponse constructs the auth response DTO from a user
func (s *AuthService) buildAuthResponse(user *models.User, accessToken, refreshToken string) *AuthResponse {
	roles := make([]string, 0, len(user.UserRoles))
	isSuperAdmin := false
	for _, ur := range user.UserRoles {
		if ur.Role != nil {
			roles = append(roles, string(ur.Role.Name))
			if ur.Role.Name == models.RoleSuperAdmin {
				isSuperAdmin = true
			}
		}
	}

	outletName := ""
	if user.Outlet != nil {
		outletName = user.Outlet.Name
	}

	// SUPER_ADMIN gets nil card permissions (mobile treats nil as "show all").
	// All other users get role-level card permissions (empty list = show nothing).
	var cardPerms *CardPermissions
	if !isSuperAdmin {
		business := make([]string, 0)
		pccp := make([]string, 0)

		var customRoleName string
		for _, ur := range user.UserRoles {
			if ur.Role != nil && ur.Role.Name != models.RoleSuperAdmin && ur.Role.Name != models.RoleAdmin {
				customRoleName = string(ur.Role.Name)
				break
			}
		}

		if customRoleName != "" {
			var rolePerms []models.RoleCardPermission
			s.db.Where("role_name = ?", customRoleName).Find(&rolePerms)
			for _, p := range rolePerms {
				if p.CardType == "business" {
					business = append(business, p.CardKey)
				} else if p.CardType == "pccp" {
					pccp = append(pccp, p.CardKey)
				}
			}
		} else {
			var userPerms []models.UserCardPermission
			s.db.Where("user_id = ?", user.ID).Find(&userPerms)
			for _, p := range userPerms {
				if p.CardType == "business" {
					business = append(business, p.CardKey)
				} else if p.CardType == "pccp" {
					pccp = append(pccp, p.CardKey)
				}
			}
		}

		cardPerms = &CardPermissions{Business: business, Pccp: pccp}
	}

	// Build named permissions list.
	// Custom-role users receive their role's explicit permission keys.
	// Built-in role users receive a curated default set so the frontend can gate UI accordingly.
	permissions := make([]string, 0)
	if !isSuperAdmin {
		hasCustomRole := false
		for _, ur := range user.UserRoles {
			if ur.Role == nil {
				continue
			}
			var customRole models.CustomRole
			if err := s.db.Where("name = ? AND is_active = true", string(ur.Role.Name)).First(&customRole).Error; err == nil {
				hasCustomRole = true
				if customRole.Permissions != nil && *customRole.Permissions != "" {
					var perms []string
					if jsonErr := json.Unmarshal([]byte(*customRole.Permissions), &perms); jsonErr == nil {
						permissions = perms
					}
				}
				break
			}
		}
		if !hasCustomRole {
			seen := make(map[string]bool)
			for _, ur := range user.UserRoles {
				if ur.Role == nil {
					continue
				}
				switch ur.Role.Name {
				case models.RoleAdmin, models.RoleManager:
					if !seen["CONVERT_SO_TO_PO"] {
						permissions = append(permissions, "CONVERT_SO_TO_PO")
						seen["CONVERT_SO_TO_PO"] = true
					}
				}
			}
		}
	}

	return &AuthResponse{
		AccessToken:     accessToken,
		RefreshToken:    refreshToken,
		UserID:          user.ID,
		Name:            user.Name,
		Email:           user.Email,
		Roles:           roles,
		OutletID:        user.OutletID,
		OutletName:      &outletName,
		CardPermissions: cardPerms,
		Permissions:     permissions,
	}
}

// Login authenticates a user with email and password
func (s *AuthService) Login(req *LoginRequest) (*AuthResponse, error) {
	user, err := s.getUserWithRoles(req.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to get user with roles", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message:    "Invalid credentials",
		}
	}

	if user == nil || !user.Active {
		return nil, &util.ResourceNotFoundException{
			Message: "User not found",
		}
	}

	// Compare passwords
	if !util.ComparePassword(req.Password, user.Password) {
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message:    "Invalid credentials",
		}
	}

	// Update last login
	now := util.Now()
	if err := s.db.Model(user).Update("last_login", now).Error; err != nil {
		slog.Error("[AuthService] Failed to update last_login", "error", err)
		// Don't fail on this error
	}

	// Generate tokens
	accessToken, err := util.GenerateAccessToken(user.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to generate access token", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Failed to generate tokens",
		}
	}

	refreshToken, err := util.GenerateRefreshToken(user.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to generate refresh token", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Failed to generate tokens",
		}
	}

	return s.buildAuthResponse(user, accessToken, refreshToken), nil
}

// Register creates a new user
func (s *AuthService) Register(req *RegisterRequest) (*AuthResponse, error) {
	// Check if email already exists
	var existingUser models.User
	err := s.db.Where("email = ?", req.Email).First(&existingUser).Error
	if err == nil {
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message: fmt.Sprintf("Email already in use: %s", req.Email),
		}
	}
	if err != gorm.ErrRecordNotFound {
		slog.Error("[AuthService] Failed to check email uniqueness", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Internal server error",
		}
	}

	// Get role IDs
	var roleIDs []int
	if len(req.Roles) > 0 {
		var roles []models.Role
		if err := s.db.Where("name IN ?", req.Roles).Find(&roles).Error; err != nil {
			slog.Error("[AuthService] Failed to find roles", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 400,
				Message: "One or more roles not found",
			}
		}
		if len(roles) != len(req.Roles) {
			return nil, &util.BusinessException{
				StatusCode: 400,
				Message: "One or more roles not found",
			}
		}
		for _, role := range roles {
			roleIDs = append(roleIDs, role.ID)
		}
	} else {
		// Default role: CASHIER
		var cashierRole models.Role
		if err := s.db.Where("name = ?", models.RoleCashier).First(&cashierRole).Error; err != nil {
			slog.Error("[AuthService] Failed to find default role", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 400,
				Message: "Default role not found",
			}
		}
		roleIDs = append(roleIDs, cashierRole.ID)
	}

	// Hash password
	hashedPassword, err := util.HashPassword(req.Password)
	if err != nil {
		slog.Error("[AuthService] Failed to hash password", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Internal server error",
		}
	}

	// Create user
	user := &models.User{
		Name:      req.Name,
		Email:     req.Email,
		Password:  hashedPassword,
		Phone:     req.Phone,
		OutletID:  req.OutletID,
		Active:    true,
		MaxDiscountPercent: 10.0,
	}

	if err := s.db.Create(user).Error; err != nil {
		slog.Error("[AuthService] Failed to create user", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Failed to create user",
		}
	}

	// Create user roles
	for _, roleID := range roleIDs {
		userRole := &models.UserRole{
			UserID: user.ID,
			RoleID: roleID,
		}
		if err := s.db.Create(userRole).Error; err != nil {
			slog.Error("[AuthService] Failed to create user role", "error", err)
			// Continue anyway
		}
	}

	// Reload user with roles and outlet
	user, err = s.getUserWithRoles(req.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to reload user after creation", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Failed to load created user",
		}
	}

	// Generate tokens
	accessToken, err := util.GenerateAccessToken(user.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to generate access token", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Failed to generate tokens",
		}
	}

	refreshToken, err := util.GenerateRefreshToken(user.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to generate refresh token", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Failed to generate tokens",
		}
	}

	return s.buildAuthResponse(user, accessToken, refreshToken), nil
}

// RefreshToken validates and refreshes the token pair
func (s *AuthService) RefreshToken(token string) (*AuthResponse, error) {
	// Verify the refresh token
	claims, err := util.VerifyToken(token)
	if err != nil {
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message: "Invalid refresh token",
		}
	}

	// Load user
	user, err := s.getUserWithRoles(claims.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to get user with roles", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Internal server error",
		}
	}

	if user == nil {
		return nil, &util.ResourceNotFoundException{
			Message: "User not found",
		}
	}

	// Generate new tokens
	accessToken, err := util.GenerateAccessToken(user.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to generate access token", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Failed to generate tokens",
		}
	}

	newRefreshToken, err := util.GenerateRefreshToken(user.Email)
	if err != nil {
		slog.Error("[AuthService] Failed to generate refresh token", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message: "Failed to generate tokens",
		}
	}

	return s.buildAuthResponse(user, accessToken, newRefreshToken), nil
}
