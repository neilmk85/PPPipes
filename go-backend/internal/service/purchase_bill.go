package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PurchaseBillService struct {
	db *gorm.DB
}

func NewPurchaseBillService(db *gorm.DB) *PurchaseBillService {
	return &PurchaseBillService{db: db}
}

// GetAll returns paginated list of purchase bills with filtering
func (pbs *PurchaseBillService) GetAll(page, size int, outletId *int, supplierId *int, status *string, from, to *time.Time) (bills []models.PurchaseBill, total int64, err error) {
	query := pbs.db

	if outletId != nil {
		query = query.Where("outlet_id = ?", *outletId)
	}

	if supplierId != nil {
		query = query.Where("supplier_id = ?", *supplierId)
	}

	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}

	if from != nil && to != nil {
		query = query.Where("bill_date >= ? AND bill_date <= ?", *from, to)
	}

	if err := query.Model(&models.PurchaseBill{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Preload("Supplier").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Product")
		}).
		Order("bill_date DESC, id DESC").
		Offset(offset).
		Limit(size).
		Find(&bills).Error

	return bills, total, err
}

// GetByID returns a purchase bill by ID
func (pbs *PurchaseBillService) GetByID(id int) (*models.PurchaseBill, error) {
	bill := &models.PurchaseBill{}
	err := pbs.db.
		Preload("Supplier").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Product")
		}).
		Preload("SourcePo").
		First(bill, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase bill with ID %d not found", id)}
	}

	return bill, err
}

// GetSummary returns aggregate stats for bills in a date range
func (pbs *PurchaseBillService) GetSummary(outletId int, from, to *time.Time) (map[string]interface{}, error) {
	var bills []models.PurchaseBill
	query := pbs.db.Where("outlet_id = ? AND status != ?", outletId, models.BillStatusPaid)

	if from != nil && to != nil {
		query = query.Where("bill_date >= ? AND bill_date <= ?", from, to)
	}

	if err := query.Find(&bills).Error; err != nil {
		return nil, err
	}

	var totalOutstanding decimal.Decimal
	for _, bill := range bills {
		due := bill.TotalAmount.Sub(bill.PaidAmount)
		totalOutstanding = totalOutstanding.Add(due)
	}

	return map[string]interface{}{
		"totalOutstanding": totalOutstanding,
		"unpaidCount":      len(bills),
	}, nil
}

// Create creates a new purchase bill
func (pbs *PurchaseBillService) Create(data map[string]interface{}) (*models.PurchaseBill, error) {
	supplierId := int(data["supplierId"].(float64))
	outletId := int(data["outletId"].(float64))

	billNumber, err := util.GenerateBillNumber(pbs.db)
	if err != nil {
		return nil, err
	}

	items := data["items"].([]interface{})
	var subtotal decimal.Decimal
	var taxAmount decimal.Decimal
	var itemsData []models.PurchaseBillItem

	for _, item := range items {
		itemMap := item.(map[string]interface{})
		qty := decimal.NewFromFloat(itemMap["quantity"].(float64))
		cost := decimal.NewFromFloat(itemMap["unitCost"].(float64))
		taxRate := decimal.New(0, 0)

		if tr, ok := itemMap["taxRate"].(float64); ok {
			taxRate = decimal.NewFromFloat(tr)
		}

		lineSub := qty.Mul(cost)
		lineTax := lineSub.Mul(taxRate).Div(decimal.NewFromInt(100)).Round(2)

		subtotal = subtotal.Add(lineSub)
		taxAmount = taxAmount.Add(lineTax)

		var productID *int
		if pid, ok := itemMap["productId"].(float64); ok {
			id := int(pid)
			productID = &id
		}
		desc, _ := itemMap["description"].(string)
		itemsData = append(itemsData, models.PurchaseBillItem{
			ProductID:   productID,
			Description: desc,
			Quantity:    qty,
			UnitCost:    cost,
			TaxRate:     taxRate,
			LineTotal:   lineSub.Add(lineTax),
		})
	}

	supplyType := models.SupplyTypeIntraState
	if st, ok := data["supplyType"].(string); ok {
		supplyType = models.SupplyType(st)
	}

	isIntra := supplyType == models.SupplyTypeIntraState
	var cgstAmount, sgstAmount, igstAmount decimal.Decimal

	if isIntra {
		cgstAmount = taxAmount.Div(decimal.NewFromInt(2)).Round(2)
		sgstAmount = taxAmount.Sub(cgstAmount)
	} else {
		igstAmount = taxAmount
	}

	bill := models.PurchaseBill{
		BillNumber:  billNumber,
		SupplierID:  supplierId,
		OutletID:    outletId,
		Status:      models.BillStatusUnpaid,
		Subtotal:    subtotal,
		TaxAmount:   taxAmount,
		CGSTAmount:  cgstAmount,
		SGSTAmount:  sgstAmount,
		IGSTAmount:  igstAmount,
		TotalAmount: subtotal.Add(taxAmount),
		SupplyType:  supplyType,
	}

	if vendorBillNumber, ok := data["vendorBillNumber"].(string); ok {
		bill.VendorBillNumber = &vendorBillNumber
	}

	if billDate, ok := data["billDate"].(string); ok {
		if parsedDate, err := time.Parse("2006-01-02", billDate); err == nil {
			bill.BillDate = parsedDate
		}
	} else {
		bill.BillDate = time.Now()
	}

	if dueDate, ok := data["dueDate"].(string); ok {
		if parsedDate, err := time.Parse("2006-01-02", dueDate); err == nil {
			bill.DueDate = &parsedDate
		}
	}

	if notes, ok := data["notes"].(string); ok {
		bill.Notes = &notes
	}

	if vendorGstin, ok := data["vendorGstin"].(string); ok {
		bill.VendorGSTIN = &vendorGstin
	}

	// Add items
	bill.Items = itemsData

	if err := pbs.db.Create(&bill).Error; err != nil {
		return nil, err
	}

	return pbs.GetByID(bill.ID)
}

// CreateFromPO creates a bill from a purchase order
func (pbs *PurchaseBillService) CreateFromPO(poId int) (*models.PurchaseBill, error) {
	po := &models.PurchaseOrder{}
	if err := pbs.db.
		Preload("Items").
		Preload("Supplier").
		First(po, poId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase order with ID %d not found", poId)}
		}
		return nil, err
	}

	billNumber, err := util.GenerateBillNumber(pbs.db)
	if err != nil {
		return nil, err
	}

	supplyType := models.SupplyTypeIntraState
	isIntra := supplyType == models.SupplyTypeIntraState

	taxAmount := po.TaxAmount
	var cgstAmount, sgstAmount, igstAmount decimal.Decimal

	if isIntra {
		cgstAmount = taxAmount.Div(decimal.NewFromInt(2)).Round(2)
		sgstAmount = taxAmount.Sub(cgstAmount)
	} else {
		igstAmount = taxAmount
	}

	bill := models.PurchaseBill{
		BillNumber:  billNumber,
		SupplierID:  po.SupplierID,
		OutletID:    po.OutletID,
		SourcePoID:  &poId,
		Status:      models.BillStatusUnpaid,
		Subtotal:    po.Subtotal,
		TaxAmount:   taxAmount,
		CGSTAmount:  cgstAmount,
		SGSTAmount:  sgstAmount,
		IGSTAmount:  igstAmount,
		TotalAmount: po.TotalAmount,
		BillDate:    time.Now(),
		SupplyType:  supplyType,
	}

	if po.Supplier != nil && po.Supplier.GSTIN != nil {
		bill.VendorGSTIN = po.Supplier.GSTIN
	}

	// Create items from PO items
	for _, item := range po.Items {
		bill.Items = append(bill.Items, models.PurchaseBillItem{
			ProductID: item.ProductID,
			Quantity:  item.OrderedQuantity,
			UnitCost:  item.UnitCost,
			TaxRate:   item.TaxRate,
			LineTotal: item.LineTotal,
		})
	}

	if err := pbs.db.Create(&bill).Error; err != nil {
		return nil, err
	}

	return pbs.GetByID(bill.ID)
}

// GetUnpaidBySupplier returns unpaid/partial bills for a supplier ordered oldest first.
func (pbs *PurchaseBillService) GetUnpaidBySupplier(supplierID, outletID int) ([]models.PurchaseBill, error) {
	var bills []models.PurchaseBill
	err := pbs.db.Where("supplier_id = ? AND outlet_id = ? AND status IN ?",
		supplierID, outletID, []string{"UNPAID", "PARTIAL"}).
		Order("bill_date ASC").Find(&bills).Error
	return bills, err
}

// RecordPayment records a payment against a bill
func (pbs *PurchaseBillService) RecordPayment(id int, amount decimal.Decimal, method *string, reference *string) (*models.PurchaseBill, error) {
	bill, err := pbs.GetByID(id)
	if err != nil {
		return nil, err
	}

	newPaid := bill.PaidAmount.Add(amount)
	var newStatus models.BillStatus

	if newPaid.GreaterThanOrEqual(bill.TotalAmount) {
		newStatus = models.BillStatusPaid
	} else if newPaid.GreaterThan(decimal.Zero) {
		newStatus = models.BillStatusPartial
	} else {
		newStatus = bill.Status
	}

	if err := pbs.db.Model(bill).
		Update("paid_amount", newPaid).
		Update("status", newStatus).Error; err != nil {
		return nil, err
	}

	return pbs.GetByID(id)
}

// Delete deletes a purchase bill (only if DRAFT or UNPAID)
func (pbs *PurchaseBillService) Delete(id int) error {
	bill, err := pbs.GetByID(id)
	if err != nil {
		return err
	}

	if bill.Status != models.BillStatusDraft && bill.Status != models.BillStatusUnpaid {
		return &util.BusinessException{
			StatusCode: 400,
			Message:    "Cannot delete a bill that is not in DRAFT or UNPAID status",
		}
	}

	return pbs.db.Transaction(func(tx *gorm.DB) error {
		// Delete items first
		if err := tx.Where("bill_id = ?", id).Delete(&models.PurchaseBillItem{}).Error; err != nil {
			return err
		}
		// Delete bill
		return tx.Delete(bill).Error
	})
}
