package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type PurchaseOrderHandler struct {
	service *service.PurchaseOrderService
}

func NewPurchaseOrderHandler(pos *service.PurchaseOrderService) *PurchaseOrderHandler {
	return &PurchaseOrderHandler{service: pos}
}

// GetAll GET /api/purchase-orders
func (poh *PurchaseOrderHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	outletId := r.URL.Query().Get("outletId")
	var outletIdPtr *int
	if outletId != "" {
		if id, err := strconv.Atoi(outletId); err == nil {
			outletIdPtr = &id
		}
	}

	supplierId := r.URL.Query().Get("supplierId")
	var supplierIdPtr *int
	if supplierId != "" {
		if id, err := strconv.Atoi(supplierId); err == nil {
			supplierIdPtr = &id
		}
	}

	status := r.URL.Query().Get("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	var fromPtr, toPtr *time.Time
	if from := r.URL.Query().Get("from"); from != "" {
		if parsedDate, err := time.Parse("2006-01-02", from); err == nil {
			fromPtr = &parsedDate
		}
	}
	if to := r.URL.Query().Get("to"); to != "" {
		if parsedDate, err := time.Parse("2006-01-02", to); err == nil {
			toPtr = &parsedDate
		}
	}

	var searchPtr *string
	if q := r.URL.Query().Get("q"); q != "" {
		searchPtr = &q
	}

	var isDirectPtr *bool
	if isDirectStr := r.URL.Query().Get("isDirect"); isDirectStr != "" {
		v := isDirectStr == "true"
		isDirectPtr = &v
	}

	orders, total, err := poh.service.GetAll(page, size, outletIdPtr, supplierIdPtr, statusPtr, fromPtr, toPtr, searchPtr, isDirectPtr)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, orders, total, totalPages, size, page)
}

// GetByPONumber GET /api/purchase-orders/{poNumber}
func (poh *PurchaseOrderHandler) GetByPONumber(w http.ResponseWriter, r *http.Request) {
	poNumber := r.PathValue("poNumber")
	if poNumber == "" {
		util.SendError(w, http.StatusBadRequest, "PO number is required")
		return
	}

	order, err := poh.service.GetByPONumber(poNumber)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Purchase order retrieved", order)
}

// GetPublic GET /api/purchase-orders/public/{poNumber} — no auth required
func (poh *PurchaseOrderHandler) GetPublic(w http.ResponseWriter, r *http.Request) {
	poNumber := r.PathValue("poNumber")
	if poNumber == "" {
		util.SendError(w, http.StatusBadRequest, "PO number is required")
		return
	}

	order, err := poh.service.GetByPONumber(poNumber)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Purchase order retrieved", order)
}

// Create POST /api/purchase-orders
func (poh *PurchaseOrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req["createdBy"] = user.Email

	order, err := poh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Purchase order created", "id", order.ID, "poNumber", order.PONumber, "user", user.Email)
	util.SendSuccess(w, "Purchase order created", map[string]interface{}{
		"id":       order.ID,
		"poNumber": order.PONumber,
	})
}

// CreateDirect POST /api/purchase-orders/direct
func (poh *PurchaseOrderHandler) CreateDirect(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req["createdBy"] = user.Email

	order, err := poh.service.CreateDirect(req)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Direct purchase created", "id", order.ID, "poNumber", order.PONumber, "user", user.Email)
	util.SendSuccess(w, "Purchase recorded successfully", map[string]interface{}{
		"id":       order.ID,
		"poNumber": order.PONumber,
	})
}

// Update PUT /api/purchase-orders/{id}
func (poh *PurchaseOrderHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid purchase order ID")
		return
	}

	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req["updatedBy"] = user.Email

	order, err := poh.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Purchase order updated", "id", order.ID, "poNumber", order.PONumber, "user", user.Email)
	util.SendSuccess(w, "Purchase order updated", map[string]interface{}{
		"id":       order.ID,
		"poNumber": order.PONumber,
	})
}

// UpdateStatus PATCH /api/purchase-orders/{id}/status
func (poh *PurchaseOrderHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid purchase order ID")
		return
	}

	status := r.URL.Query().Get("status")
	if status == "" {
		util.SendError(w, http.StatusBadRequest, "Status query parameter is required")
		return
	}

	order, err := poh.service.UpdateStatus(id, status)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Status updated", map[string]interface{}{
		"id":     order.ID,
		"status": order.Status,
	})
}

// Delete DELETE /api/purchase-orders/{id}
func (poh *PurchaseOrderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid purchase order ID")
		return
	}

	err = poh.service.Delete(id)
	if err != nil {
		handleError(w, err)
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Purchase order deleted", "id", id, "user", user.Email)

	util.SendSuccess(w, "Purchase order deleted", map[string]int{"id": id})
}

// UpdateDirect PUT /api/purchase-orders/direct/{id}
func (poh *PurchaseOrderHandler) UpdateDirect(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid purchase order ID")
		return
	}

	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	order, err := poh.service.UpdateDirect(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Purchase updated", map[string]interface{}{
		"id":       order.ID,
		"poNumber": order.PONumber,
	})
}
