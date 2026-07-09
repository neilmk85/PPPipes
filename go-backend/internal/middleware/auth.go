package middleware

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

// AuthUser represents the authenticated user stored in context
type AuthUser struct {
	ID          int      `json:"id"`
	Email       string   `json:"email"`
	Name        string   `json:"name"`
	Roles       []string `json:"roles"`
	OutletID    *int     `json:"outletId"`
	Permissions []string `json:"permissions"`
}

// contextKey type for storing values in context
type contextKey string

const UserContextKey contextKey = "user"

// GetUser extracts the AuthUser from the request context
func GetUser(r *http.Request) *AuthUser {
	user, ok := r.Context().Value(UserContextKey).(*AuthUser)
	if !ok {
		return nil
	}
	return user
}

// Authenticate middleware validates JWT token and loads user from database
func Authenticate(db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract Bearer token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				sendAuthError(w, "Missing authorization header", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				sendAuthError(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			token := parts[1]

			// Verify token
			claims, err := util.VerifyToken(token)
			if err != nil {
				slog.Debug("[Auth] Token verification failed", "error", err)
				sendAuthError(w, "Invalid or expired token", http.StatusUnauthorized)
				return
			}

			// Load user from database
			var user models.User
			if err := db.Where("email = ?", claims.Email).First(&user).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					sendAuthError(w, "User not found", http.StatusUnauthorized)
				} else {
					slog.Error("[Auth] Database error loading user", "error", err)
					sendAuthError(w, "Internal server error", http.StatusInternalServerError)
				}
				return
			}

			// Check if user is active
			if !user.Active {
				sendAuthError(w, "User account is inactive", http.StatusForbidden)
				return
			}

			// Load user roles
			var userRoles []models.UserRole
			if err := db.Where("user_id = ?", user.ID).Find(&userRoles).Error; err != nil {
				slog.Error("[Auth] Failed to load user roles", "error", err)
				sendAuthError(w, "Internal server error", http.StatusInternalServerError)
				return
			}

			// Get role names
			roleNames := make([]string, 0, len(userRoles))
			for _, ur := range userRoles {
				var role models.Role
				if err := db.First(&role, ur.RoleID).Error; err == nil {
					roleNames = append(roleNames, string(role.Name))
				}
			}

			// Load permissions from custom role (if any role name matches a custom_role record)
			var permissions []string
			for _, roleName := range roleNames {
				var customRolePerms *string
				if err := db.Table("custom_roles").
					Where("name = ? AND is_active = true", roleName).
					Pluck("permissions", &customRolePerms).Error; err == nil && customRolePerms != nil && *customRolePerms != "" {
					var perms []string
					if jsonErr := json.Unmarshal([]byte(*customRolePerms), &perms); jsonErr == nil {
						permissions = perms
					}
					break
				}
			}

			// Create AuthUser
			authUser := &AuthUser{
				ID:          user.ID,
				Email:       user.Email,
				Name:        user.Name,
				Roles:       roleNames,
				OutletID:    user.OutletID,
				Permissions: permissions,
			}

			// Store user in context
			ctx := context.WithValue(r.Context(), UserContextKey, authUser)
			newR := r.WithContext(ctx)

			// Also fill the ActivityLog UserBucket if present (injected by the
			// global ActivityLog middleware which runs before per-route auth)
			if bucket, ok := r.Context().Value(UserBucketKey).(*UserBucket); ok {
				bucket.User = authUser
			}

			slog.Debug("[Auth] User authenticated", "user_id", user.ID, "email", user.Email)

			next.ServeHTTP(w, newR)
		})
	}
}

// RequireRole middleware checks if user has one of the required roles
func RequireRole(requiredRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetUser(r)
			if user == nil {
				sendAuthError(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Check if user has at least one of the required roles
			hasRole := false
			for _, requiredRole := range requiredRoles {
				for _, userRole := range user.Roles {
					if userRole == requiredRole {
						hasRole = true
						break
					}
				}
				if hasRole {
					break
				}
			}

			if !hasRole {
				slog.Warn("[Auth] User lacks required role", "user_id", user.ID, "required_roles", requiredRoles)
				sendAuthError(w, "Insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireRoleOrPermission passes if the user has one of the required roles OR holds the given permission key
// (loaded from their custom role). Use this for actions that built-in roles own by default but can also
// be explicitly delegated to a custom role via a named permission key.
func RequireRoleOrPermission(permKey string, requiredRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetUser(r)
			if user == nil {
				sendAuthError(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			for _, requiredRole := range requiredRoles {
				for _, userRole := range user.Roles {
					if userRole == requiredRole {
						next.ServeHTTP(w, r)
						return
					}
				}
			}

			for _, perm := range user.Permissions {
				if perm == permKey {
					next.ServeHTTP(w, r)
					return
				}
			}

			slog.Warn("[Auth] User lacks required role or permission", "user_id", user.ID, "required_roles", requiredRoles, "permission", permKey)
			sendAuthError(w, "Insufficient permissions", http.StatusForbidden)
		})
	}
}

// OptionalAuth middleware attempts to authenticate but doesn't fail if token is missing
func OptionalAuth(db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// If no Authorization header, just proceed
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				next.ServeHTTP(w, r)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				// Invalid format but optional, so just proceed
				next.ServeHTTP(w, r)
				return
			}

			token := parts[1]

			// Try to verify token
			claims, err := util.VerifyToken(token)
			if err != nil {
				// Invalid token but optional, so just proceed
				next.ServeHTTP(w, r)
				return
			}

			// Load user from database
			var user models.User
			if err := db.Where("email = ?", claims.Email).First(&user).Error; err != nil {
				// User not found but optional, so just proceed
				next.ServeHTTP(w, r)
				return
			}

			if !user.Active {
				// User inactive but optional, so just proceed
				next.ServeHTTP(w, r)
				return
			}

			// Load user roles
			var userRoles []models.UserRole
			if err := db.Where("user_id = ?", user.ID).Find(&userRoles).Error; err != nil {
				// Failed to load roles but optional, so just proceed
				next.ServeHTTP(w, r)
				return
			}

			// Get role names
			roleNames := make([]string, 0, len(userRoles))
			for _, ur := range userRoles {
				var role models.Role
				if err := db.First(&role, ur.RoleID).Error; err == nil {
					roleNames = append(roleNames, string(role.Name))
				}
			}

			// Create AuthUser
			authUser := &AuthUser{
				ID:       user.ID,
				Email:    user.Email,
				Name:     user.Name,
				Roles:    roleNames,
				OutletID: user.OutletID,
			}

			// Store user in context
			ctx := context.WithValue(r.Context(), UserContextKey, authUser)
			newR := r.WithContext(ctx)

			next.ServeHTTP(w, newR)
		})
	}
}

// Chain helper function to apply multiple middlewares to a handler
func Chain(h http.HandlerFunc, middlewares ...func(http.Handler) http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handler := http.Handler(h)
		for i := len(middlewares) - 1; i >= 0; i-- {
			handler = middlewares[i](handler)
		}
		handler.ServeHTTP(w, r)
	}
}

// sendAuthError sends a JSON error response
func sendAuthError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := map[string]interface{}{
		"success": false,
		"message": message,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		slog.Error("[Auth] Failed to encode error response", "error", err)
	}
}
