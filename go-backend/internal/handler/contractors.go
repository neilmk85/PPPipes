package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type contractorRequest struct {
	Name           string   `json:"name"`
	ContactPerson  *string  `json:"contactPerson"`
	Phone          *string  `json:"phone"`
	Email          *string  `json:"email"`
	GSTIN          *string  `json:"gstin"`
	PAN            *string  `json:"pan"`
	Address        *string  `json:"address"`
	City           *string  `json:"city"`
	State          *string  `json:"state"`
	Pincode        *string  `json:"pincode"`
	TradeType      *string  `json:"tradeType"`
	DefaultTDSRate *float64 `json:"defaultTDSRate"`
	Notes          *string  `json:"notes"`
}

func (r contractorRequest) toModel() models.Contractor {
	return models.Contractor{
		Name:           r.Name,
		ContactPerson:  r.ContactPerson,
		Phone:          r.Phone,
		Email:          r.Email,
		GSTIN:          r.GSTIN,
		PAN:            r.PAN,
		Address:        r.Address,
		City:           r.City,
		State:          r.State,
		Pincode:        r.Pincode,
		TradeType:      r.TradeType,
		DefaultTDSRate: r.DefaultTDSRate,
		Notes:          r.Notes,
	}
}

type ContractorHandler struct {
	service *service.ContractorService
}

func NewContractorHandler(s *service.ContractorService) *ContractorHandler {
	return &ContractorHandler{service: s}
}

// GetAll GET /api/contractors
func (h *ContractorHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	var searchPtr *string
	if search != "" {
		searchPtr = &search
	}

	active := r.URL.Query().Get("active")
	var activePtr *bool
	if active != "" {
		a := active == "true"
		activePtr = &a
	}

	contractors, err := h.service.GetAll(searchPtr, activePtr)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Contractors retrieved", contractors)
}

// GetByID GET /api/contractors/{id}
func (h *ContractorHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid contractor ID")
		return
	}
	c, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Contractor retrieved", c)
}

// Create POST /api/contractors
func (h *ContractorHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req contractorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		util.SendError(w, http.StatusBadRequest, "Contractor name is required")
		return
	}

	m := req.toModel()
	m.Active = true
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.CreatedBy = &user.Email

	c, err := h.service.Create(m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Contractor created", "id", c.ID, "name", c.Name, "user", user.Email)
	util.SendSuccess(w, "Contractor created", c)
}

// Update PUT /api/contractors/{id}
func (h *ContractorHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid contractor ID")
		return
	}

	var req contractorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.UpdatedBy = &user.Email

	c, err := h.service.Update(id, m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Contractor updated", "id", c.ID, "name", c.Name, "user", user.Email)
	util.SendSuccess(w, "Contractor updated", c)
}

// Delete DELETE /api/contractors/{id}
func (h *ContractorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid contractor ID")
		return
	}

	c, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	if err := h.service.Delete(id); err != nil {
		handleError(w, err)
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Contractor deleted", "id", id, "name", c.Name, "user", user.Email)
	util.SendSuccess(w, "Contractor deleted", map[string]int{"id": id})
}

// ── Process Assignments ───────────────────────────────────────────────────────

// GetProcessAssignments GET /api/contractors/process-assignments
func (h *ContractorHandler) GetProcessAssignments(w http.ResponseWriter, r *http.Request) {
	processType := r.URL.Query().Get("processType")
	assignments, err := h.service.GetProcessAssignments(processType)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Process assignments retrieved", assignments)
}

type processAssignmentRequest struct {
	ContractorID int    `json:"contractorId"`
	ProcessType  string `json:"processType"`
	CommencedAt  string `json:"commencedAt"` // YYYY-MM-DD
}

// CreateProcessAssignment POST /api/contractors/process-assignments
func (h *ContractorHandler) CreateProcessAssignment(w http.ResponseWriter, r *http.Request) {
	var req processAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ContractorID == 0 || req.ProcessType == "" || req.CommencedAt == "" {
		util.SendError(w, http.StatusBadRequest, "contractorId, processType and commencedAt are required")
		return
	}
	a, err := h.service.CreateProcessAssignment(req.ContractorID, req.ProcessType, req.CommencedAt)
	if err != nil {
		handleError(w, err)
		return
	}
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Contractor process assignment created", "id", a.ID, "process", a.ProcessType, "user", user.Email)
	util.SendSuccess(w, "Process assignment created", a)
}

// DeleteProcessAssignment DELETE /api/contractors/process-assignments/{id}
func (h *ContractorHandler) DeleteProcessAssignment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid assignment ID")
		return
	}
	if err := h.service.DeleteProcessAssignment(id); err != nil {
		handleError(w, err)
		return
	}
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Contractor process assignment deleted", "id", id, "user", user.Email)
	util.SendSuccess(w, "Process assignment deleted", map[string]int{"id": id})
}
