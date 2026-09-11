package service

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type ProductService struct {
	db *gorm.DB
}

func NewProductService(db *gorm.DB) *ProductService {
	return &ProductService{db: db}
}

// GetAll returns paginated list of products with optional filtering
func (ps *ProductService) GetAll(page, size int, outletId *int, categoryId *int, search string, active *bool) (products []models.Product, total int64, err error) {
	query := ps.db

	if search != "" {
		query = query.Where("name LIKE ? OR sku LIKE ? OR barcode LIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	if categoryId != nil {
		query = query.Where("category_id = ?", *categoryId)
	}

	if active != nil {
		query = query.Where("is_active = ?", *active)
	}

	if err := query.Model(&models.Product{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Preload("Category").
		Preload("TaxGroup").
		Preload("Images").
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&products).Error

	return products, total, err
}

// GetByID returns a single product with all relations
func (ps *ProductService) GetByID(id int) (product *models.Product, err error) {
	product = &models.Product{}
	err = ps.db.
		Preload("Category").
		Preload("TaxGroup").
		Preload("Variants").
		Preload("Images").
		First(product, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Product with ID %d not found", id)}
	}
	return product, err
}

// Search returns products matching query on name, sku, or barcode.
// If purchasableOnly is true, only products with is_purchasable=1 are returned.
func (ps *ProductService) Search(query string, outletId *int, purchasableOnly bool) (products []models.Product, err error) {
	q := ps.db.Where("is_active = ? AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)",
		true, "%"+query+"%", "%"+query+"%", "%"+query+"%").
		Preload("Category").
		Preload("TaxGroup").
		Preload("Variants").
		Limit(30)

	if purchasableOnly {
		q = q.Where("is_purchasable = ?", true)
	}

	err = q.Find(&products).Error
	return products, err
}

// GetByBarcode returns a single product by barcode
func (ps *ProductService) GetByBarcode(barcode string) (product *models.Product, err error) {
	product = &models.Product{}
	err = ps.db.
		Where("barcode = ?", barcode).
		Preload("Category").
		Preload("TaxGroup").
		Preload("Variants").
		Preload("Images").
		First(product).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Product with barcode %s not found", barcode)}
	}
	return product, err
}

// GetByCategory returns paginated products in a category
func (ps *ProductService) GetByCategory(categoryId int, page, size int) (products []models.Product, total int64, err error) {
	query := ps.db.Where("category_id = ? AND is_active = ?", categoryId, true)

	if err := query.Model(&models.Product{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Preload("Category").
		Preload("TaxGroup").
		Preload("Variants").
		Offset(offset).
		Limit(size).
		Find(&products).Error

	return products, total, err
}

// GetLowStock returns products where inventory is below reorder level
func (ps *ProductService) GetLowStock(outletId int) (inventories []models.Inventory, err error) {
	err = ps.db.
		Where("outlet_id = ?", outletId).
		Preload("Product").
		Find(&inventories).Error
	if err != nil {
		return nil, err
	}

	// Filter items where quantity on hand <= reorder level
	var result []models.Inventory
	for _, inv := range inventories {
		var reorderLevel int
		if inv.ReorderLevel > 0 {
			reorderLevel = inv.ReorderLevel
		} else if inv.Product != nil && inv.Product.ReorderLevel > 0 {
			reorderLevel = inv.Product.ReorderLevel
		}

		if reorderLevel > 0 && inv.QuantityOnHand.LessThanOrEqual(decimal.NewFromInt(int64(reorderLevel))) {
			result = append(result, inv)
		}
	}

	return result, nil
}

// CreateProductDTO for product creation
type CreateProductDTO struct {
	Name               string          `json:"name"`
	Description        *string         `json:"description"`
	SKU                *string         `json:"sku"`
	Barcode            *string         `json:"barcode"`
	CategoryID         *int            `json:"categoryId"`
	TaxGroupID         *int            `json:"taxGroupId"`
	CostPrice          *decimal.Decimal `json:"costPrice"`
	SellingPrice       decimal.Decimal `json:"sellingPrice"`
	MRP                *decimal.Decimal `json:"mrp"`
	MinSellingPrice    *decimal.Decimal `json:"minSellingPrice"`
	HSNCode            *string         `json:"hsnCode"`
	UnitOfMeasure      string          `json:"unitOfMeasure"`
	PurchaseUOM        *string         `json:"purchaseUom"`
	SaleUOM            *string         `json:"saleUom"`
	PurchaseFactor     *decimal.Decimal `json:"purchaseFactor"`
	SaleFactor         *decimal.Decimal `json:"saleFactor"`
	ProductType        string          `json:"productType"`
	ItemType           string          `json:"itemType"`
	TrackInventory     bool            `json:"trackInventory"`
	AllowNegativeStock bool            `json:"allowNegativeStock"`
	ReorderLevel       int             `json:"reorderLevel"`
	Active             bool            `json:"active"`
	Featured           bool            `json:"featured"`
	CreatedBy          *string         `json:"createdBy"`
}

// Create creates a new product
func (ps *ProductService) Create(dto CreateProductDTO) (product *models.Product, err error) {
	// Treat empty strings as NULL for unique-indexed fields
	sku := dto.SKU
	if sku != nil && *sku == "" {
		sku = nil
	}
	barcode := dto.Barcode
	if barcode != nil && *barcode == "" {
		barcode = nil
	}
	desc := dto.Description
	if desc != nil && *desc == "" {
		desc = nil
	}

	product = &models.Product{
		Name:               dto.Name,
		Description:        desc,
		SKU:                sku,
		Barcode:            barcode,
		HSNCode:            dto.HSNCode,
		CategoryID:         dto.CategoryID,
		TaxGroupID:         dto.TaxGroupID,
		CostPrice:          dto.CostPrice,
		SellingPrice:       dto.SellingPrice,
		MRP:                dto.MRP,
		MinSellingPrice:    dto.MinSellingPrice,
		UnitOfMeasure:      dto.UnitOfMeasure,
		PurchaseUOM:        dto.PurchaseUOM,
		SaleUOM:            dto.SaleUOM,
		ProductType:        models.ProductType(dto.ProductType),
		ItemType:           dto.ItemType,
		TrackInventory:     dto.TrackInventory,
		AllowNegativeStock: dto.AllowNegativeStock,
		ReorderLevel:       dto.ReorderLevel,
		Active:             dto.Active,
		Featured:           dto.Featured,
		CreatedBy:          dto.CreatedBy,
	}

	if dto.PurchaseFactor != nil {
		product.PurchaseFactor = *dto.PurchaseFactor
	} else {
		product.PurchaseFactor = decimal.NewFromInt(1)
	}

	if dto.SaleFactor != nil {
		product.SaleFactor = *dto.SaleFactor
	} else {
		product.SaleFactor = decimal.NewFromInt(1)
	}

	err = ps.db.Create(product).Error
	if err != nil {
		return nil, err
	}

	return ps.GetByID(product.ID)
}

// Update updates an existing product
func (ps *ProductService) Update(id int, dto CreateProductDTO) (product *models.Product, err error) {
	product = &models.Product{}
	if err := ps.db.First(product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Product with ID %d not found", id)}
		}
		return nil, err
	}

	// Treat empty strings as NULL for unique-indexed fields
	sku := dto.SKU
	if sku != nil && *sku == "" {
		sku = nil
	}
	barcode := dto.Barcode
	if barcode != nil && *barcode == "" {
		barcode = nil
	}
	description := dto.Description
	if description != nil && *description == "" {
		description = nil
	}

	updates := map[string]interface{}{
		"name":                 dto.Name,
		"description":          description,
		"sku":                  sku,
		"barcode":              barcode,
		"hsn_code":             dto.HSNCode,
		"category_id":          dto.CategoryID,
		"tax_group_id":         dto.TaxGroupID,
		"cost_price":           dto.CostPrice,
		"selling_price":        dto.SellingPrice,
		"mrp":                  dto.MRP,
		"min_selling_price":    dto.MinSellingPrice,
		"unit_of_measure":      dto.UnitOfMeasure,
		"purchase_uom":         dto.PurchaseUOM,
		"sale_uom":             dto.SaleUOM,
		"product_type":         models.ProductType(dto.ProductType),
		"item_type":            dto.ItemType,
		"track_inventory":      dto.TrackInventory,
		"allow_negative_stock": dto.AllowNegativeStock,
		"reorder_level":        dto.ReorderLevel,
		"is_active":            dto.Active,
		"is_featured":          dto.Featured,
		"updated_by":           dto.CreatedBy,
	}

	if dto.PurchaseFactor != nil {
		updates["purchase_factor"] = *dto.PurchaseFactor
	}
	if dto.SaleFactor != nil {
		updates["sale_factor"] = *dto.SaleFactor
	}

	if err := ps.db.Model(product).Updates(updates).Error; err != nil {
		return nil, err
	}

	return ps.GetByID(id)
}

// ToggleActive toggles the active status of a product
func (ps *ProductService) ToggleActive(id int) (product *models.Product, err error) {
	product = &models.Product{}
	if err := ps.db.First(product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Product with ID %d not found", id)}
		}
		return nil, err
	}

	newActive := !product.Active
	if err := ps.db.Model(product).Update("is_active", newActive).Error; err != nil {
		return nil, err
	}

	product.Active = newActive
	return product, nil
}

// Delete soft deletes a product
func (ps *ProductService) Delete(id int) error {
	product := &models.Product{}
	if err := ps.db.First(product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Product with ID %d not found", id)}
		}
		return err
	}

	// Soft delete by setting active to false
	return ps.db.Model(product).Update("is_active", false).Error
}

// GenerateBarcode generates a unique barcode
func (ps *ProductService) GenerateBarcode() (barcode string, err error) {
	var attempts int
	for attempts < 10 {
		barcode, err = util.GenerateBarcode()
		if err != nil {
			return "", err
		}

		var existing models.Product
		if err := ps.db.Where("barcode = ?", barcode).First(&existing).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				break
			}
			return "", err
		}
		attempts++
	}

	if attempts >= 10 {
		return "", &util.BusinessException{Status: 500, Message: "Failed to generate unique barcode"}
	}

	return barcode, nil
}

// GetUnits returns list of unique units of measure
func (ps *ProductService) GetUnits() (units []string, err error) {
	var products []models.Product
	err = ps.db.
		Select("DISTINCT unit_of_measure").
		Where("unit_of_measure IS NOT NULL AND unit_of_measure != ''").
		Find(&products).Error

	unitMap := make(map[string]bool)
	for _, p := range products {
		if p.UnitOfMeasure != "" {
			unitMap[p.UnitOfMeasure] = true
		}
	}

	for unit := range unitMap {
		units = append(units, unit)
	}

	return units, err
}

// GetVariants returns variants for a product
func (ps *ProductService) GetVariants(productId int) (variants []models.ProductVariant, err error) {
	err = ps.db.Where("product_id = ?", productId).Order("created_at ASC").Find(&variants).Error
	return variants, err
}

// CreateVariantDTO for variant creation
type CreateVariantDTO struct {
	SKU               *string          `json:"sku"`
	Barcode           *string          `json:"barcode"`
	Attribute1Name    *string          `json:"attribute1Name"`
	Attribute1Value   *string          `json:"attribute1Value"`
	Attribute2Name    *string          `json:"attribute2Name"`
	Attribute2Value   *string          `json:"attribute2Value"`
	PriceAdjustment   *decimal.Decimal `json:"priceAdjustment"`
	CostPrice         *decimal.Decimal `json:"costPrice"`
	Name              *string          `json:"name"`
	Active            bool             `json:"active"`
	CreatedBy         *string          `json:"createdBy"`
}

// CreateVariant creates a new product variant
func (ps *ProductService) CreateVariant(productId int, dto CreateVariantDTO) (variant *models.ProductVariant, err error) {
	// Generate name from attributes
	name := "Variant"
	if dto.Name != nil && *dto.Name != "" {
		name = *dto.Name
	} else {
		var parts []string
		if dto.Attribute1Value != nil && *dto.Attribute1Value != "" {
			parts = append(parts, *dto.Attribute1Value)
		}
		if dto.Attribute2Value != nil && *dto.Attribute2Value != "" {
			parts = append(parts, *dto.Attribute2Value)
		}
		if len(parts) > 0 {
			name = strings.Join(parts, " / ")
		}
	}

	variant = &models.ProductVariant{
		ProductID:       productId,
		Name:            name,
		SKU:             dto.SKU,
		Barcode:         dto.Barcode,
		Attribute1Name:  dto.Attribute1Name,
		Attribute1Value: dto.Attribute1Value,
		Attribute2Name:  dto.Attribute2Name,
		Attribute2Value: dto.Attribute2Value,
		CostPrice:       dto.CostPrice,
		Active:          dto.Active,
		CreatedBy:       dto.CreatedBy,
	}

	if dto.PriceAdjustment != nil {
		variant.PriceAdjustment = *dto.PriceAdjustment
	} else {
		variant.PriceAdjustment = decimal.Zero
	}

	err = ps.db.Create(variant).Error
	return variant, err
}

// UpdateVariant updates an existing variant
func (ps *ProductService) UpdateVariant(productId, variantId int, dto CreateVariantDTO) (variant *models.ProductVariant, err error) {
	variant = &models.ProductVariant{}
	if err := ps.db.Where("id = ? AND product_id = ?", variantId, productId).First(variant).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Variant with ID %d not found", variantId)}
		}
		return nil, err
	}

	updates := make(map[string]interface{})

	// Update name from attributes if provided
	if dto.Attribute1Value != nil || dto.Attribute2Value != nil {
		var parts []string
		attr1 := dto.Attribute1Value
		if attr1 == nil {
			attr1 = variant.Attribute1Value
		}
		attr2 := dto.Attribute2Value
		if attr2 == nil {
			attr2 = variant.Attribute2Value
		}

		if attr1 != nil && *attr1 != "" {
			parts = append(parts, *attr1)
		}
		if attr2 != nil && *attr2 != "" {
			parts = append(parts, *attr2)
		}

		if len(parts) > 0 {
			updates["name"] = strings.Join(parts, " / ")
		}
	}

	if dto.Name != nil && *dto.Name != "" {
		updates["name"] = *dto.Name
	}
	if dto.SKU != nil {
		updates["sku"] = *dto.SKU
	}
	if dto.Barcode != nil {
		updates["barcode"] = *dto.Barcode
	}
	if dto.Attribute1Name != nil {
		updates["attribute1_name"] = *dto.Attribute1Name
	}
	if dto.Attribute1Value != nil {
		updates["attribute1_value"] = *dto.Attribute1Value
	}
	if dto.Attribute2Name != nil {
		updates["attribute2_name"] = *dto.Attribute2Name
	}
	if dto.Attribute2Value != nil {
		updates["attribute2_value"] = *dto.Attribute2Value
	}
	if dto.PriceAdjustment != nil {
		updates["price_adjustment"] = *dto.PriceAdjustment
	}
	if dto.CostPrice != nil {
		updates["cost_price"] = *dto.CostPrice
	}
	updates["is_active"] = dto.Active
	updates["updated_by"] = dto.CreatedBy

	if err := ps.db.Model(variant).Updates(updates).Error; err != nil {
		return nil, err
	}

	return variant, nil
}

// DeleteVariant deletes a variant
func (ps *ProductService) DeleteVariant(productId, variantId int) error {
	return ps.db.Where("id = ? AND product_id = ?", variantId, productId).Delete(&models.ProductVariant{}).Error
}

// GetImages returns images for a product
func (ps *ProductService) GetImages(productId int) (images []models.ProductImage, err error) {
	err = ps.db.Where("product_id = ?", productId).Order("display_order ASC").Find(&images).Error
	return images, err
}

// UploadImage saves an image file and creates product image record
func (ps *ProductService) UploadImage(productId int, file multipart.File, header *multipart.FileHeader, uploadsDir string) (image *models.ProductImage, err error) {
	if err := os.MkdirAll(uploadsDir, os.ModePerm); err != nil {
		return nil, err
	}

	// Generate unique filename
	filename := strconv.Itoa(productId) + "_" + header.Filename
	filepath := filepath.Join(uploadsDir, filename)

	out, err := os.Create(filepath)
	if err != nil {
		return nil, err
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		return nil, err
	}

	// Create database record
	image = &models.ProductImage{
		ProductID: productId,
		ImageURL:  "/uploads/" + filename,
		Primary:   false,
	}

	err = ps.db.Create(image).Error
	return image, err
}

// DeleteImage deletes an image and its file
func (ps *ProductService) DeleteImage(productId, imageId int, uploadsDir string) error {
	image := &models.ProductImage{}
	if err := ps.db.Where("id = ? AND product_id = ?", imageId, productId).First(image).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Image with ID %d not found", imageId)}
		}
		return err
	}

	// Delete file
	filename := strings.TrimPrefix(image.ImageURL, "/uploads/")
	filepath := filepath.Join(uploadsDir, filename)
	os.Remove(filepath)

	// Delete database record
	return ps.db.Delete(image).Error
}

// SetPrimaryImage sets an image as primary
func (ps *ProductService) SetPrimaryImage(productId, imageId int) error {
	// Unset all other images as primary
	if err := ps.db.Model(&models.ProductImage{}).
		Where("product_id = ? AND id != ?", productId, imageId).
		Update("is_primary", false).Error; err != nil {
		return err
	}

	// Set this image as primary
	return ps.db.Model(&models.ProductImage{}).
		Where("id = ? AND product_id = ?", imageId, productId).
		Update("is_primary", true).Error
}

// ExportCSV generates CSV data for products
func (ps *ProductService) ExportCSV(outletId int) (data []byte, err error) {
	var products []models.Product
	err = ps.db.
		Preload("Category").
		Preload("TaxGroup").
		Find(&products).Error
	if err != nil {
		return nil, err
	}

	var lines []string
	lines = append(lines, "name,sku,barcode,sellingPrice,costPrice,mrp,category,taxGroup,unitOfMeasure,active")

	for _, p := range products {
		categoryName := ""
		if p.Category != nil {
			categoryName = p.Category.Name
		}
		taxGroupName := ""
		if p.TaxGroup != nil {
			taxGroupName = p.TaxGroup.Name
		}

		sku := ""
		if p.SKU != nil {
			sku = *p.SKU
		}
		barcode := ""
		if p.Barcode != nil {
			barcode = *p.Barcode
		}
		costPrice := ""
		if p.CostPrice != nil {
			costPrice = p.CostPrice.String()
		}
		mrp := ""
		if p.MRP != nil {
			mrp = p.MRP.String()
		}

		line := fmt.Sprintf(`"%s","%s","%s",%s,%s,%s,"%s","%s","%s",%v`,
			p.Name, sku, barcode, p.SellingPrice.String(), costPrice, mrp, categoryName, taxGroupName, p.UnitOfMeasure, p.Active)
		lines = append(lines, line)
	}

	return []byte(strings.Join(lines, "\n")), nil
}

// GetImportTemplate returns CSV template headers
func (ps *ProductService) GetImportTemplate() string {
	return "name,sku,barcode,sellingPrice,costPrice,mrp,categoryName,taxGroupName,unitOfMeasure,description\n"
}
