package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type InvoiceService struct {
	db *gorm.DB
}

func NewInvoiceService(db *gorm.DB) *InvoiceService {
	return &InvoiceService{db: db}
}

type InvoiceCreateRequest struct {
	OutletID         int                   `json:"outletId"`
	CustomerID       *int                  `json:"customerId,omitempty"`
	OrderID          *int                  `json:"orderId,omitempty"`
	IssueDate        *time.Time            `json:"issueDate,omitempty"`
	DueDate          *time.Time            `json:"dueDate,omitempty"`
	PaymentTerms     *string               `json:"paymentTerms,omitempty"`
	PONumber          *string               `json:"poNumber,omitempty"`
	DeliveryChallanNo *string               `json:"deliveryChallanNo,omitempty"`
	EWayBillNo        *string               `json:"eWayBillNo,omitempty"`
	EInvoiceNo        *string               `json:"eInvoiceNo,omitempty"`
	ShippingAmount    *decimal.Decimal      `json:"shippingAmount,omitempty"`
	Notes            *string               `json:"notes,omitempty"`
	TermsConditions  *string               `json:"termsConditions,omitempty"`
	BillDiscountPct  *decimal.Decimal      `json:"billDiscountPct,omitempty"`
	Items            []InvoiceItemRequest  `json:"items"`
	PrintNeeded      bool                  `json:"-"` // set by handler, not from client
}

type InvoiceItemRequest struct {
	ProductID       *int             `json:"productId,omitempty"`
	ProductName     string           `json:"productName"`
	ProductSKU      *string          `json:"productSku,omitempty"`
	Quantity        decimal.Decimal  `json:"quantity"`
	UnitPrice       decimal.Decimal  `json:"unitPrice"`
	DiscountPercent *decimal.Decimal `json:"discountPercent,omitempty"`
	TaxRate         *decimal.Decimal `json:"taxRate,omitempty"`
}

func (is *InvoiceService) CreateFromOrder(orderId int) (*models.Invoice, error) {
	order := &models.Order{}
	if err := is.db.Preload("Items").Preload("Items.Product").
		Preload("Customer").Preload("Outlet").
		First(order, orderId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Order with ID %d not found", orderId)}
		}
		return nil, err
	}

	invoiceNum, err := util.GenerateInvoiceNumber(is.db)
	if err != nil {
		return nil, err
	}

	invoice := &models.Invoice{
		InvoiceNumber: invoiceNum,
		OrderID:       &order.ID,
		CustomerID:    order.CustomerID,
		OutletID:      order.OutletID,
		IssueDate:     time.Now(),
		Status:        models.InvoiceStatusPaid,
		Subtotal:      order.Subtotal,
		DiscountAmount: order.DiscountAmount,
		TaxAmount:     order.TaxAmount,
		TotalAmount:   order.TotalAmount,
		PaidAmount:    order.PaidAmount,
	}

	// Create invoice items from order items
	for _, item := range order.Items {
		pid := item.ProductID
		invoiceItem := models.InvoiceItem{
			ProductID:       &pid,
			ProductName:     item.ProductName,
			ProductSKU:      item.SKU,
			Quantity:        item.Quantity,
			UnitPrice:       item.UnitPrice,
			TaxRate:         item.TaxRate,
			LineTotal:       item.LineTotal,
		}

		if item.Quantity.GreaterThan(decimal.Zero) {
			discPct := item.DiscountAmount.Div(item.Quantity).Div(item.UnitPrice).Mul(decimal.NewFromInt(100)).RoundBank(2)
			invoiceItem.DiscountPercent = discPct
		}

		invoice.Items = append(invoice.Items, invoiceItem)
	}

	if err := is.db.Create(invoice).Error; err != nil {
		return nil, err
	}

	return invoice, nil
}

func (is *InvoiceService) Create(req InvoiceCreateRequest) (*models.Invoice, error) {
	if len(req.Items) == 0 {
		return nil, &util.BusinessException{Message: "At least one item required"}
	}

	subtotal := decimal.Zero
	taxAmount := decimal.Zero
	discountAmount := decimal.Zero

	var invoiceItems []models.InvoiceItem

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

		invoiceItems = append(invoiceItems, models.InvoiceItem{
			ProductID:       item.ProductID,
			ProductName:     item.ProductName,
			ProductSKU:      item.ProductSKU,
			Quantity:        qty,
			UnitPrice:       price,
			DiscountPercent: discPct,
			TaxRate:         taxRate,
			LineTotal:       lineTotal,
		})
	}

	// Apply bill-level discount
	billDiscPct := decimal.Zero
	if req.BillDiscountPct != nil {
		billDiscPct = *req.BillDiscountPct
	}
	billDiscAmt := subtotal.Sub(discountAmount).Mul(billDiscPct).Div(decimal.NewFromInt(100)).RoundBank(2)
	discountAmount = discountAmount.Add(billDiscAmt)

	shippingAmount := decimal.Zero
	if req.ShippingAmount != nil {
		shippingAmount = *req.ShippingAmount
	}

	totalAmount := subtotal.Sub(discountAmount).Add(taxAmount).Add(shippingAmount)

	invoiceNum, err := util.GenerateInvoiceNumber(is.db)
	if err != nil {
		return nil, err
	}

	issueDate := time.Now()
	if req.IssueDate != nil {
		issueDate = *req.IssueDate
	}

	invoice := &models.Invoice{
		InvoiceNumber:     invoiceNum,
		OutletID:          req.OutletID,
		CustomerID:        req.CustomerID,
		OrderID:           req.OrderID,
		IssueDate:         issueDate,
		DueDate:           req.DueDate,
		PaymentTerms:      req.PaymentTerms,
		PONumber:          req.PONumber,
		DeliveryChallanNo: req.DeliveryChallanNo,
		EWayBillNo:        req.EWayBillNo,
		EInvoiceNo:        req.EInvoiceNo,
		ShippingAmount:    shippingAmount,
		Notes:             req.Notes,
		TermsConditions:   req.TermsConditions,
		BillDiscountPct:   billDiscPct,
		BillDiscountAmt:   billDiscAmt,
		Subtotal:          subtotal,
		DiscountAmount:    discountAmount,
		TaxAmount:         taxAmount,
		TotalAmount:       totalAmount,
		Status:            models.InvoiceStatusDraft,
		PrintNeeded:       req.PrintNeeded,
		Items:             invoiceItems,
	}

	if err := is.db.Create(invoice).Error; err != nil {
		return nil, err
	}

	return invoice, nil
}

func (is *InvoiceService) GetByID(id int) (*models.Invoice, error) {
	invoice := &models.Invoice{}
	err := is.db.Preload("Items").Preload("Items.Product").
		Preload("Customer").Preload("Outlet").Preload("Order").
		First(invoice, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Invoice with ID %d not found", id)}
	}

	return invoice, err
}

func (is *InvoiceService) GetByInvoiceNumber(invoiceNumber string) (*models.Invoice, error) {
	invoice := &models.Invoice{}
	err := is.db.Preload("Items").Preload("Items.Product").
		Preload("Customer").Preload("Outlet").
		Where("invoice_number = ?", invoiceNumber).First(invoice).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Invoice not found: %s", invoiceNumber)}
	}

	return invoice, err
}

func (is *InvoiceService) GetAll(outletId int, status *string, fromDate, toDate *time.Time, page, size int, customerID *int) ([]models.Invoice, int64, error) {
	query := is.db.Where("outlet_id = ?", outletId)

	if customerID != nil {
		query = query.Where("customer_id = ?", *customerID)
	}

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if fromDate != nil || toDate != nil {
		if fromDate != nil && toDate != nil {
			query = query.Where("issue_date >= ? AND issue_date <= ?", fromDate, toDate)
		} else if fromDate != nil {
			query = query.Where("issue_date >= ?", fromDate)
		} else if toDate != nil {
			query = query.Where("issue_date <= ?", toDate)
		}
	}

	var invoices []models.Invoice
	var total int64

	if err := query.Model(&models.Invoice{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.Preload("Items").Preload("Customer").
		Order("created_at DESC").
		Offset(offset).Limit(size).
		Find(&invoices).Error

	return invoices, total, err
}

func (is *InvoiceService) Update(id int, req InvoiceCreateRequest) (*models.Invoice, error) {
	invoice := &models.Invoice{}
	if err := is.db.First(invoice, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Invoice with ID %d not found", id)}
		}
		return nil, err
	}

	if invoice.Status != models.InvoiceStatusDraft {
		return nil, &util.BusinessException{Message: "Only DRAFT invoices can be updated"}
	}

	// Delete existing items
	if err := is.db.Where("invoice_id = ?", id).Delete(&models.InvoiceItem{}).Error; err != nil {
		return nil, err
	}

	subtotal := decimal.Zero
	taxAmount := decimal.Zero
	discountAmount := decimal.Zero
	var invoiceItems []models.InvoiceItem

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

		invoiceItems = append(invoiceItems, models.InvoiceItem{
			ProductID:       item.ProductID,
			ProductName:     item.ProductName,
			ProductSKU:      item.ProductSKU,
			Quantity:        qty,
			UnitPrice:       price,
			DiscountPercent: discPct,
			TaxRate:         taxRate,
			LineTotal:       lineTotal,
		})
	}

	billDiscPct := decimal.Zero
	if req.BillDiscountPct != nil {
		billDiscPct = *req.BillDiscountPct
	}
	billDiscAmt := subtotal.Sub(discountAmount).Mul(billDiscPct).Div(decimal.NewFromInt(100)).RoundBank(2)
	discountAmount = discountAmount.Add(billDiscAmt)

	shippingAmount := decimal.Zero
	if req.ShippingAmount != nil {
		shippingAmount = *req.ShippingAmount
	}

	totalAmount := subtotal.Sub(discountAmount).Add(taxAmount).Add(shippingAmount)

	updates := map[string]interface{}{
		"customer_id":        req.CustomerID,
		"issue_date":         req.IssueDate,
		"due_date":           req.DueDate,
		"payment_terms":      req.PaymentTerms,
		"po_number":           req.PONumber,
		"delivery_challan_no": req.DeliveryChallanNo,
		"e_way_bill_no":       req.EWayBillNo,
		"e_invoice_no":        req.EInvoiceNo,
		"shipping_amount":     shippingAmount,
		"notes":              req.Notes,
		"terms_conditions":   req.TermsConditions,
		"bill_discount_pct":  billDiscPct,
		"bill_discount_amt":  billDiscAmt,
		"subtotal":           subtotal,
		"discount_amount":    discountAmount,
		"tax_amount":         taxAmount,
		"total_amount":       totalAmount,
	}

	if err := is.db.Model(invoice).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Create new items
	for _, item := range invoiceItems {
		item.InvoiceID = id
		if err := is.db.Create(&item).Error; err != nil {
			return nil, err
		}
	}

	return invoice, nil
}

func (is *InvoiceService) Delete(id int) error {
	invoice := &models.Invoice{}
	if err := is.db.First(invoice, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Invoice with ID %d not found", id)}
		}
		return err
	}

	if invoice.Status != models.InvoiceStatusDraft {
		return &util.BusinessException{Message: "Only DRAFT invoices can be deleted"}
	}

	return is.db.Delete(invoice).Error
}

func (is *InvoiceService) UpdateStatus(id int, status string) (*models.Invoice, error) {
	invoice := &models.Invoice{}
	if err := is.db.Model(invoice).Where("id = ?", id).Update("status", status).Error; err != nil {
		return nil, err
	}

	return is.GetByID(id)
}

func (is *InvoiceService) RecordPayment(id int, amount decimal.Decimal) (*models.Invoice, error) {
	invoice := &models.Invoice{}
	if err := is.db.First(invoice, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Invoice with ID %d not found", id)}
		}
		return nil, err
	}

	newPaid := invoice.PaidAmount.Add(amount)
	newStatus := models.InvoiceStatusSent
	if newPaid.GreaterThanOrEqual(invoice.TotalAmount) {
		newStatus = models.InvoiceStatusPaid
	} else if newPaid.GreaterThan(decimal.Zero) {
		newStatus = models.InvoiceStatusPartial
	}

	if err := is.db.Model(invoice).Updates(map[string]interface{}{
		"paid_amount": newPaid,
		"status":      newStatus,
	}).Error; err != nil {
		return nil, err
	}

	return is.GetByID(id)
}

// PeekNextNumber reads the current invoice_sequence value without consuming it
// and returns the number that would be assigned to the next invoice created today.
func (is *InvoiceService) PeekNextNumber() (string, error) {
	var seq util.Sequence
	err := is.db.Where("name = ?", "invoice_sequence").First(&seq).Error
	if err == gorm.ErrRecordNotFound {
		// No invoices created yet — sequence starts at 1
		return fmt.Sprintf("INV-%s-1", time.Now().Format("20060102")), nil
	}
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("INV-%s-%d", time.Now().Format("20060102"), seq.Value+1), nil
}

func (is *InvoiceService) SendEmail(id int, email string) error {
	invoice := &models.Invoice{}
	if err := is.db.First(invoice, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Invoice with ID %d not found", id)}
		}
		return err
	}

	// TODO: Integrate with email service
	return nil
}

func (is *InvoiceService) GetPrintQueue(outletID *int) ([]models.Invoice, error) {
	var invoices []models.Invoice
	q := is.db.Preload("Customer").Preload("Items").Where("print_needed = true AND printed_at IS NULL")
	if outletID != nil {
		q = q.Where("outlet_id = ?", *outletID)
	}
	if err := q.Order("created_at DESC").Find(&invoices).Error; err != nil {
		return nil, err
	}
	return invoices, nil
}

func (is *InvoiceService) MarkPrinted(id int) (*models.Invoice, error) {
	now := time.Now()
	if err := is.db.Model(&models.Invoice{}).Where("id = ?", id).
		Updates(map[string]interface{}{"printed_at": now}).Error; err != nil {
		return nil, err
	}
	return is.GetByID(id)
}

func (is *InvoiceService) IsUserOutOfOffice(userID int) bool {
	var user models.User
	if err := is.db.Select("out_of_office").First(&user, userID).Error; err != nil {
		return false
	}
	return user.OutOfOffice
}
