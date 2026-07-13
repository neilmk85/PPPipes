package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type InvoiceHandler struct {
	service *service.InvoiceService
}

func NewInvoiceHandler(is *service.InvoiceService) *InvoiceHandler {
	return &InvoiceHandler{service: is}
}

func (ih *InvoiceHandler) GetPublic(w http.ResponseWriter, r *http.Request) {
	invoiceNumber := r.PathValue("invoiceNumber")
	if invoiceNumber == "" {
		util.SendError(w, http.StatusBadRequest, "Invoice number is required")
		return
	}

	invoice, err := ih.service.GetByInvoiceNumber(invoiceNumber)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Invoice retrieved", invoice)
}

func (ih *InvoiceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.InvoiceCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Auto-flag for printing if the creating user is currently out of office
	if authUser := middleware.GetUser(r); authUser != nil {
		req.PrintNeeded = ih.service.IsUserOutOfOffice(authUser.ID)
	}

	invoice, err := ih.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Invoice created", invoice)
}

func (ih *InvoiceHandler) GetPrintQueue(w http.ResponseWriter, r *http.Request) {
	authUser := middleware.GetUser(r)
	var outletID *int
	if authUser != nil {
		outletID = authUser.OutletID
	}
	invoices, err := ih.service.GetPrintQueue(outletID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Print queue retrieved", invoices)
}

func (ih *InvoiceHandler) MarkPrinted(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}
	invoice, err := ih.service.MarkPrinted(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Invoice marked as printed", invoice)
}

func (ih *InvoiceHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	outletIdStr := r.URL.Query().Get("outletId")
	if outletIdStr == "" {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}

	outletId, err := strconv.Atoi(outletIdStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	page, size := util.ParsePagination(r)

	statusStr := r.URL.Query().Get("status")
	var status *string
	if statusStr != "" {
		status = &statusStr
	}

	fromStr := r.URL.Query().Get("fromDate")
	toStr := r.URL.Query().Get("toDate")
	var from, to *time.Time
	if fromStr != "" {
		t, err := time.Parse(time.RFC3339, fromStr)
		if err == nil {
			from = &t
		}
	}
	if toStr != "" {
		t, err := time.Parse(time.RFC3339, toStr+"T23:59:59Z")
		if err == nil {
			to = &t
		}
	}

	var customerID *int
	if v := r.URL.Query().Get("customerId"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			customerID = &id
		}
	}

	invoices, total, err := ih.service.GetAll(outletId, status, from, to, page, size, customerID)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, invoices, total, totalPages, size, page)
}

func (ih *InvoiceHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	invoice, err := ih.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Invoice retrieved", invoice)
}

func (ih *InvoiceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	var req service.InvoiceCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	invoice, err := ih.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Invoice updated", invoice)
}

func (ih *InvoiceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	err = ih.service.Delete(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Invoice deleted", nil)
}

func (ih *InvoiceHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	statusStr := r.URL.Query().Get("status")
	if statusStr == "" {
		util.SendError(w, http.StatusBadRequest, "status parameter is required")
		return
	}

	invoice, err := ih.service.UpdateStatus(id, statusStr)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Status updated", invoice)
}

func (ih *InvoiceHandler) RecordPayment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	amountStr := r.URL.Query().Get("amount")
	if amountStr == "" {
		util.SendError(w, http.StatusBadRequest, "amount parameter is required")
		return
	}

	amount, err := decimal.NewFromString(amountStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid amount")
		return
	}

	invoice, err := ih.service.RecordPayment(id, amount)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Payment recorded", invoice)
}

func (ih *InvoiceHandler) PeekNextNumber(w http.ResponseWriter, r *http.Request) {
	next, err := ih.service.PeekNextNumber()
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Next invoice number", map[string]string{"nextNumber": next})
}

func (ih *InvoiceHandler) SendEmail(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err = ih.service.SendEmail(id, body.Email)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Invoice email sent", nil)
}
