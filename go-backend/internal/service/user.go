package service

import (
	"fmt"
	"log/slog"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// resolveRoleIDs looks up role IDs for the given role names.
// It checks the built-in `roles` table first; if a name isn't found there,
// it falls back to `custom_roles` and upserts a matching row into `roles`
// so the `user_roles` join table can reference it.
func (s *UserService) resolveRoleIDs(roleNames []string) ([]int, error) {
	if len(roleNames) == 0 {
		return nil, nil
	}
	var ids []int
	for _, name := range roleNames {
		var role models.Role
		err := s.db.Where("name = ?", name).First(&role).Error
		if err == nil {
			ids = append(ids, role.ID)
			continue
		}
		// Not a built-in role — check custom_roles
		var cr models.CustomRole
		if err2 := s.db.Where("name = ? AND is_active = ?", name, true).First(&cr).Error; err2 != nil {
			slog.Warn("[UserService] Role not found in built-in or custom roles", "name", name)
			continue
		}
		// Upsert into roles table so user_roles can reference it
		newRole := models.Role{Name: models.RoleName(cr.Name)}
		if err3 := s.db.Where("name = ?", cr.Name).FirstOrCreate(&newRole).Error; err3 != nil {
			slog.Error("[UserService] Failed to upsert custom role into roles", "name", cr.Name, "error", err3)
			continue
		}
		ids = append(ids, newRole.ID)
	}
	return ids, nil
}

// CardPermissions holds the card keys a user is allowed to see
type CardPermissions struct {
	Business []string `json:"business"`
	Pccp     []string `json:"pccp"`
	Reports  []string `json:"reports"`
}

// UserResponse represents a user with roles and outlet
type UserResponse struct {
	ID                 int              `json:"id"`
	Name               string           `json:"name"`
	Email              string           `json:"email"`
	Phone              *string          `json:"phone"`
	EmployeeCode       *string          `json:"employeeCode"`
	PinCode            *string          `json:"pinCode"`
	OutletID           *int             `json:"outletId"`
	Active             bool             `json:"active"`
	LastLogin          *string          `json:"lastLogin"`
	ProfileImage       *string          `json:"profileImage"`
	MaxDiscountPercent float64          `json:"maxDiscountPercent"`
	CreatedAt          string           `json:"createdAt"`
	UpdatedAt          string           `json:"updatedAt"`
	CreatedBy          *string          `json:"createdBy"`
	UpdatedBy          *string          `json:"updatedBy"`
	Roles              []string         `json:"roles"`
	Outlet             *models.Outlet   `json:"outlet"`
	CardPermissions    *CardPermissions `json:"cardPermissions"`
}

// CreateUserRequest represents the request to create a user
type CreateUserRequest struct {
	Name               string   `json:"name"`
	Email              string   `json:"email"`
	Password           string   `json:"password"`
	Phone              *string  `json:"phone"`
	EmployeeCode       *string  `json:"employeeCode"`
	PinCode            *string  `json:"pinCode"`
	OutletID           *int     `json:"outletId"`
	Roles              []string `json:"roles"`
	MaxDiscountPercent *float64 `json:"maxDiscountPercent"`
}

// UpdateUserRequest represents the request to update a user
type UpdateUserRequest struct {
	Name               *string  `json:"name"`
	Email              *string  `json:"email"`
	Phone              *string  `json:"phone"`
	Password           *string  `json:"password"`
	EmployeeCode       *string  `json:"employeeCode"`
	PinCode            *string  `json:"pinCode"`
	OutletID           *int     `json:"outletId"`
	Roles              []string `json:"roles"`
	MaxDiscountPercent *float64 `json:"maxDiscountPercent"`
	ProfileImage       *string  `json:"profileImage"`
}

// UpdateProfileRequest represents the request to update own profile
type UpdateProfileRequest struct {
	Name         *string `json:"name"`
	Phone        *string `json:"phone"`
	ProfileImage *string `json:"profileImage"`
}

// toUserResponse converts a User model to UserResponse
func (s *UserService) toUserResponse(user *models.User) *UserResponse {
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

	lastLogin := ""
	if user.LastLogin != nil {
		lastLogin = user.LastLogin.Format("2006-01-02T15:04:05Z07:00")
	}

	// SUPER_ADMIN gets nil card permissions (mobile treats nil as "show all").
	// Other users: look up role-level card permissions for their first custom role.
	var cardPerms *CardPermissions
	if !isSuperAdmin {
		business := make([]string, 0)
		pccp := make([]string, 0)

		// Find the first custom role name (non-built-in) for this user
		var customRoleName string
		for _, ur := range user.UserRoles {
			if ur.Role != nil && ur.Role.Name != models.RoleSuperAdmin && ur.Role.Name != models.RoleAdmin {
				customRoleName = string(ur.Role.Name)
				break
			}
		}

		if customRoleName != "" {
			// Role-level permissions take priority
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
			// Fall back to user-level permissions (for ADMIN and other built-in roles)
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

	return &UserResponse{
		ID:                 user.ID,
		Name:               user.Name,
		Email:              user.Email,
		Phone:              user.Phone,
		EmployeeCode:       user.EmployeeCode,
		PinCode:            user.PinCode,
		OutletID:           user.OutletID,
		Active:             user.Active,
		LastLogin:          &lastLogin,
		ProfileImage:       user.ProfileImage,
		MaxDiscountPercent: user.MaxDiscountPercent,
		CreatedAt:          user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:          user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		CreatedBy:          user.CreatedBy,
		UpdatedBy:          user.UpdatedBy,
		Roles:              roles,
		Outlet:             user.Outlet,
		CardPermissions:    cardPerms,
	}
}

// GetAll returns all users with roles and outlet, optionally filtered by outlet
func (s *UserService) GetAll(outletID *int) ([]UserResponse, error) {
	var users []models.User
	query := s.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Order("created_at DESC")

	if outletID != nil {
		query = query.Where("outlet_id = ?", *outletID)
	}

	if err := query.Find(&users).Error; err != nil {
		slog.Error("[UserService] Failed to get all users", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to load users",
		}
	}

	responses := make([]UserResponse, 0, len(users))
	for i := range users {
		responses = append(responses, *s.toUserResponse(&users[i]))
	}

	return responses, nil
}

// GetByID returns a single user by ID
func (s *UserService) GetByID(id int) (*UserResponse, error) {
	var user models.User
	err := s.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Where("id = ?", id).
		First(&user).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{
				Message: fmt.Sprintf("User not found"),
			}
		}
		slog.Error("[UserService] Failed to get user by ID", "error", err, "id", id)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to load user",
		}
	}

	return s.toUserResponse(&user), nil
}

// GetByOutlet returns all users for a specific outlet
func (s *UserService) GetByOutlet(outletID int) ([]UserResponse, error) {
	return s.GetAll(&outletID)
}

// Create creates a new user
func (s *UserService) Create(req *CreateUserRequest) (*UserResponse, error) {
	// Check if email already exists
	var existingUser models.User
	err := s.db.Where("email = ?", req.Email).First(&existingUser).Error
	if err == nil {
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message:    fmt.Sprintf("Email already in use: %s", req.Email),
		}
	}
	if err != gorm.ErrRecordNotFound {
		slog.Error("[UserService] Failed to check email uniqueness", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Internal server error",
		}
	}

	// Get role IDs — checks both built-in roles and custom_roles
	var roleIDs []int
	if len(req.Roles) > 0 {
		var err error
		roleIDs, err = s.resolveRoleIDs(req.Roles)
		if err != nil {
			return nil, err
		}
	} else {
		// Default role: CASHIER
		var cashierRole models.Role
		if err := s.db.Where("name = ?", models.RoleCashier).First(&cashierRole).Error; err == nil {
			roleIDs = append(roleIDs, cashierRole.ID)
		}
	}

	// Hash password
	hashedPassword, err := util.HashPassword(req.Password)
	if err != nil {
		slog.Error("[UserService] Failed to hash password", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Internal server error",
		}
	}

	maxDiscount := 10.0
	if req.MaxDiscountPercent != nil {
		maxDiscount = *req.MaxDiscountPercent
	}

	// Create user
	user := &models.User{
		Name:               req.Name,
		Email:              req.Email,
		Password:           hashedPassword,
		Phone:              req.Phone,
		EmployeeCode:       req.EmployeeCode,
		PinCode:            req.PinCode,
		OutletID:           req.OutletID,
		Active:             true,
		MaxDiscountPercent: maxDiscount,
	}

	if err := s.db.Create(user).Error; err != nil {
		slog.Error("[UserService] Failed to create user", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to create user",
		}
	}

	// Create user roles
	for _, roleID := range roleIDs {
		userRole := &models.UserRole{
			UserID: user.ID,
			RoleID: roleID,
		}
		if err := s.db.Create(userRole).Error; err != nil {
			slog.Error("[UserService] Failed to create user role", "error", err)
		}
	}

	// Reload user with roles and outlet
	user, err = s.getUserWithRoles(req.Email)
	if err != nil {
		slog.Error("[UserService] Failed to reload user after creation", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to load created user",
		}
	}

	return s.toUserResponse(user), nil
}

// Update updates an existing user
func (s *UserService) Update(id int, req *UpdateUserRequest) (*UserResponse, error) {
	// Check if user exists
	user, err := s.getUserByID(id)
	if err != nil {
		return nil, err
	}

	updateData := map[string]interface{}{}

	if req.Name != nil {
		updateData["name"] = *req.Name
		user.Name = *req.Name
	}
	if req.Email != nil && *req.Email != "" {
		updateData["email"] = *req.Email
		user.Email = *req.Email
	}
	if req.Phone != nil {
		updateData["phone"] = *req.Phone
		user.Phone = req.Phone
	}
	if req.Password != nil && *req.Password != "" {
		hashed, err := util.HashPassword(*req.Password)
		if err != nil {
			return nil, &util.BusinessException{StatusCode: 500, Message: "Failed to hash password"}
		}
		updateData["password"] = hashed
	}
	if req.EmployeeCode != nil {
		updateData["employee_code"] = *req.EmployeeCode
		user.EmployeeCode = req.EmployeeCode
	}
	if req.PinCode != nil {
		updateData["pin_code"] = *req.PinCode
		user.PinCode = req.PinCode
	}
	if req.OutletID != nil {
		updateData["outlet_id"] = *req.OutletID
		user.OutletID = req.OutletID
	}
	if req.MaxDiscountPercent != nil {
		updateData["max_discount_percent"] = *req.MaxDiscountPercent
		user.MaxDiscountPercent = *req.MaxDiscountPercent
	}
	if req.ProfileImage != nil {
		updateData["profile_image"] = *req.ProfileImage
		user.ProfileImage = req.ProfileImage
	}

	// Update roles if provided
	if len(req.Roles) > 0 {
		// Delete existing roles
		if err := s.db.Where("user_id = ?", id).Delete(&models.UserRole{}).Error; err != nil {
			slog.Error("[UserService] Failed to delete user roles", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 500,
				Message:    "Failed to update user roles",
			}
		}

		// Get new role IDs — checks both built-in roles and custom_roles
		newRoleIDs, err := s.resolveRoleIDs(req.Roles)
		if err != nil {
			return nil, err
		}

		// Create new user roles
		for _, roleID := range newRoleIDs {
			userRole := &models.UserRole{
				UserID: id,
				RoleID: roleID,
			}
			if err := s.db.Create(userRole).Error; err != nil {
				slog.Error("[UserService] Failed to create user role", "error", err)
			}
		}
	}

	if len(updateData) > 0 {
		if err := s.db.Model(user).Updates(updateData).Error; err != nil {
			slog.Error("[UserService] Failed to update user", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 500,
				Message:    "Failed to update user",
			}
		}
	}

	// Reload with roles and outlet
	user, err = s.getUserByID(id)
	if err != nil {
		return nil, err
	}

	return s.toUserResponse(user), nil
}

// ToggleActive toggles the active status of a user
func (s *UserService) ToggleActive(id int) (*UserResponse, error) {
	user, err := s.getUserByID(id)
	if err != nil {
		return nil, err
	}

	newActive := !user.Active
	if err := s.db.Model(user).Update("is_active", newActive).Error; err != nil {
		slog.Error("[UserService] Failed to toggle user active", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to toggle user active status",
		}
	}

	user.Active = newActive

	// Reload with roles and outlet
	user, err = s.getUserByID(id)
	if err != nil {
		return nil, err
	}

	return s.toUserResponse(user), nil
}

// ResetPassword changes a user's password
func (s *UserService) ResetPassword(id int, newPassword string) error {
	user, err := s.getUserByID(id)
	if err != nil {
		return err
	}

	hashedPassword, err := util.HashPassword(newPassword)
	if err != nil {
		slog.Error("[UserService] Failed to hash password", "error", err)
		return &util.BusinessException{
			StatusCode: 500,
			Message:    "Internal server error",
		}
	}

	if err := s.db.Model(user).Update("password", hashedPassword).Error; err != nil {
		slog.Error("[UserService] Failed to reset password", "error", err)
		return &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to reset password",
		}
	}

	return nil
}

// ChangePassword changes a user's password with current password verification
func (s *UserService) ChangePassword(id int, currentPassword, newPassword string) error {
	user, err := s.getUserByID(id)
	if err != nil {
		return err
	}

	// Verify current password
	if !util.ComparePassword(currentPassword, user.Password) {
		return &util.BusinessException{
			StatusCode: 400,
			Message:    "Current password is incorrect",
		}
	}

	return s.ResetPassword(id, newPassword)
}

// GetProfile returns the profile of the current user
func (s *UserService) GetProfile(userID int) (*UserResponse, error) {
	return s.GetByID(userID)
}

// UpdateProfile updates the profile of the current user
func (s *UserService) UpdateProfile(userID int, req *UpdateProfileRequest) (*UserResponse, error) {
	user, err := s.getUserByID(userID)
	if err != nil {
		return nil, err
	}

	updateData := map[string]interface{}{}

	if req.Name != nil {
		updateData["name"] = *req.Name
		user.Name = *req.Name
	}
	if req.Phone != nil {
		updateData["phone"] = *req.Phone
		user.Phone = req.Phone
	}
	if req.ProfileImage != nil {
		updateData["profile_image"] = *req.ProfileImage
		user.ProfileImage = req.ProfileImage
	}

	if len(updateData) > 0 {
		if err := s.db.Model(user).Updates(updateData).Error; err != nil {
			slog.Error("[UserService] Failed to update profile", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 500,
				Message:    "Failed to update profile",
			}
		}
	}

	// Reload with roles and outlet
	user, err = s.getUserByID(userID)
	if err != nil {
		return nil, err
	}

	return s.toUserResponse(user), nil
}

// Helper function to get user with roles and outlet
func (s *UserService) getUserWithRoles(email string) (*models.User, error) {
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

// Helper function to get user by ID with roles and outlet
func (s *UserService) getUserByID(id int) (*models.User, error) {
	var user models.User
	err := s.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Where("id = ?", id).
		First(&user).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{
				Message: "User not found",
			}
		}
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Internal server error",
		}
	}

	return &user, nil
}

// GetCardPermissions returns the card permissions for a user
func (s *UserService) GetCardPermissions(userID int) (*CardPermissions, error) {
	var perms []models.UserCardPermission
	if err := s.db.Where("user_id = ?", userID).Find(&perms).Error; err != nil {
		return nil, err
	}
	business := make([]string, 0)
	pccp := make([]string, 0)
	reports := make([]string, 0)
	for _, p := range perms {
		if p.CardType == "business" {
			business = append(business, p.CardKey)
		} else if p.CardType == "pccp" {
			pccp = append(pccp, p.CardKey)
		} else if p.CardType == "reports" {
			reports = append(reports, p.CardKey)
		}
	}
	return &CardPermissions{Business: business, Pccp: pccp, Reports: reports}, nil
}

// UpdateCardPermissionsRequest is the body for setting card permissions
type UpdateCardPermissionsRequest struct {
	Business []string `json:"business"`
	Pccp     []string `json:"pccp"`
	Reports  []string `json:"reports"`
}

// UpdateCardPermissions replaces all card permissions for a user
func (s *UserService) UpdateCardPermissions(userID int, req *UpdateCardPermissionsRequest) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&models.UserCardPermission{}).Error; err != nil {
			return err
		}
		var newPerms []models.UserCardPermission
		for _, k := range req.Business {
			newPerms = append(newPerms, models.UserCardPermission{UserID: userID, CardKey: k, CardType: "business"})
		}
		for _, k := range req.Pccp {
			newPerms = append(newPerms, models.UserCardPermission{UserID: userID, CardKey: k, CardType: "pccp"})
		}
		for _, k := range req.Reports {
			newPerms = append(newPerms, models.UserCardPermission{UserID: userID, CardKey: k, CardType: "reports"})
		}
		if len(newPerms) > 0 {
			return tx.Create(&newPerms).Error
		}
		return nil
	})
}

// GetRoleCardPermissions returns card permissions for a role
func (s *UserService) GetRoleCardPermissions(roleName string) (*CardPermissions, error) {
	var perms []models.RoleCardPermission
	if err := s.db.Where("role_name = ?", roleName).Find(&perms).Error; err != nil {
		return nil, err
	}
	business := make([]string, 0)
	pccp := make([]string, 0)
	reports := make([]string, 0)
	for _, p := range perms {
		if p.CardType == "business" {
			business = append(business, p.CardKey)
		} else if p.CardType == "pccp" {
			pccp = append(pccp, p.CardKey)
		} else if p.CardType == "reports" {
			reports = append(reports, p.CardKey)
		}
	}
	return &CardPermissions{Business: business, Pccp: pccp, Reports: reports}, nil
}

// UpdateRoleCardPermissions replaces all card permissions for a role
func (s *UserService) UpdateRoleCardPermissions(roleName string, req *UpdateCardPermissionsRequest) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_name = ?", roleName).Delete(&models.RoleCardPermission{}).Error; err != nil {
			return err
		}
		var newPerms []models.RoleCardPermission
		for _, k := range req.Business {
			newPerms = append(newPerms, models.RoleCardPermission{RoleName: roleName, CardKey: k, CardType: "business"})
		}
		for _, k := range req.Pccp {
			newPerms = append(newPerms, models.RoleCardPermission{RoleName: roleName, CardKey: k, CardType: "pccp"})
		}
		for _, k := range req.Reports {
			newPerms = append(newPerms, models.RoleCardPermission{RoleName: roleName, CardKey: k, CardType: "reports"})
		}
		if len(newPerms) > 0 {
			return tx.Create(&newPerms).Error
		}
		return nil
	})
}


func (s *UserService) SetOutOfOffice(userID int, value bool) error {
	if err := s.db.Model(&models.User{}).Where("id = ?", userID).
		Update("out_of_office", value).Error; err != nil {
		return &util.BusinessException{StatusCode: 500, Message: "Failed to update out-of-office status"}
	}
	return nil
}
