package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type QuotationService struct {
	db *gorm.DB
}

func NewQuotationService(db *gorm.DB) *QuotationService {
	return &QuotationService{db: db}
}

type QuotationCreateRequest struct {
	OutletID        int                    `json:"outletId"`
	CustomerID      *int                   `json:"customerId,omitempty"`
	ValidUntil      *time.Time             `json:"validUntil,omitempty"`
	Notes           *string                `json:"notes,omitempty"`
	TermsConditions *string                `json:"termsConditions,omitempty"`
	Items           []QuotationItemRequest `json:"items"`
}

type QuotationItemRequest struct {
	ProductID       *int             `json:"productId,omitempty"`
	ProductName     string           `json:"productName"`
	ProductSku      *string          `json:"productSku,omitempty"`
	Quantity        decimal.Decimal  `json:"quantity"`
	UnitPrice       decimal.Decimal  `json:"unitPrice"`
	DiscountPercent *decimal.Decimal `json:"discountPercent,omitempty"`
	TaxRate         *decimal.Decimal `json:"taxRate,omitempty"`
}

func (qs *QuotationService) Create(req QuotationCreateRequest) (*models.Quotation, error) {
	subtotal := decimal.Zero
	taxAmount := decimal.Zero
	discountAmount := decimal.Zero

	var quotationItems []models.QuotationItem

	for _, item := range req.Items {
		qty := item.Quantity
		price := item.UnitPrice
		discPct := decimal.Zero
		if item.DiscountPercent != nil {
			discPct = *item.DiscountPercent
		}
		taxRate := decimal.Zero
		if item.TaxRate != nil {
			taxRate = *item.TaxRate
		}

		lineSubtotal := qty.Mul(price)
		disc := lineSubtotal.Mul(discPct).Div(decimal.NewFromInt(100)).RoundBank(2)
		lineAfterDisc := lineSubtotal.Sub(disc)
		tax := lineAfterDisc.Mul(taxRate).Div(decimal.NewFromInt(100)).RoundBank(2)
		lineTotal := lineAfterDisc.Add(tax)

		subtotal = subtotal.Add(lineSubtotal)
		discountAmount = discountAmount.Add(disc)
		taxAmount = taxAmount.Add(tax)

		quotationItems = append(quotationItems, models.QuotationItem{
			ProductID:       item.ProductID,
			ProductName:     item.ProductName,
			ProductSKU:      item.ProductSku,
			Quantity:        qty,
			UnitPrice:       price,
			DiscountPercent: discPct,
			TaxRate:         taxRate,
			LineTotal:       lineTotal,
		})
	}

	totalAmount := subtotal.Sub(discountAmount).Add(taxAmount)

	quotationNum, err := util.GenerateQuotationNumber(qs.db)
	if err != nil {
		return nil, err
	}

	quotation := &models.Quotation{
		QuotationNumber: quotationNum,
		OutletID:        req.OutletID,
		CustomerID:      req.CustomerID,
		ValidUntil:      req.ValidUntil,
		Notes:           req.Notes,
		TermsConditions: req.TermsConditions,
		Subtotal:        subtotal,
		DiscountAmount:  discountAmount,
		TaxAmount:       taxAmount,
		TotalAmount:     totalAmount,
		Status:          models.QuotationStatusDraft,
		Items:           quotationItems,
	}

	if err := qs.db.Create(quotation).Error; err != nil {
		return nil, err
	}

	return quotation, nil
}

func (qs *QuotationService) GetByID(id int) (*models.Quotation, error) {
	quotation := &models.Quotation{}
	err := qs.db.Preload("Items").Preload("Items.Product").
		Preload("Customer").Preload("Outlet").
		First(quotation, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Quotation with ID %d not found", id)}
	}

	return quotation, err
}

func (qs *QuotationService) GetAll(outletId int, status *string, page, size int) ([]models.Quotation, int64, error) {
	query := qs.db.Where("outlet_id = ?", outletId)

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	var quotations []models.Quotation
	var total int64

	if err := query.Model(&models.Quotation{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.Preload("Items").Preload("Customer").
		Order("created_at DESC").
		Offset(offset).Limit(size).
		Find(&quotations).Error

	return quotations, total, err
}

func (qs *QuotationService) Update(id int, req QuotationCreateRequest) (*models.Quotation, error) {
	quotation := &models.Quotation{}
	if err := qs.db.First(quotation, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Quotation with ID %d not found", id)}
		}
		return nil, err
	}

	if quotation.Status != models.QuotationStatusDraft {
		return nil, &util.BusinessException{Message: "Only DRAFT quotations can be updated"}
	}

	// Delete existing items
	if err := qs.db.Where("quotation_id = ?", id).Delete(&models.QuotationItem{}).Error; err != nil {
		return nil, err
	}

	subtotal := decimal.Zero
	taxAmount := decimal.Zero
	discountAmount := decimal.Zero
	var quotationItems []models.QuotationItem

	for _, item := range req.Items {
		qty := item.Quantity
		price := item.UnitPrice
		discPct := decimal.Zero
		if item.DiscountPercent != nil {
			discPct = *item.DiscountPercent
		}
		taxRate := decimal.Zero
		if item.TaxRate != nil {
			taxRate = *item.TaxRate
		}

		lineSubtotal := qty.Mul(price)
		disc := lineSubtotal.Mul(discPct).Div(decimal.NewFromInt(100)).RoundBank(2)
		lineAfterDisc := lineSubtotal.Sub(disc)
		tax := lineAfterDisc.Mul(taxRate).Div(decimal.NewFromInt(100)).RoundBank(2)
		lineTotal := lineAfterDisc.Add(tax)

		subtotal = subtotal.Add(lineSubtotal)
		discountAmount = discountAmount.Add(disc)
		taxAmount = taxAmount.Add(tax)

		quotationItems = append(quotationItems, models.QuotationItem{
			ProductID:       item.ProductID,
			ProductName:     item.ProductName,
			ProductSKU:      item.ProductSku,
			Quantity:        qty,
			UnitPrice:       price,
			DiscountPercent: discPct,
			TaxRate:         taxRate,
			LineTotal:       lineTotal,
		})
	}

	totalAmount := subtotal.Sub(discountAmount).Add(taxAmount)

	updates := map[string]interface{}{
		"customer_id":       req.CustomerID,
		"valid_until":       req.ValidUntil,
		"notes":             req.Notes,
		"terms_conditions":  req.TermsConditions,
		"subtotal":          subtotal,
		"discount_amount":   discountAmount,
		"tax_amount":        taxAmount,
		"total_amount":      totalAmount,
	}

	if err := qs.db.Model(quotation).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Create new items
	for _, item := range quotationItems {
		item.QuotationID = id
		if err := qs.db.Create(&item).Error; err != nil {
			return nil, err
		}
	}

	return qs.GetByID(id)
}

func (qs *QuotationService) UpdateStatus(id int, status string) (*models.Quotation, error) {
	quotation := &models.Quotation{}
	if err := qs.db.Model(quotation).Where("id = ?", id).Update("status", status).Error; err != nil {
		return nil, err
	}

	return qs.GetByID(id)
}

func (qs *QuotationService) PeekNextNumber() (string, error) {
	return util.PeekNextQuotationNumber(qs.db)
}

func (qs *QuotationService) Delete(id int) error {
	quotation := &models.Quotation{}
	if err := qs.db.First(quotation, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Quotation with ID %d not found", id)}
		}
		return err
	}

	if quotation.Status != models.QuotationStatusDraft {
		return &util.BusinessException{Message: "Only DRAFT quotations can be deleted"}
	}

	return qs.db.Delete(quotation).Error
}
