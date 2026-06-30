package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type QuotationHandler struct {
	service *service.QuotationService
}

func NewQuotationHandler(qs *service.QuotationService) *QuotationHandler {
	return &QuotationHandler{service: qs}
}

func (qh *QuotationHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.QuotationCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	quotation, err := qh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Quotation created", quotation)
}

func (qh *QuotationHandler) GetAll(w http.ResponseWriter, r *http.Request) {
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

	quotations, total, err := qh.service.GetAll(outletId, status, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, quotations, total, totalPages, size, page)
}

func (qh *QuotationHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid quotation ID")
		return
	}

	quotation, err := qh.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Quotation retrieved", quotation)
}

func (qh *QuotationHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid quotation ID")
		return
	}

	var req service.QuotationCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	quotation, err := qh.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Quotation updated", quotation)
}

func (qh *QuotationHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid quotation ID")
		return
	}

	statusStr := r.URL.Query().Get("status")
	if statusStr == "" {
		util.SendError(w, http.StatusBadRequest, "status parameter is required")
		return
	}

	quotation, err := qh.service.UpdateStatus(id, statusStr)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Status updated", quotation)
}

func (qh *QuotationHandler) PeekNextNumber(w http.ResponseWriter, r *http.Request) {
	next, err := qh.service.PeekNextNumber()
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Next quotation number", map[string]string{"nextNumber": next})
}

func (qh *QuotationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid quotation ID")
		return
	}

	err = qh.service.Delete(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Quotation deleted", nil)
}
