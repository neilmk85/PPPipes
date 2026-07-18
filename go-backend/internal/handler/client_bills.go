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

type ClientBillHandler struct {
	svc *service.ClientBillService
}

func NewClientBillHandler(svc *service.ClientBillService) *ClientBillHandler {
	return &ClientBillHandler{svc: svc}
}

type clientBillItemRequest struct {
	Description   string  `json:"description"`
	Unit          string  `json:"unit"`
	ContractedQty float64 `json:"contractedQty"`
	PreviousQty   float64 `json:"previousQty"`
	CurrentQty    float64 `json:"currentQty"`
	Rate          float64 `json:"rate"`
	GSTRate       float64 `json:"gstRate"`
	Amount        float64 `json:"amount"`
	SortOrder     int     `json:"sortOrder"`
}

type clientBillRequest struct {
	SiteProjectID   int                      `json:"siteProjectId"`
	BillDate        string                   `json:"billDate"`
	PeriodFrom      *string                  `json:"periodFrom"`
	PeriodTo        *string                  `json:"periodTo"`
	ClientName      string                   `json:"clientName"`
	SupplyType      models.SupplyType        `json:"supplyType"`
	TDSRate         float64                  `json:"tdsRate"`
	RetentionRate   float64                  `json:"retentionRate"`
	OtherDeductions float64                  `json:"otherDeductions"`
	Notes           *string                  `json:"notes"`
	Items           []clientBillItemRequest  `json:"items"`
}

func (r clientBillRequest) toModel() models.ClientBill {
	b := models.ClientBill{
		SiteProjectID:   r.SiteProjectID,
		BillDate:        r.BillDate,
		PeriodFrom:      r.PeriodFrom,
		PeriodTo:        r.PeriodTo,
		ClientName:      r.ClientName,
		SupplyType:      r.SupplyType,
		TDSRate:         decimal.NewFromFloat(r.TDSRate),
		RetentionRate:   decimal.NewFromFloat(r.RetentionRate),
		OtherDeductions: decimal.NewFromFloat(r.OtherDeductions),
		Notes:           r.Notes,
	}
	for i, item := range r.Items {
		b.Items = append(b.Items, models.ClientBillItem{
			Description:   item.Description,
			Unit:          item.Unit,
			ContractedQty: decimal.NewFromFloat(item.ContractedQty),
			PreviousQty:   decimal.NewFromFloat(item.PreviousQty),
			CurrentQty:    decimal.NewFromFloat(item.CurrentQty),
			Rate:          decimal.NewFromFloat(item.Rate),
			GSTRate:       decimal.NewFromFloat(item.GSTRate),
			Amount:        decimal.NewFromFloat(item.Amount),
			SortOrder:     i,
		})
	}
	return b
}

// GET /api/client-bills
func (h *ClientBillHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	projectID, _ := strconv.Atoi(r.URL.Query().Get("siteProjectId"))
	status := r.URL.Query().Get("status")
	bills, err := h.svc.GetAll(projectID, status)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Client bills retrieved", bills)
}

// GET /api/client-bills/{id}
func (h *ClientBillHandler) GetByID(w http.ResponseWriter, r *http.Request) {
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
	util.SendSuccess(w, "Client bill retrieved", b)
}

// POST /api/client-bills
func (h *ClientBillHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req clientBillRequest
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
	util.SendSuccess(w, "Client bill created", b)
}

// PUT /api/client-bills/{id}
func (h *ClientBillHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req clientBillRequest
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
	util.SendSuccess(w, "Client bill updated", b)
}

// PATCH /api/client-bills/{id}/status
func (h *ClientBillHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body struct {
		Status models.ClientBillStatus `json:"status"`
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

// POST /api/client-bills/{id}/payments
func (h *ClientBillHandler) AddPayment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body struct {
		Date      string  `json:"date"`
		Amount    float64 `json:"amount"`
		Mode      string  `json:"mode"`
		Reference *string `json:"reference"`
		Notes     *string `json:"notes"`
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
	p := models.ClientBillPayment{
		Date:      body.Date,
		Amount:    decimal.NewFromFloat(body.Amount),
		Mode:      body.Mode,
		Reference: body.Reference,
		Notes:     body.Notes,
	}
	b, err := h.svc.AddPayment(id, p, createdBy)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Payment recorded", b)
}

// DELETE /api/client-bills/{id}/payments/{paymentId}
func (h *ClientBillHandler) DeletePayment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	paymentID, err := strconv.Atoi(r.PathValue("paymentId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid paymentId")
		return
	}
	b, err := h.svc.DeletePayment(id, paymentID)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Payment deleted", b)
}

// DELETE /api/client-bills/{id}
func (h *ClientBillHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.svc.Delete(id); err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Client bill deleted", nil)
}
