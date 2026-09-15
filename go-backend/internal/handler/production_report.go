package handler

import (
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ProductionReportHandler struct {
	service *service.ProductionReportService
}

func NewProductionReportHandler(s *service.ProductionReportService) *ProductionReportHandler {
	return &ProductionReportHandler{service: s}
}

func parseReportFilters(r *http.Request) (fromDate, toDate string, outletID *int) {
	fromDate = r.URL.Query().Get("fromDate")
	toDate = r.URL.Query().Get("toDate")
	if v := r.URL.Query().Get("outletId"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			outletID = &id
		}
	}
	return
}

// GET /api/production/reports/stage-summary
func (h *ProductionReportHandler) StageSummary(w http.ResponseWriter, r *http.Request) {
	from, to, outletID := parseReportFilters(r)
	rows, err := h.service.GetStageSummary(from, to, outletID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Stage summary retrieved", rows)
}

// GET /api/production/reports/cost-summary
func (h *ProductionReportHandler) CostSummary(w http.ResponseWriter, r *http.Request) {
	from, to, outletID := parseReportFilters(r)
	rows, err := h.service.GetCostSummary(from, to, outletID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Cost summary retrieved", rows)
}

// GET /api/production/reports/material-consumption
func (h *ProductionReportHandler) MaterialConsumption(w http.ResponseWriter, r *http.Request) {
	from, to, outletID := parseReportFilters(r)
	rows, err := h.service.GetMaterialConsumption(from, to, outletID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Material consumption retrieved", rows)
}

// GET /api/production/reports/machine-utilization
func (h *ProductionReportHandler) MachineUtilization(w http.ResponseWriter, r *http.Request) {
	from, to, outletID := parseReportFilters(r)
	rows, err := h.service.GetMachineUtilization(from, to, outletID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Machine utilization retrieved", rows)
}

// GET /api/production/reports/spinning-costs
func (h *ProductionReportHandler) SpinningCosts(w http.ResponseWriter, r *http.Request) {
	from, to, outletID := parseReportFilters(r)
	rows, err := h.service.GetSpinningCostReport(from, to, outletID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Spinning costs retrieved", rows)
}

// GET /api/production/reports/contractor-costs
func (h *ProductionReportHandler) ContractorCosts(w http.ResponseWriter, r *http.Request) {
	from, to, outletID := parseReportFilters(r)
	rows, err := h.service.GetContractorCostReport(from, to, outletID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Contractor costs retrieved", rows)
}

// GET /api/inventory/stage-wise
func (h *ProductionReportHandler) StageWiseInventory(w http.ResponseWriter, r *http.Request) {
	from, to, outletID := parseReportFilters(r)
	rows, err := h.service.GetStageWiseInventory(from, to, outletID)
	if err != nil {
		util.SendError(w, 500, err.Error())
		return
	}
	util.SendSuccess(w, "Stage-wise inventory", rows)
}
