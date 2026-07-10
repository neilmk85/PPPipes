package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type UsersHandler struct {
	userService *service.UserService
}

func NewUsersHandler(userService *service.UserService) *UsersHandler {
	return &UsersHandler{userService: userService}
}

// handleError sends an error response with appropriate status code
func handleUserError(w http.ResponseWriter, err error) {
	if be, ok := err.(*util.BusinessException); ok {
		util.SendError(w, be.StatusCode, be.Message)
		return
	}
	if _, ok := err.(*util.ResourceNotFoundException); ok {
		util.SendError(w, http.StatusNotFound, err.Error())
		return
	}
	slog.Error("[UsersHandler] Internal error", "error", err)
	util.SendError(w, http.StatusInternalServerError, "Internal server error")
}

// GetAll retrieves all users, optionally filtered by outlet
func (h *UsersHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	outletIDStr := r.URL.Query().Get("outletId")
	var outletID *int
	if outletIDStr != "" {
		id, err := strconv.Atoi(outletIDStr)
		if err != nil {
			util.SendError(w, http.StatusBadRequest, "Invalid outletId")
			return
		}
		outletID = &id
	}

	users, err := h.userService.GetAll(outletID)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "Success", users)
}

// GetByID retrieves a single user by ID
func (h *UsersHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	user, err := h.userService.GetByID(id)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "Success", user)
}

// GetByOutlet retrieves all users for a specific outlet
func (h *UsersHandler) GetByOutlet(w http.ResponseWriter, r *http.Request) {
	outletIDStr := r.PathValue("outletId")
	outletID, err := strconv.Atoi(outletIDStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	users, err := h.userService.GetByOutlet(outletID)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "Success", users)
}

// Create creates a new user
func (h *UsersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.userService.Create(&req)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "User created", user)
}

// Update updates an existing user
func (h *UsersHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req service.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.userService.Update(id, &req)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "User updated", user)
}

// ToggleActive toggles the active status of a user
func (h *UsersHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	user, err := h.userService.ToggleActive(id)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "User status updated", user)
}

func (h *UsersHandler) ToggleOutOfOffice(w http.ResponseWriter, r *http.Request) {
	authUser := middleware.GetUser(r)
	if authUser == nil {
		util.SendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req struct {
		OutOfOffice bool `json:"outOfOffice"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.userService.SetOutOfOffice(authUser.ID, req.OutOfOffice); err != nil {
		handleUserError(w, err)
		return
	}
	util.SendSuccess(w, "Status updated", map[string]bool{"outOfOffice": req.OutOfOffice})
}

// ResetPassword resets a user's password
func (h *UsersHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err = h.userService.ResetPassword(id, req.NewPassword)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "Password reset", nil)
}

// ChangePassword changes the password with current password verification
func (h *UsersHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err = h.userService.ChangePassword(id, req.CurrentPassword, req.NewPassword)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "Password changed", nil)
}

// GetProfile returns the profile of the authenticated user
func (h *UsersHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	authUser := middleware.GetUser(r)
	if authUser == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	user, err := h.userService.GetProfile(authUser.ID)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "Success", user)
}

// UpdateProfile updates the profile of the authenticated user
func (h *UsersHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	authUser := middleware.GetUser(r)
	if authUser == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var req service.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.userService.UpdateProfile(authUser.ID, &req)
	if err != nil {
		handleUserError(w, err)
		return
	}

	util.SendSuccess(w, "Profile updated", user)
}

// GetCardPermissions returns the card permissions for a specific user
func (h *UsersHandler) GetCardPermissions(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	perms, err := h.userService.GetCardPermissions(id)
	if err != nil {
		slog.Error("[UsersHandler] GetCardPermissions error", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch card permissions")
		return
	}
	util.SendSuccess(w, "Success", perms)
}

// UpdateCardPermissions replaces card permissions for a specific user
func (h *UsersHandler) UpdateCardPermissions(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	var req service.UpdateCardPermissionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.userService.UpdateCardPermissions(id, &req); err != nil {
		slog.Error("[UsersHandler] UpdateCardPermissions error", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to update card permissions")
		return
	}
	util.SendSuccess(w, "Card permissions updated", nil)
}

// GetRoleCardPermissions returns the card permissions for a specific role
func (h *UsersHandler) GetRoleCardPermissions(w http.ResponseWriter, r *http.Request) {
	roleName := r.PathValue("roleName")
	if roleName == "" {
		util.SendError(w, http.StatusBadRequest, "Role name is required")
		return
	}
	perms, err := h.userService.GetRoleCardPermissions(roleName)
	if err != nil {
		slog.Error("[UsersHandler] GetRoleCardPermissions error", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch role card permissions")
		return
	}
	util.SendSuccess(w, "Success", perms)
}

// UpdateRoleCardPermissions replaces card permissions for a specific role
func (h *UsersHandler) UpdateRoleCardPermissions(w http.ResponseWriter, r *http.Request) {
	roleName := r.PathValue("roleName")
	if roleName == "" {
		util.SendError(w, http.StatusBadRequest, "Role name is required")
		return
	}
	var req service.UpdateCardPermissionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.userService.UpdateRoleCardPermissions(roleName, &req); err != nil {
		slog.Error("[UsersHandler] UpdateRoleCardPermissions error", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to update role card permissions")
		return
	}
	util.SendSuccess(w, "Role card permissions updated", nil)
}
