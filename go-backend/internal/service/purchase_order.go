package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PurchaseOrderService struct {
	db *gorm.DB
}

func NewPurchaseOrderService(db *gorm.DB) *PurchaseOrderService {
	return &PurchaseOrderService{db: db}
}

// GetAll returns paginated list of purchase orders with filtering
func (pos *PurchaseOrderService) GetAll(page, size int, outletId *int, supplierId *int, status *string, from, to *time.Time, search *string, isDirect *bool) (orders []models.PurchaseOrder, total int64, err error) {
	query := pos.db

	if outletId != nil {
		query = query.Where("purchase_orders.outlet_id = ?", *outletId)
	}

	if supplierId != nil {
		query = query.Where("purchase_orders.supplier_id = ?", *supplierId)
	}

	if status != nil && *status != "" {
		query = query.Where("purchase_orders.status = ?", *status)
	}

	if from != nil && to != nil {
		query = query.Where("purchase_orders.created_at >= ? AND purchase_orders.created_at <= ?",
			*from, to.Add(24*time.Hour))
	}

	if search != nil && *search != "" {
		s := "%" + *search + "%"
		query = query.Joins("JOIN suppliers ON suppliers.id = purchase_orders.supplier_id").
			Where("purchase_orders.po_number LIKE ? OR suppliers.name LIKE ?", s, s)
	}

	if isDirect != nil {
		query = query.Where("purchase_orders.is_direct = ?", *isDirect)
	}

	if err := query.Model(&models.PurchaseOrder{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Preload("Supplier").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Product")
		}).
		Preload("SourceBills").
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&orders).Error

	return orders, total, err
}

// GetByPONumber returns a purchase order by PO number or ID
func (pos *PurchaseOrderService) GetByPONumber(poNumber string) (*models.PurchaseOrder, error) {
	order := &models.PurchaseOrder{}

	// Try parsing as ID first
	var parsedID int
	if n, err := fmt.Sscanf(poNumber, "%d", &parsedID); err == nil && n == 1 {
		if err := pos.db.
			Preload("Supplier").
			Preload("Items", func(db *gorm.DB) *gorm.DB {
				return db.Preload("Product")
			}).
			First(order, parsedID).Error; err == nil {
			return order, nil
		}
	}

	// Try by PO number
	err := pos.db.
		Preload("Supplier").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Product")
		}).
		Where("po_number = ?", poNumber).
		First(order).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase order %s not found", poNumber)}
	}

	return order, err
}

// CreateItemData is internal struct for processing items
type CreateItemData struct {
	ProductID   *int
	Description string
	Quantity    decimal.Decimal
	UnitCost    decimal.Decimal
	TaxRate     decimal.Decimal
	LineTotal   decimal.Decimal
}

// Create creates a new purchase order
func (pos *PurchaseOrderService) Create(data map[string]interface{}) (*models.PurchaseOrder, error) {
	supplierId := int(data["supplierId"].(float64))
	outletId := int(data["outletId"].(float64))

	poNumber, err := util.GeneratePONumber(pos.db)
	if err != nil {
		return nil, err
	}

	items := data["items"].([]interface{})
	var subtotal decimal.Decimal
	var taxAmount decimal.Decimal
	var itemsData []CreateItemData

	for _, item := range items {
		itemMap := item.(map[string]interface{})
		qty := decimal.NewFromFloat(itemMap["qty"].(float64))
		cost := decimal.NewFromFloat(itemMap["unitCost"].(float64))
		taxRate := decimal.New(0, 0)

		if tr, ok := itemMap["taxRate"].(float64); ok {
			taxRate = decimal.NewFromFloat(tr)
		}

		var productID *int
		if pid, ok := itemMap["productId"].(float64); ok {
			id := int(pid)
			productID = &id
		}
		desc, _ := itemMap["description"].(string)

		lineSub := qty.Mul(cost)
		lineTax := lineSub.Mul(taxRate).Div(decimal.NewFromInt(100)).Round(2)

		subtotal = subtotal.Add(lineSub)
		taxAmount = taxAmount.Add(lineTax)

		itemsData = append(itemsData, CreateItemData{
			ProductID:   productID,
			Description: desc,
			Quantity:    qty,
			UnitCost:    cost,
			TaxRate:     taxRate,
			LineTotal:   lineSub.Add(lineTax),
		})
	}

	order := models.PurchaseOrder{
		PONumber:    poNumber,
		SupplierID:  supplierId,
		OutletID:    outletId,
		Status:      models.POStatusDraft,
		Subtotal:    subtotal,
		TaxAmount:   taxAmount,
		TotalAmount: subtotal.Add(taxAmount),
	}

	if notes, ok := data["notes"].(string); ok {
		order.Notes = &notes
	}

	if expectedDate, ok := data["expectedDate"].(string); ok {
		if parsedDate, err := time.Parse("2006-01-02", expectedDate); err == nil {
			order.ExpectedDate = &parsedDate
		}
	}

	// Create items
	for _, item := range itemsData {
		order.Items = append(order.Items, models.PurchaseOrderItem{
			ProductID:       item.ProductID,
			Description:     item.Description,
			OrderedQuantity: item.Quantity,
			UnitCost:        item.UnitCost,
			TaxRate:         item.TaxRate,
			LineTotal:       item.LineTotal,
		})
	}

	if err := pos.db.Create(&order).Error; err != nil {
		return nil, err
	}

	return pos.GetByPONumber(order.PONumber)
}

// CreateDirect creates a purchase order and marks as received immediately, updating inventory.
// If paymentMode is "credit" or "partial", a PurchaseBill is also created so the vendor
// appears in the creditors list.
func (pos *PurchaseOrderService) CreateDirect(data map[string]interface{}) (*models.PurchaseOrder, error) {
	supplierId := int(data["supplierId"].(float64))
	outletId := int(data["outletId"].(float64))

	paymentMode, _ := data["paymentMode"].(string)
	if paymentMode == "" {
		paymentMode = "cash"
	}

	var paidAmount decimal.Decimal
	if pa, ok := data["paidAmount"].(float64); ok && pa > 0 {
		paidAmount = decimal.NewFromFloat(pa)
	}

	poNumber, err := util.GeneratePONumber(pos.db)
	if err != nil {
		return nil, err
	}

	items := data["items"].([]interface{})
	var subtotal decimal.Decimal
	var taxAmount decimal.Decimal
	var itemsData []CreateItemData

	for _, item := range items {
		itemMap := item.(map[string]interface{})
		qty := decimal.NewFromFloat(itemMap["qty"].(float64))
		cost := decimal.NewFromFloat(itemMap["unitCost"].(float64))
		taxRate := decimal.New(0, 0)

		if tr, ok := itemMap["taxRate"].(float64); ok {
			taxRate = decimal.NewFromFloat(tr)
		}

		var productID *int
		if pid, ok := itemMap["productId"].(float64); ok {
			id := int(pid)
			productID = &id
		}
		desc, _ := itemMap["description"].(string)

		lineSub := qty.Mul(cost)
		lineTax := lineSub.Mul(taxRate).Div(decimal.NewFromInt(100)).Round(2)

		subtotal = subtotal.Add(lineSub)
		taxAmount = taxAmount.Add(lineTax)

		itemsData = append(itemsData, CreateItemData{
			ProductID:   productID,
			Description: desc,
			Quantity:    qty,
			UnitCost:    cost,
			TaxRate:     taxRate,
			LineTotal:   lineSub.Add(lineTax),
		})
	}

	now := time.Now()
	totalAmount := subtotal.Add(taxAmount)

	order := models.PurchaseOrder{
		PONumber:     poNumber,
		SupplierID:   supplierId,
		OutletID:     outletId,
		Status:       models.POStatusReceived,
		ReceivedDate: &now,
		IsDirect:     true,
		Subtotal:     subtotal,
		TaxAmount:    taxAmount,
		TotalAmount:  totalAmount,
	}

	if notes, ok := data["notes"].(string); ok {
		order.Notes = &notes
	}

	// Create items with received quantities
	for _, item := range itemsData {
		order.Items = append(order.Items, models.PurchaseOrderItem{
			ProductID:        item.ProductID,
			Description:      item.Description,
			OrderedQuantity:  item.Quantity,
			ReceivedQuantity: item.Quantity,
			UnitCost:         item.UnitCost,
			TaxRate:          item.TaxRate,
			LineTotal:        item.LineTotal,
		})
	}

	// Use transaction for PO creation, optional bill creation, and inventory update
	return &order, pos.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		// Create a PurchaseBill for all payment modes so every purchase appears in the bills register
		if paymentMode == "credit" || paymentMode == "partial" || paymentMode == "cash" {
			billNumber, err := util.GenerateBillNumber(tx)
			if err != nil {
				return err
			}

			billStatus := models.BillStatusUnpaid
			effectivePaid := decimal.Zero
			if paymentMode == "cash" {
				billStatus = models.BillStatusPaid
				effectivePaid = totalAmount
			} else if paymentMode == "partial" && paidAmount.IsPositive() {
				effectivePaid = paidAmount
				if effectivePaid.GreaterThanOrEqual(totalAmount) {
					billStatus = models.BillStatusPaid
				} else {
					billStatus = models.BillStatusPartial
				}
			}

			poID := order.ID
			var vendorBillNum *string
			if inv, ok := data["invoiceNumber"].(string); ok && inv != "" {
				vendorBillNum = &inv
			}

			bill := models.PurchaseBill{
				BillNumber:       billNumber,
				SupplierID:       supplierId,
				OutletID:         outletId,
				SourcePoID:       &poID,
				VendorBillNumber: vendorBillNum,
				BillDate:         now,
				Status:           billStatus,
				Subtotal:         subtotal,
				TaxAmount:        taxAmount,
				TotalAmount:      totalAmount,
				PaidAmount:       effectivePaid,
			}

			// Bill items mirror the PO items
			for _, item := range itemsData {
				bill.Items = append(bill.Items, models.PurchaseBillItem{
					ProductID:   item.ProductID,
					Description: item.Description,
					Quantity:    item.Quantity,
					UnitCost:    item.UnitCost,
					TaxRate:     item.TaxRate,
					LineTotal:   item.LineTotal,
				})
			}

			if err := tx.Create(&bill).Error; err != nil {
				return err
			}
		}

		// Update inventory for items that have a product (custom items have no productId)
		for _, item := range itemsData {
			if item.ProductID == nil {
				continue
			}
			var inv models.Inventory
			result := tx.Where("product_id = ? AND outlet_id = ?", *item.ProductID, outletId).First(&inv)

			if result.Error == gorm.ErrRecordNotFound {
				if err := tx.Create(&models.Inventory{
					ProductID:       *item.ProductID,
					OutletID:        outletId,
					QuantityOnHand:  item.Quantity,
					LastStockUpdate: &now,
				}).Error; err != nil {
					return err
				}
			} else if result.Error == nil {
				if err := tx.Model(&inv).Update("quantity_on_hand", gorm.Expr("quantity_on_hand + ?", item.Quantity)).
					Update("last_stock_update", now).Error; err != nil {
					return err
				}
			} else {
				return result.Error
			}
		}

		return nil
	})
}

// Update updates an existing purchase order
func (pos *PurchaseOrderService) Update(id int, data map[string]interface{}) (*models.PurchaseOrder, error) {
	order := &models.PurchaseOrder{}
	if err := pos.db.First(order, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase order with ID %d not found", id)}
		}
		return nil, err
	}

	if order.Status == models.POStatusReceived {
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message:    "Cannot update a received purchase order",
		}
	}

	// Update items if provided
	if itemsInterface, ok := data["items"]; ok {
		items := itemsInterface.([]interface{})

		// Delete existing items
		pos.db.Where("purchase_order_id = ?", id).Delete(&models.PurchaseOrderItem{})

		var subtotal decimal.Decimal
		var taxAmount decimal.Decimal

		// Create new items
		for _, item := range items {
			itemMap := item.(map[string]interface{})
			qty := decimal.NewFromFloat(itemMap["qty"].(float64))
			cost := decimal.NewFromFloat(itemMap["unitCost"].(float64))
			taxRate := decimal.New(0, 0)

			if tr, ok := itemMap["taxRate"].(float64); ok {
				taxRate = decimal.NewFromFloat(tr)
			}

			var productID *int
			if pid, ok := itemMap["productId"].(float64); ok {
				id2 := int(pid)
				productID = &id2
			}
			desc, _ := itemMap["description"].(string)

			lineSub := qty.Mul(cost)
			lineTax := lineSub.Mul(taxRate).Div(decimal.NewFromInt(100)).Round(2)
			lineTotal := lineSub.Add(lineTax)

			subtotal = subtotal.Add(lineSub)
			taxAmount = taxAmount.Add(lineTax)

			pos.db.Create(&models.PurchaseOrderItem{
				PurchaseOrderID: id,
				ProductID:       productID,
				Description:     desc,
				OrderedQuantity: qty,
				UnitCost:        cost,
				TaxRate:         taxRate,
				LineTotal:       lineTotal,
			})
		}

		order.Subtotal = subtotal
		order.TaxAmount = taxAmount
		order.TotalAmount = subtotal.Add(taxAmount)
	}

	// Update other fields
	if status, ok := data["status"].(string); ok {
		order.Status = models.POStatus(status)
	}

	if expectedDate, ok := data["expectedDate"].(string); ok {
		if parsedDate, err := time.Parse("2006-01-02", expectedDate); err == nil {
			order.ExpectedDate = &parsedDate
		}
	}

	if notes, ok := data["notes"].(string); ok {
		order.Notes = &notes
	}

	if err := pos.db.Save(order).Error; err != nil {
		return nil, err
	}

	return pos.GetByPONumber(order.PONumber)
}

// UpdateStatus updates the status of a purchase order
func (pos *PurchaseOrderService) UpdateStatus(id int, status string) (*models.PurchaseOrder, error) {
	order := &models.PurchaseOrder{}
	if err := pos.db.Model(order).Where("id = ?", id).Update("status", status).Error; err != nil {
		return nil, err
	}

	return pos.GetByPONumber(order.PONumber)
}

// Delete deletes a purchase order (only if DRAFT)
func (pos *PurchaseOrderService) Delete(id int) error {
	order := &models.PurchaseOrder{}
	if err := pos.db.First(order, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase order with ID %d not found", id)}
		}
		return err
	}

	return pos.db.Transaction(func(tx *gorm.DB) error {
		// Delete items first
		if err := tx.Where("purchase_order_id = ?", id).Delete(&models.PurchaseOrderItem{}).Error; err != nil {
			return err
		}
		// Delete order
		return tx.Delete(order).Error
	})
}

// UpdateDirect updates a direct (RECEIVED) purchase order with inventory reversal and re-application
func (pos *PurchaseOrderService) UpdateDirect(id int, data map[string]interface{}) (*models.PurchaseOrder, error) {
	order := &models.PurchaseOrder{}
	if err := pos.db.Preload("Items").First(order, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase order with ID %d not found", id)}
		}
		return nil, err
	}

	now := time.Now()

	err := pos.db.Transaction(func(tx *gorm.DB) error {
		// 1. Reverse inventory for all existing items
		for _, item := range order.Items {
			tx.Model(&models.Inventory{}).
				Where("product_id = ? AND outlet_id = ?", item.ProductID, order.OutletID).
				Updates(map[string]interface{}{
					"quantity_on_hand":  gorm.Expr("quantity_on_hand - ?", item.OrderedQuantity),
					"last_stock_update": now,
				})
		}

		// 2. Delete existing items
		if err := tx.Where("purchase_order_id = ?", id).Delete(&models.PurchaseOrderItem{}).Error; err != nil {
			return err
		}

		// 3. Process and create new items, re-apply inventory
		var subtotal, taxAmount decimal.Decimal
		if itemsInterface, ok := data["items"]; ok {
			items := itemsInterface.([]interface{})
			for _, item := range items {
				itemMap := item.(map[string]interface{})
				qty := decimal.NewFromFloat(itemMap["quantity"].(float64))
				cost := decimal.NewFromFloat(itemMap["unitCost"].(float64))
				taxRate := decimal.Zero
				if tr, ok := itemMap["taxRate"].(float64); ok {
					taxRate = decimal.NewFromFloat(tr)
				}
				lineSub := qty.Mul(cost)
				lineTax := lineSub.Mul(taxRate).Div(decimal.NewFromInt(100)).Round(2)
				lineTotal := lineSub.Add(lineTax)
				subtotal = subtotal.Add(lineSub)
				taxAmount = taxAmount.Add(lineTax)

				var productId *int
				if pid, ok := itemMap["productId"].(float64); ok {
					id2 := int(pid)
					productId = &id2
				}
				desc, _ := itemMap["description"].(string)
				if err := tx.Create(&models.PurchaseOrderItem{
					PurchaseOrderID:  id,
					ProductID:        productId,
					Description:      desc,
					OrderedQuantity:  qty,
					ReceivedQuantity: qty,
					UnitCost:         cost,
					TaxRate:          taxRate,
					LineTotal:        lineTotal,
				}).Error; err != nil {
					return err
				}

				// Re-apply inventory for new items (only if product-linked)
				if productId == nil {
					continue
				}
				var inv models.Inventory
				result := tx.Where("product_id = ? AND outlet_id = ?", *productId, order.OutletID).First(&inv)
				if result.Error == gorm.ErrRecordNotFound {
					if err := tx.Create(&models.Inventory{
						ProductID:       *productId,
						OutletID:        order.OutletID,
						QuantityOnHand:  qty,
						LastStockUpdate: &now,
					}).Error; err != nil {
						return err
					}
				} else if result.Error == nil {
					if err := tx.Model(&inv).Updates(map[string]interface{}{
						"quantity_on_hand":  gorm.Expr("quantity_on_hand + ?", qty),
						"last_stock_update": now,
					}).Error; err != nil {
						return err
					}
				} else {
					return result.Error
				}
			}
			order.Subtotal = subtotal
			order.TaxAmount = taxAmount
			order.TotalAmount = subtotal.Add(taxAmount)
		}

		// 4. Update header fields
		if supplierId, ok := data["supplierId"].(float64); ok && supplierId > 0 {
			order.SupplierID = int(supplierId)
		}
		if purchaseDate, ok := data["purchaseDate"].(string); ok && purchaseDate != "" {
			if t, err := time.Parse("2006-01-02", purchaseDate); err == nil {
				order.ReceivedDate = &t
			}
		}
		if notes, ok := data["notes"].(string); ok && notes != "" {
			order.Notes = &notes
		} else if _, hasNotes := data["notes"]; hasNotes {
			order.Notes = nil
		}

		return tx.Save(order).Error
	})

	if err != nil {
		return nil, err
	}

	return pos.GetByPONumber(order.PONumber)
}
