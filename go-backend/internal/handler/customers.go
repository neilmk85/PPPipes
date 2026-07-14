package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type CustomerHandler struct {
	service *service.CustomerService
}

func NewCustomerHandler(cs *service.CustomerService) *CustomerHandler {
	return &CustomerHandler{service: cs}
}

// GetAll GET /api/customers
func (ch *CustomerHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	search := r.URL.Query().Get("search")
	var searchPtr *string
	if search != "" {
		searchPtr = &search
	}

	segment := r.URL.Query().Get("segment")
	var segmentPtr *string
	if segment != "" {
		segmentPtr = &segment
	}

	active := r.URL.Query().Get("active")
	var activePtr *bool
	if active != "" {
		a := active == "true"
		activePtr = &a
	}

	customers, total, err := ch.service.GetAll(page, size, searchPtr, segmentPtr, activePtr)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, customers, total, totalPages, size, page)
}

// GetInvoiceSummary GET /api/customers/invoice-summary?outletId=N
func (ch *CustomerHandler) GetInvoiceSummary(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil || outletId == 0 {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}
	rows, err := ch.service.GetInvoiceSummary(outletId)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Invoice summary retrieved", rows)
}

// GetByID GET /api/customers/{id}
func (ch *CustomerHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid customer ID")
		return
	}

	customer, err := ch.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Customer retrieved", customer)
}

// GetByPhone GET /api/customers/phone?q={phone}
func (ch *CustomerHandler) GetByPhone(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("q")
	if phone == "" {
		util.SendError(w, http.StatusBadRequest, "Phone number is required")
		return
	}

	customer, err := ch.service.GetByPhone(phone)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Customer retrieved", customer)
}

// Search GET /api/customers/search?q=...
func (ch *CustomerHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		util.SendError(w, http.StatusBadRequest, "Query parameter 'q' is required")
		return
	}

	customers, err := ch.service.Search(q)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Search completed", customers)
}

// GetWithDues GET /api/customers/with-dues
func (ch *CustomerHandler) GetWithDues(w http.ResponseWriter, r *http.Request) {
	customers, err := ch.service.GetWithDues()
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Customers with dues retrieved", customers)
}

// GetLoyaltyHistory GET /api/customers/{id}/loyalty-history
func (ch *CustomerHandler) GetLoyaltyHistory(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid customer ID")
		return
	}

	page, size := util.ParsePagination(r)

	transactions, total, err := ch.service.GetLoyaltyHistory(id, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, transactions, total, totalPages, size, page)
}

// Create POST /api/customers
func (ch *CustomerHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.Customer
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	customer, err := ch.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	// Log activity
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Customer created", "id", customer.ID, "name", customer.Name, "user", user.Email)

	util.SendSuccess(w, "Customer created", customer)
}

// Update PUT /api/customers/{id}
func (ch *CustomerHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid customer ID")
		return
	}

	var req models.Customer
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	customer, err := ch.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	// Log activity
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Customer updated", "id", customer.ID, "name", customer.Name, "user", user.Email)

	util.SendSuccess(w, "Customer updated", customer)
}

// ToggleActive PATCH /api/customers/{id}/toggle-active
func (ch *CustomerHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid customer ID")
		return
	}

	customer, err := ch.service.ToggleActive(id)
	if err != nil {
		handleError(w, err)
		return
	}

	status := "disabled"
	if customer.Active {
		status = "enabled"
	}
	util.SendSuccess(w, fmt.Sprintf("Customer %s", status), customer)
}

// ImportCSV POST /api/customers/import?dryRun=true|false
func (ch *CustomerHandler) ImportCSV(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		util.SendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	dryRun := r.URL.Query().Get("dryRun") == "true"

	// Parse multipart form (max 10 MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		util.SendError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "File is required")
		return
	}
	defer file.Close()

	result, err := ch.service.ImportFile(file, header.Filename, dryRun)
	if err != nil {
		handleError(w, err)
		return
	}

	msg := fmt.Sprintf("Imported %d customers", result.Created)
	if dryRun {
		msg = fmt.Sprintf("Preview: %d rows ready, %d errors", result.Created, result.Skipped)
	}
	util.SendSuccess(w, msg, result)
}

// ExportCSV GET /api/customers/export/csv
func (ch *CustomerHandler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	csv, err := ch.service.ExportCSV()
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=customers_export.csv")
	w.Header().Set("Content-Type", "text/csv")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(csv))
}

// ExportExcel GET /api/customers/export/excel
func (ch *CustomerHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	// For now, same as CSV export
	csv, err := ch.service.ExportCSV()
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=customers_export.csv")
	w.Header().Set("Content-Type", "text/csv")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(csv))
}
