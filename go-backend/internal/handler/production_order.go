package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ProductionOrderHandler struct {
	service          *service.ProductionOrderService
	costSheetService *service.CostSheetService
}

func NewProductionOrderHandler(s *service.ProductionOrderService, cs *service.CostSheetService) *ProductionOrderHandler {
	return &ProductionOrderHandler{service: s, costSheetService: cs}
}

// GET /api/production/intermediate-stock?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
func (h *ProductionOrderHandler) GetIntermediateStock(w http.ResponseWriter, r *http.Request) {
	fromDate := r.URL.Query().Get("fromDate")
	toDate := r.URL.Query().Get("toDate")
	rows, err := h.service.GetIntermediateStock(fromDate, toDate)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Intermediate stock retrieved", rows)
}

// GET /api/production/all-stages-stock?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
func (h *ProductionOrderHandler) GetAllStagesStock(w http.ResponseWriter, r *http.Request) {
	fromDate := r.URL.Query().Get("fromDate")
	toDate := r.URL.Query().Get("toDate")
	rows, err := h.service.GetAllStagesStock(fromDate, toDate)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "All stages stock retrieved", rows)
}

// GET /api/production/pipe-summary?pipeName=&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
func (h *ProductionOrderHandler) GetPipeSummary(w http.ResponseWriter, r *http.Request) {
	pipeName := r.URL.Query().Get("pipeName")
	fromDate := r.URL.Query().Get("fromDate")
	toDate := r.URL.Query().Get("toDate")

	rows, err := h.service.GetPipeSummary(pipeName, fromDate, toDate)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Pipe summary retrieved", rows)
}

// GET /api/production/orders/summaries?stage=FABRICATION
func (h *ProductionOrderHandler) GetSummaries(w http.ResponseWriter, r *http.Request) {
	stage := r.URL.Query().Get("stage") // optional; defaults to FINAL_TESTING if empty
	summaries, err := h.service.GetSummaries(stage)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Order summaries retrieved", summaries)
}

// GET /api/production/stage-overview
func (h *ProductionOrderHandler) GetStageOverview(w http.ResponseWriter, r *http.Request) {
	rows, err := h.service.GetStageOverview()
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Stage overview retrieved", rows)
}

// GET /api/production/orders
func (h *ProductionOrderHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	var outletID, soID, pipeConfigID *int
	var status *string

	if v := r.URL.Query().Get("outletId"); v != "" {
		id, err := strconv.Atoi(v)
		if err == nil {
			outletID = &id
		}
	}
	if v := r.URL.Query().Get("soId"); v != "" {
		id, err := strconv.Atoi(v)
		if err == nil {
			soID = &id
		}
	}
	if v := r.URL.Query().Get("pipeConfigId"); v != "" {
		id, err := strconv.Atoi(v)
		if err == nil {
			pipeConfigID = &id
		}
	}
	if v := r.URL.Query().Get("status"); v != "" {
		status = &v
	}

	orders, total, err := h.service.GetAll(outletID, soID, pipeConfigID, status, page, size)
	if err != nil {
		handleError(w, err)
		return
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, orders, total, totalPages, size, page)
}

// GET /api/production/orders/{id}
func (h *ProductionOrderHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	order, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Production order retrieved", order)
}

// POST /api/production/orders
func (h *ProductionOrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	var req service.CreateProductionOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	order, err := h.service.Create(req, user.ID, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Production order created", order)
}

// PATCH /api/production/orders/{id}/status
func (h *ProductionOrderHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var req service.UpdateProductionOrderStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	order, err := h.service.UpdateStatus(id, req, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Status updated", order)
}

// GET /api/production/orders/{id}/progress
func (h *ProductionOrderHandler) GetProgress(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	progress, err := h.service.GetProgress(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Progress retrieved", progress)
}

// GET /api/production/orders/{id}/cost-sheet
func (h *ProductionOrderHandler) GetCostSheet(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	cs, err := h.costSheetService.GetByOrder(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Cost sheet retrieved", cs)
}

// POST /api/production/orders/{id}/cost-sheet/compute
func (h *ProductionOrderHandler) RecomputeCostSheet(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	cs, err := h.costSheetService.ComputeForOrder(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Cost sheet computed", cs)
}

// GET /api/production/orders/{id}/stage-costs
func (h *ProductionOrderHandler) GetStageCosts(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	costs, err := h.costSheetService.GetStageCosts(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Stage costs retrieved", costs)
}

// POST /api/sales-orders/{id}/early-close
func (h *ProductionOrderHandler) EarlyCloseSalesOrder(w http.ResponseWriter, r *http.Request) {
	soID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid SO ID")
		return
	}
	var req service.EarlyCloseSORequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	user := middleware.GetUser(r)
	updatedBy := ""
	if user != nil {
		updatedBy = user.Email
	}
	if err := h.service.EarlyCloseSalesOrder(soID, req, updatedBy); err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Sales order early-closed", nil)
}
