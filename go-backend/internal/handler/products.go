package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ProductHandler struct {
	service    *service.ProductService
	uploadsDir string
	maxFileSize int64
}

func NewProductHandler(ps *service.ProductService, uploadsDir string, maxFileSize int64) *ProductHandler {
	return &ProductHandler{
		service:     ps,
		uploadsDir:  uploadsDir,
		maxFileSize: maxFileSize,
	}
}

func (ph *ProductHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	outletId := r.URL.Query().Get("outletId")
	var outletIdPtr *int
	if outletId != "" {
		if id, err := strconv.Atoi(outletId); err == nil {
			outletIdPtr = &id
		}
	}

	categoryId := r.URL.Query().Get("categoryId")
	var categoryIdPtr *int
	if categoryId != "" {
		if id, err := strconv.Atoi(categoryId); err == nil {
			categoryIdPtr = &id
		}
	}

	search := r.URL.Query().Get("search")

	active := r.URL.Query().Get("active")
	var activePtr *bool
	if active != "" {
		a := active == "true"
		activePtr = &a
	}

	products, total, err := ph.service.GetAll(page, size, outletIdPtr, categoryIdPtr, search, activePtr)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, products, total, totalPages, size, page)
}

func (ph *ProductHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	product, err := ph.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Product retrieved", product)
}

func (ph *ProductHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		util.SendError(w, http.StatusBadRequest, "Query parameter 'q' is required")
		return
	}

	outletId := r.URL.Query().Get("outletId")
	var outletIdPtr *int
	if outletId != "" {
		if id, err := strconv.Atoi(outletId); err == nil {
			outletIdPtr = &id
		}
	}

	purchasableOnly := r.URL.Query().Get("purchasable") == "true"

	products, err := ph.service.Search(q, outletIdPtr, purchasableOnly)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Products found", products)
}

func (ph *ProductHandler) GetByBarcode(w http.ResponseWriter, r *http.Request) {
	barcode := r.PathValue("barcode")
	if barcode == "" {
		util.SendError(w, http.StatusBadRequest, "Barcode is required")
		return
	}

	product, err := ph.service.GetByBarcode(barcode)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Product retrieved", product)
}

func (ph *ProductHandler) GetByCategory(w http.ResponseWriter, r *http.Request) {
	categoryId, err := strconv.Atoi(r.PathValue("categoryId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	page, size := util.ParsePagination(r)
	products, total, err := ph.service.GetByCategory(categoryId, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, products, total, totalPages, size, page)
}

func (ph *ProductHandler) GetLowStock(w http.ResponseWriter, r *http.Request) {
	outletId := r.URL.Query().Get("outletId")
	if outletId == "" {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}

	id, err := strconv.Atoi(outletId)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	inventories, err := ph.service.GetLowStock(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Low stock items retrieved", inventories)
}

func (ph *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var dto service.CreateProductDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email

	product, err := ph.service.Create(dto)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Product created", product)
}

func (ph *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var dto service.CreateProductDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email

	product, err := ph.service.Update(id, dto)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Product updated", product)
}

func (ph *ProductHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	product, err := ph.service.ToggleActive(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Product status toggled", product)
}

func (ph *ProductHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	if err := ph.service.Delete(id); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Product deleted", nil)
}

func (ph *ProductHandler) GenerateBarcode(w http.ResponseWriter, r *http.Request) {
	barcode, err := ph.service.GenerateBarcode()
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Barcode generated", map[string]string{"barcode": barcode})
}

func (ph *ProductHandler) GetUnits(w http.ResponseWriter, r *http.Request) {
	units, err := ph.service.GetUnits()
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Units retrieved", units)
}

func (ph *ProductHandler) GetImportTemplate(w http.ResponseWriter, r *http.Request) {
	template := ph.service.GetImportTemplate()
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=products_template.csv")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(template))
}

func (ph *ProductHandler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	outletId := r.URL.Query().Get("outletId")
	if outletId == "" {
		outletId = "0"
	}

	id, err := strconv.Atoi(outletId)
	if err != nil {
		id = 0
	}

	data, err := ph.service.ExportCSV(id)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=products_export.csv")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func (ph *ProductHandler) GetVariants(w http.ResponseWriter, r *http.Request) {
	productId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	variants, err := ph.service.GetVariants(productId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Variants retrieved", variants)
}

func (ph *ProductHandler) CreateVariant(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	productId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var dto service.CreateVariantDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email

	variant, err := ph.service.CreateVariant(productId, dto)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Variant created", variant)
}

func (ph *ProductHandler) UpdateVariant(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	productId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	variantId, err := strconv.Atoi(r.PathValue("variantId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid variant ID")
		return
	}

	var dto service.CreateVariantDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email

	variant, err := ph.service.UpdateVariant(productId, variantId, dto)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Variant updated", variant)
}

func (ph *ProductHandler) DeleteVariant(w http.ResponseWriter, r *http.Request) {
	productId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	variantId, err := strconv.Atoi(r.PathValue("variantId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid variant ID")
		return
	}

	if err := ph.service.DeleteVariant(productId, variantId); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Variant deleted", nil)
}

func (ph *ProductHandler) GetImages(w http.ResponseWriter, r *http.Request) {
	productId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	images, err := ph.service.GetImages(productId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Images retrieved", images)
}

func (ph *ProductHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	productId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	if err := r.ParseMultipartForm(ph.maxFileSize); err != nil {
		util.SendError(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	image, err := ph.service.UploadImage(productId, file, header, ph.uploadsDir)
	if err != nil {
		slog.Error("Failed to upload image", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to upload image")
		return
	}

	util.SendSuccess(w, "Image uploaded", image)
}

func (ph *ProductHandler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	productId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	imageId, err := strconv.Atoi(r.PathValue("imageId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid image ID")
		return
	}

	if err := ph.service.DeleteImage(productId, imageId, ph.uploadsDir); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Image deleted", nil)
}

func (ph *ProductHandler) SetPrimaryImage(w http.ResponseWriter, r *http.Request) {
	productId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	imageId, err := strconv.Atoi(r.PathValue("imageId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid image ID")
		return
	}

	if err := ph.service.SetPrimaryImage(productId, imageId); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Primary image set", nil)
}
