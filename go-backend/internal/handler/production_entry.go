package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ProductionEntryHandler struct {
	service *service.ProductionEntryService
}

func NewProductionEntryHandler(s *service.ProductionEntryService) *ProductionEntryHandler {
	return &ProductionEntryHandler{service: s}
}

// GET /api/production/entries
func (h *ProductionEntryHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	var outletID, pipeConfigID *int
	var stageType *models.ProdStageType
	from, _ := util.ParseDateParam(r, "from")
	to, _ := util.ParseDateParam(r, "to")

	if v := r.URL.Query().Get("outletId"); v != "" {
		id, err := strconv.Atoi(v)
		if err == nil {
			outletID = &id
		}
	}
	if v := r.URL.Query().Get("pipeConfigId"); v != "" {
		id, err := strconv.Atoi(v)
		if err == nil {
			pipeConfigID = &id
		}
	}
	if v := r.URL.Query().Get("stageType"); v != "" {
		st := models.ProdStageType(v)
		stageType = &st
	}

	entries, total, err := h.service.GetAll(outletID, stageType, pipeConfigID, from, to, page, size)
	if err != nil {
		handleError(w, err)
		return
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, entries, total, totalPages, size, page)
}

// GET /api/production/entries/{id}
func (h *ProductionEntryHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	entry, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Entry retrieved", entry)
}

// GET /api/production/entries/by-order/{orderId}
func (h *ProductionEntryHandler) GetByOrder(w http.ResponseWriter, r *http.Request) {
	orderId, err := strconv.Atoi(r.PathValue("orderId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid orderId")
		return
	}
	entries, err := h.service.GetByOrder(orderId)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Entries retrieved", entries)
}

// GET /api/production/entries/prior-stage?orderId=X&stage=SPINNING
func (h *ProductionEntryHandler) GetPriorStageCompleted(w http.ResponseWriter, r *http.Request) {
	orderIdStr := r.URL.Query().Get("orderId")
	stageStr := r.URL.Query().Get("stage")
	if orderIdStr == "" || stageStr == "" {
		util.SendError(w, http.StatusBadRequest, "orderId and stage are required")
		return
	}
	orderId, err := strconv.Atoi(orderIdStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "orderId must be an integer")
		return
	}
	info, err := h.service.GetPriorStageCompleted(orderId, models.ProdStageType(stageStr))
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Prior stage info retrieved", info)
}

// GET /api/production/entries/stage-wip?pipeConfigId=X&stage=Y
func (h *ProductionEntryHandler) GetStageWip(w http.ResponseWriter, r *http.Request) {
	pipeConfigIdStr := r.URL.Query().Get("pipeConfigId")
	stageStr := r.URL.Query().Get("stage")
	if pipeConfigIdStr == "" || stageStr == "" {
		util.SendError(w, http.StatusBadRequest, "pipeConfigId and stage are required")
		return
	}
	pipeConfigId, err := strconv.Atoi(pipeConfigIdStr)
	if err != nil || pipeConfigId == 0 {
		util.SendError(w, http.StatusBadRequest, "pipeConfigId must be a valid integer")
		return
	}
	stage := models.ProdStageType(stageStr)
	if models.StageIndex(stage) < 0 {
		util.SendError(w, http.StatusBadRequest, "invalid stage")
		return
	}
	available, priorStage, err := h.service.GetStageWipForConfig(pipeConfigId, stage)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "stage wip retrieved", map[string]interface{}{
		"available":  available,
		"priorStage": string(priorStage),
	})
}

// GET /api/production/entries/stage-wip-bulk?stage=Y
func (h *ProductionEntryHandler) GetStageWipBulk(w http.ResponseWriter, r *http.Request) {
	stageStr := r.URL.Query().Get("stage")
	if stageStr == "" {
		util.SendError(w, http.StatusBadRequest, "stage is required")
		return
	}
	stage := models.ProdStageType(stageStr)
	if models.StageIndex(stage) < 0 {
		util.SendError(w, http.StatusBadRequest, "invalid stage")
		return
	}
	result, err := h.service.GetStageWipBulk(stage)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "bulk stage wip retrieved", result)
}

// POST /api/production/entries
func (h *ProductionEntryHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	var req service.CreateProductionEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	entry, err := h.service.Create(req, user.ID, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Production entry created", entry)
}
