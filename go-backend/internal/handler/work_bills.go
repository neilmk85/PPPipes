package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type WorkBillHandler struct {
	svc *service.WorkBillService
}

func NewWorkBillHandler(svc *service.WorkBillService) *WorkBillHandler {
	return &WorkBillHandler{svc: svc}
}

type workBillItemRequest struct {
	Description   string  `json:"description"`
	Unit          string  `json:"unit"`
	ContractedQty float64 `json:"contractedQty"`
	ActualQty     float64 `json:"actualQty"`
	Rate          float64 `json:"rate"`
	GSTRate       float64 `json:"gstRate"`
	Amount        float64 `json:"amount"`
	SortOrder     int     `json:"sortOrder"`
}

type workBillRequest struct {
	WorkOrderID         int                   `json:"workOrderId"`
	WONumber            string                `json:"woNumber"`
	WOTitle             string                `json:"woTitle"`
	ContractorID        int                   `json:"contractorId"`
	ContractorName      string                `json:"contractorName"`
	ContractorGstin     *string               `json:"contractorGstin"`
	BillingPeriodFrom   *string               `json:"billingPeriodFrom"`
	BillingPeriodTo     *string               `json:"billingPeriodTo"`
	BillDate            string                `json:"billDate"`
	DueDate             *string               `json:"dueDate"`
	SupplyType          models.SupplyType     `json:"supplyType"`
	TDSRate             float64               `json:"tdsRate"`
	ContractorInvoiceNo *string               `json:"contractorInvoiceNo"`
	Notes               *string               `json:"notes"`
	Items               []workBillItemRequest  `json:"items"`
}

func (r workBillRequest) toModel() models.WorkBill {
	b := models.WorkBill{
		WorkOrderID:         r.WorkOrderID,
		WONumber:            r.WONumber,
		WOTitle:             r.WOTitle,
		ContractorID:        r.ContractorID,
		ContractorName:      r.ContractorName,
		ContractorGstin:     r.ContractorGstin,
		BillingPeriodFrom:   r.BillingPeriodFrom,
		BillingPeriodTo:     r.BillingPeriodTo,
		BillDate:            r.BillDate,
		DueDate:             r.DueDate,
		SupplyType:          r.SupplyType,
		TDSRate:             decimal.NewFromFloat(r.TDSRate),
		ContractorInvoiceNo: r.ContractorInvoiceNo,
		Notes:               r.Notes,
	}
	for i, item := range r.Items {
		b.Items = append(b.Items, models.WorkBillItem{
			Description:   item.Description,
			Unit:          item.Unit,
			ContractedQty: decimal.NewFromFloat(item.ContractedQty),
			ActualQty:     decimal.NewFromFloat(item.ActualQty),
			Rate:          decimal.NewFromFloat(item.Rate),
			GSTRate:       decimal.NewFromFloat(item.GSTRate),
			Amount:        decimal.NewFromFloat(item.Amount),
			SortOrder:     i,
		})
	}
	return b
}

// GET /api/work-bills
func (h *WorkBillHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	status := r.URL.Query().Get("status")
	projectID, _ := strconv.Atoi(r.URL.Query().Get("projectId"))
	bills, err := h.svc.GetAll(search, status, projectID)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Work bills retrieved", bills)
}

// GET /api/work-bills/{id}
func (h *WorkBillHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	b, err := h.svc.GetByID(id)
	if err != nil {
		util.SendError(w, http.StatusNotFound, "not found")
		return
	}
	util.SendSuccess(w, "Work bill retrieved", b)
}

// POST /api/work-bills
func (h *WorkBillHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req workBillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, _ := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	createdBy := ""
	if user != nil {
		createdBy = user.Email
	}
	b, err := h.svc.Create(req.toModel(), createdBy)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Work bill created", b)
}

// PUT /api/work-bills/{id}
func (h *WorkBillHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req workBillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, _ := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	updatedBy := ""
	if user != nil {
		updatedBy = user.Email
	}
	b, err := h.svc.Update(id, req.toModel(), updatedBy)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Work bill updated", b)
}

// PATCH /api/work-bills/{id}/status
func (h *WorkBillHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body struct {
		Status models.WorkBillStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, _ := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	updatedBy := ""
	if user != nil {
		updatedBy = user.Email
	}
	b, err := h.svc.UpdateStatus(id, body.Status, updatedBy)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Status updated", b)
}

// POST /api/work-bills/{id}/payments
func (h *WorkBillHandler) AddPayment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body struct {
		Date      string                  `json:"date"`
		Amount    float64                 `json:"amount"`
		Mode      models.WorkBillPayMode  `json:"mode"`
		Reference *string                 `json:"reference"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, _ := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	createdBy := ""
	if user != nil {
		createdBy = user.Email
	}
	payment := models.WorkBillPayment{
		Date:      body.Date,
		Amount:    decimal.NewFromFloat(body.Amount),
		Mode:      body.Mode,
		Reference: body.Reference,
	}
	b, err := h.svc.AddPayment(id, payment, createdBy)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Payment recorded", b)
}

// DELETE /api/work-bills/{id}
func (h *WorkBillHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.svc.Delete(id); err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Work bill deleted", nil)
}
