package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type InventoryService struct {
	db *gorm.DB
}

func NewInventoryService(db *gorm.DB) *InventoryService {
	return &InventoryService{db: db}
}

// GetByProductAndOutlet returns inventory for a specific product at an outlet
func (is *InventoryService) GetByProductAndOutlet(productId, outletId int) (inventory *models.Inventory, err error) {
	inventory = &models.Inventory{}
	err = is.db.
		Where("product_id = ? AND outlet_id = ?", productId, outletId).
		Preload("Product").
		Preload("Outlet").
		First(inventory).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Inventory for product %d at outlet %d not found", productId, outletId)}
	}
	return inventory, err
}

// GetByProductAllOutlets returns inventory for a product across all outlets
func (is *InventoryService) GetByProductAllOutlets(productId int) (inventories []models.Inventory, err error) {
	err = is.db.
		Where("product_id = ?", productId).
		Preload("Product").
		Preload("Outlet").
		Find(&inventories).Error
	return inventories, err
}

// GetByOutlet returns paginated inventory list for an outlet, optionally filtered by product item_type.
// For FINISHED_PIPE, all active products are returned (with 0 on-hand when no inventory row exists).
func (is *InventoryService) GetByOutlet(outletId int, itemType string, page, size int) ([]models.Inventory, int64, error) {
	if itemType == "FINISHED_PIPE" {
		return is.getByOutletAllProducts(outletId, itemType, page, size)
	}

	query := is.db.Model(&models.Inventory{}).Where("inventory.outlet_id = ?", outletId)
	if itemType != "" {
		query = query.
			Joins("JOIN products ON products.id = inventory.product_id").
			Where("products.item_type = ?", itemType)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var inventories []models.Inventory
	err := query.
		Preload("Product").
		Preload("Variant").
		Offset(page * size).
		Limit(size).
		Find(&inventories).Error

	return inventories, total, err
}

// getByOutletAllProducts queries all active products of the given itemType, merging with
// existing inventory rows so products without a row still appear with zero on-hand.
func (is *InventoryService) getByOutletAllProducts(outletId int, itemType string, page, size int) ([]models.Inventory, int64, error) {
	var total int64
	if err := is.db.Model(&models.Product{}).
		Where("item_type = ? AND is_active = true", itemType).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var products []models.Product
	if err := is.db.Where("item_type = ? AND is_active = true", itemType).
		Order("name").
		Offset(page * size).Limit(size).
		Find(&products).Error; err != nil {
		return nil, 0, err
	}
	if len(products) == 0 {
		return nil, total, nil
	}

	productIDs := make([]int, len(products))
	for i, p := range products {
		productIDs[i] = p.ID
	}

	var existing []models.Inventory
	if err := is.db.Where("product_id IN ? AND outlet_id = ?", productIDs, outletId).
		Find(&existing).Error; err != nil {
		return nil, 0, err
	}
	invMap := make(map[int]models.Inventory, len(existing))
	for _, inv := range existing {
		invMap[inv.ProductID] = inv
	}

	result := make([]models.Inventory, len(products))
	for i := range products {
		p := products[i]
		if inv, ok := invMap[p.ID]; ok {
			inv.Product = &p
			result[i] = inv
		} else {
			result[i] = models.Inventory{
				ProductID:      p.ID,
				OutletID:       outletId,
				QuantityOnHand: decimal.Zero,
				Product:        &p,
			}
		}
	}
	return result, total, nil
}

// GetLowStock returns inventory items where quantity is below reorder level
func (is *InventoryService) GetLowStock(outletId *int) (inventories []models.Inventory, err error) {
	query := is.db.Preload("Product")

	if outletId != nil {
		query = query.Where("outlet_id = ?", *outletId)
	}

	if err := query.Find(&inventories).Error; err != nil {
		return nil, err
	}

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

// AdjustStockDTO for stock adjustment
type AdjustStockDTO struct {
	ProductID  int             `json:"productId"`
	VariantID  *int            `json:"variantId"`
	OutletID   int             `json:"outletId"`
	Quantity   decimal.Decimal `json:"quantity"`
	Reason     string          `json:"reason"`
	Notes      *string         `json:"notes"`
	UserID     *int            `json:"userId"`
	CreatedBy  *string         `json:"createdBy"`
}

// AdjustStock creates a stock adjustment and updates inventory
func (is *InventoryService) AdjustStock(dto AdjustStockDTO) (adjustment *models.StockAdjustment, err error) {
	// Get current inventory
	inventory := &models.Inventory{}
	query := is.db.Where("product_id = ? AND outlet_id = ?", dto.ProductID, dto.OutletID)
	if dto.VariantID != nil {
		query = query.Where("variant_id = ?", *dto.VariantID)
	}

	if err := query.First(inventory).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			return nil, err
		}
		// Create new inventory record if not exists
		inventory = &models.Inventory{
			ProductID:      dto.ProductID,
			VariantID:      dto.VariantID,
			OutletID:       dto.OutletID,
			QuantityOnHand: decimal.Zero,
		}
		if err := is.db.Create(inventory).Error; err != nil {
			return nil, err
		}
	}

	quantityBefore := inventory.QuantityOnHand
	newQuantity := quantityBefore.Add(dto.Quantity)

	// Create adjustment record
	adjustment = &models.StockAdjustment{
		ProductID:          dto.ProductID,
		VariantID:          dto.VariantID,
		OutletID:           dto.OutletID,
		AdjustedByID:       dto.UserID,
		QuantityBefore:     &quantityBefore,
		AdjustmentQuantity: dto.Quantity,
		QuantityAfter:      &newQuantity,
		Reason:             models.AdjustmentReason(dto.Reason),
		Notes:              dto.Notes,
		CreatedBy:          dto.CreatedBy,
	}

	if err := is.db.Create(adjustment).Error; err != nil {
		return nil, err
	}

	// Preload product so the response (and activity log) includes the product name
	is.db.Preload("Product").First(adjustment, adjustment.ID)

	// Update inventory
	now := time.Now()
	if err := is.db.Model(inventory).Updates(map[string]interface{}{
		"quantity_on_hand":  newQuantity,
		"last_stock_update": now,
		"updated_by":        dto.CreatedBy,
	}).Error; err != nil {
		return nil, err
	}

	return adjustment, nil
}

// UpdateReorderLevelDTO for updating inventory reorder settings
type UpdateReorderLevelDTO struct {
	ProductID    int  `json:"productId"`
	OutletID     int  `json:"outletId"`
	ReorderLevel int  `json:"reorderLevel"`
}

// UpdateReorderLevel updates reorder_level on both the product and the inventory record
// so the product form and inventory page always show the same value.
func (is *InventoryService) UpdateReorderLevel(dto UpdateReorderLevelDTO) (inventory *models.Inventory, err error) {
	// 1. Update product.reorder_level (single source of truth)
	if err := is.db.Model(&models.Product{}).
		Where("id = ?", dto.ProductID).
		Update("reorder_level", dto.ReorderLevel).Error; err != nil {
		return nil, err
	}
	// 2. Keep inventory.reorder_level in sync
	inv := &models.Inventory{}
	if err := is.db.Where("product_id = ? AND outlet_id = ?", dto.ProductID, dto.OutletID).First(inv).Error; err != nil {
		return nil, err
	}
	if err := is.db.Model(inv).Update("reorder_level", dto.ReorderLevel).Error; err != nil {
		return nil, err
	}
	// Reload with product
	is.db.Preload("Product").Preload("Product.TaxGroup").Preload("Product.Category").First(inv, inv.ID)
	return inv, nil
}

// GetAdjustmentsDTO for filtering adjustments
type GetAdjustmentsDTO struct {
	OutletID  *int
	ProductID *int
	From      *time.Time
	To        *time.Time
	Page      int
	Size      int
}

// GetAdjustments returns paginated stock adjustments
func (is *InventoryService) GetAdjustments(dto GetAdjustmentsDTO) (adjustments []models.StockAdjustment, total int64, err error) {
	query := is.db

	if dto.OutletID != nil {
		query = query.Where("outlet_id = ?", *dto.OutletID)
	}
	if dto.ProductID != nil {
		query = query.Where("product_id = ?", *dto.ProductID)
	}
	if dto.From != nil {
		query = query.Where("created_at >= ?", *dto.From)
	}
	if dto.To != nil {
		query = query.Where("created_at <= ?", *dto.To)
	}

	if err := query.Model(&models.StockAdjustment{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := dto.Page * dto.Size
	err = query.
		Preload("Product").
		Preload("Variant").
		Preload("Outlet").
		Order("created_at DESC").
		Offset(offset).
		Limit(dto.Size).
		Find(&adjustments).Error

	return adjustments, total, err
}

// CreateTransferDTO for transfer creation
type CreateTransferDTO struct {
	FromOutletID int               `json:"fromOutletId"`
	ToOutletID   int               `json:"toOutletId"`
	Items        []TransferItemDTO `json:"items"`
	Notes        *string           `json:"notes"`
	RequestedByID *int             `json:"requestedById"`
	CreatedBy    *string           `json:"createdBy"`
}

type TransferItemDTO struct {
	ProductID  int             `json:"productId"`
	VariantID  *int            `json:"variantId"`
	Quantity   decimal.Decimal `json:"quantity"`
	Notes      *string         `json:"notes"`
}

// CreateTransfer creates a stock transfer
func (is *InventoryService) CreateTransfer(dto CreateTransferDTO) (transfer *models.StockTransfer, err error) {
	transferNumber, err := util.GenerateTransferNumber(is.db)
	if err != nil {
		return nil, err
	}

	transfer = &models.StockTransfer{
		TransferNumber: transferNumber,
		FromOutletID:   dto.FromOutletID,
		ToOutletID:     dto.ToOutletID,
		RequestedByID:  dto.RequestedByID,
		Status:         models.TransferStatusRequested,
		Notes:          dto.Notes,
		CreatedBy:      dto.CreatedBy,
	}

	if err := is.db.Create(transfer).Error; err != nil {
		return nil, err
	}

	// Create transfer items
	for _, itemDTO := range dto.Items {
		item := models.StockTransferItem{
			TransferID:        transfer.ID,
			ProductID:         itemDTO.ProductID,
			VariantID:         itemDTO.VariantID,
			RequestedQuantity: itemDTO.Quantity,
			Notes:             itemDTO.Notes,
		}
		if err := is.db.Create(&item).Error; err != nil {
			return nil, err
		}
	}

	return transfer, is.db.Preload("Items").First(transfer, transfer.ID).Error
}

// ApproveTransfer approves a transfer
func (is *InventoryService) ApproveTransfer(transferId int, approvedById int) (transfer *models.StockTransfer, err error) {
	transfer = &models.StockTransfer{}
	if err := is.db.First(transfer, transferId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Transfer with ID %d not found", transferId)}
		}
		return nil, err
	}

	if err := is.db.Model(transfer).Updates(map[string]interface{}{
		"status":       models.TransferStatusApproved,
		"approved_by":  approvedById,
	}).Error; err != nil {
		return nil, err
	}

	return transfer, is.db.Preload("Items").First(transfer, transferId).Error
}

// ShipTransfer marks transfer as in transit
func (is *InventoryService) ShipTransfer(transferId int) (transfer *models.StockTransfer, err error) {
	transfer = &models.StockTransfer{}
	if err := is.db.First(transfer, transferId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Transfer with ID %d not found", transferId)}
		}
		return nil, err
	}

	// Update transfer status
	if err := is.db.Model(transfer).Update("status", models.TransferStatusInTransit).Error; err != nil {
		return nil, err
	}

	// Deduct from source inventory and add to in_transit
	var items []models.StockTransferItem
	if err := is.db.Where("transfer_id = ?", transferId).Find(&items).Error; err != nil {
		return nil, err
	}

	for _, item := range items {
		inventory := &models.Inventory{}
		query := is.db.Where("product_id = ? AND outlet_id = ?", item.ProductID, transfer.FromOutletID)
		if item.VariantID != nil {
			query = query.Where("variant_id = ?", *item.VariantID)
		}

		if err := query.First(inventory).Error; err != nil && err != gorm.ErrRecordNotFound {
			return nil, err
		}

		if inventory.ID > 0 {
			newQOH := inventory.QuantityOnHand.Sub(item.RequestedQuantity)
			newInTransit := inventory.QuantityInTransit.Add(item.RequestedQuantity)

			if err := is.db.Model(inventory).Updates(map[string]interface{}{
				"quantity_on_hand":   newQOH,
				"quantity_in_transit": newInTransit,
			}).Error; err != nil {
				return nil, err
			}

			// Update shipped quantity
			if err := is.db.Model(&item).Update("shipped_quantity", item.RequestedQuantity).Error; err != nil {
				return nil, err
			}
		}
	}

	return transfer, is.db.Preload("Items").First(transfer, transferId).Error
}

// ReceiveTransferItem for receiving items
type ReceiveTransferItem struct {
	ItemID   int             `json:"itemId"`
	Quantity decimal.Decimal `json:"quantity"`
}

// ReceiveTransfer receives a transfer at destination
func (is *InventoryService) ReceiveTransfer(transferId int, receivedItems []ReceiveTransferItem, receivedById int) (transfer *models.StockTransfer, err error) {
	transfer = &models.StockTransfer{}
	if err := is.db.First(transfer, transferId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Transfer with ID %d not found", transferId)}
		}
		return nil, err
	}

	// Update transfer status
	if err := is.db.Model(transfer).Updates(map[string]interface{}{
		"status":       models.TransferStatusReceived,
		"received_by":  receivedById,
	}).Error; err != nil {
		return nil, err
	}

	// Get all transfer items
	var allItems []models.StockTransferItem
	if err := is.db.Where("transfer_id = ?", transferId).Find(&allItems).Error; err != nil {
		return nil, err
	}

	// Process received items
	for _, receivedItem := range receivedItems {
		var item *models.StockTransferItem
		for i := range allItems {
			if allItems[i].ID == receivedItem.ItemID {
				item = &allItems[i]
				break
			}
		}

		if item == nil {
			continue
		}

		// Update received quantity
		if err := is.db.Model(item).Update("received_quantity", receivedItem.Quantity).Error; err != nil {
			return nil, err
		}

		// Add to destination inventory
		destInventory := &models.Inventory{}
		query := is.db.Where("product_id = ? AND outlet_id = ?", item.ProductID, transfer.ToOutletID)
		if item.VariantID != nil {
			query = query.Where("variant_id = ?", *item.VariantID)
		}

		if err := query.First(destInventory).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				// Create new inventory at destination
				destInventory = &models.Inventory{
					ProductID:      item.ProductID,
					VariantID:      item.VariantID,
					OutletID:       transfer.ToOutletID,
					QuantityOnHand: receivedItem.Quantity,
				}
				if err := is.db.Create(destInventory).Error; err != nil {
					return nil, err
				}
			} else {
				return nil, err
			}
		} else {
			newQOH := destInventory.QuantityOnHand.Add(receivedItem.Quantity)
			if err := is.db.Model(destInventory).Update("quantity_on_hand", newQOH).Error; err != nil {
				return nil, err
			}
		}

		// Reduce in_transit at source
		sourceInventory := &models.Inventory{}
		query = is.db.Where("product_id = ? AND outlet_id = ?", item.ProductID, transfer.FromOutletID)
		if item.VariantID != nil {
			query = query.Where("variant_id = ?", *item.VariantID)
		}

		if err := query.First(sourceInventory).Error; err == nil {
			newInTransit := sourceInventory.QuantityInTransit.Sub(receivedItem.Quantity)
			if newInTransit.IsNegative() {
				newInTransit = decimal.Zero
			}
			if err := is.db.Model(sourceInventory).Update("quantity_in_transit", newInTransit).Error; err != nil {
				return nil, err
			}
		}
	}

	return transfer, is.db.Preload("Items").First(transfer, transferId).Error
}

// GetTransfersDTO for filtering transfers
type GetTransfersDTO struct {
	OutletID *int
	Status   *string
	Page     int
	Size     int
}

// GetTransfers returns paginated stock transfers
func (is *InventoryService) GetTransfers(dto GetTransfersDTO) (transfers []models.StockTransfer, total int64, err error) {
	query := is.db

	if dto.OutletID != nil {
		query = query.Where("from_outlet_id = ? OR to_outlet_id = ?", *dto.OutletID, *dto.OutletID)
	}
	if dto.Status != nil {
		query = query.Where("status = ?", *dto.Status)
	}

	if err := query.Model(&models.StockTransfer{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := dto.Page * dto.Size
	err = query.
		Preload("Items").
		Preload("Items.Product").
		Preload("FromOutlet").
		Preload("ToOutlet").
		Order("created_at DESC").
		Offset(offset).
		Limit(dto.Size).
		Find(&transfers).Error

	return transfers, total, err
}
