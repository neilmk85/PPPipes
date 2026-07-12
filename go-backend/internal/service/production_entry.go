package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type ProductionEntryService struct {
	db              *gorm.DB
	costSheetService *CostSheetService
}

func NewProductionEntryService(db *gorm.DB, cs *CostSheetService) *ProductionEntryService {
	return &ProductionEntryService{db: db, costSheetService: cs}
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

type MaterialConsumptionInput struct {
	PipeConfigMaterialID *int            `json:"pipeConfigMaterialId"`
	MaterialProductID    int             `json:"materialProductId"`
	ConsumedQty          decimal.Decimal `json:"consumedQty"`
	UOM                  string          `json:"uom"`
}

type CreateProductionEntryRequest struct {
	ProductionOrderID int                        `json:"productionOrderId"`
	StageType         string                     `json:"stageType"`
	PipesProcessed    int                        `json:"pipesProcessed"`
	PipesCompleted    int                        `json:"pipesCompleted"`
	PipesRejected     *int                       `json:"pipesRejected"`
	EntryDate         *time.Time                 `json:"entryDate"`
	Notes             *string                    `json:"notes"`
	BedType           *string                    `json:"bedType"`
	MachineID         *int                       `json:"machineId"`
	ShiftName         *string                    `json:"shiftName"`
	OperatorUserID    *int                       `json:"operatorUserId"`
	// Optional override of auto-calculated consumptions (for SPINNING/WINDING/COATING)
	Consumptions []MaterialConsumptionInput `json:"consumptions"`
}

type PriorStageInfo struct {
	StageType      models.ProdStageType `json:"stageType"`
	PipesCompleted int                  `json:"pipesCompleted"`
	LastEntryDate  *time.Time           `json:"lastEntryDate"`
}

// ── Query methods ─────────────────────────────────────────────────────────────

func (s *ProductionEntryService) GetByOrder(productionOrderID int) ([]models.ProductionEntry, error) {
	var entries []models.ProductionEntry
	err := s.db.
		Where("production_order_id = ?", productionOrderID).
		Preload("PipeConfig").
		Preload("Machine").
		Preload("Consumptions").
		Preload("Consumptions.MaterialProduct").
		Order("entry_date ASC, created_at ASC").
		Find(&entries).Error
	return entries, err
}

func (s *ProductionEntryService) GetByID(id int) (*models.ProductionEntry, error) {
	var entry models.ProductionEntry
	err := s.db.
		Preload("ProductionOrder").
		Preload("PipeConfig").
		Preload("Machine").
		Preload("Consumptions").
		Preload("Consumptions.MaterialProduct").
		First(&entry, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Entry %d not found", id)}
	}
	return &entry, err
}

func (s *ProductionEntryService) GetAll(outletID *int, stageType *models.ProdStageType, pipeConfigID *int, from, to *time.Time, page, size int) ([]models.ProductionEntry, int64, error) {
	q := s.db.Model(&models.ProductionEntry{})
	if stageType != nil {
		q = q.Where("stage_type = ?", *stageType)
	}
	if pipeConfigID != nil {
		q = q.Where("pipe_config_id = ?", *pipeConfigID)
	}
	if from != nil {
		q = q.Where("entry_date >= ?", *from)
	}
	if to != nil {
		q = q.Where("entry_date <= ?", *to)
	}
	if outletID != nil {
		// Join through production_orders
		q = q.Joins("JOIN production_orders ON production_orders.id = production_entries.production_order_id").
			Where("production_orders.outlet_id = ?", *outletID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var entries []models.ProductionEntry
	err := q.
		Preload("PipeConfig").
		Preload("ProductionOrder").
		Order("entry_date DESC, created_at DESC").
		Offset(page * size).Limit(size).
		Find(&entries).Error
	return entries, total, err
}

// GetPriorStageCompleted returns the total PipesCompleted from the most recent
// entry of the stage immediately preceding the given stage for a production order.
// For the first stage (FABRICATION) it returns the order's PlannedQty.
func (s *ProductionEntryService) GetPriorStageCompleted(productionOrderID int, stage models.ProdStageType) (*PriorStageInfo, error) {
	idx := models.StageIndex(stage)
	if idx < 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: fmt.Sprintf("unknown stage: %s", stage)}
	}
	if idx == 0 {
		// First stage — no prior stage exists
		return nil, nil
	}

	priorStage := models.StageSequence[idx-1]

	// Sum all PipesCompleted for the prior stage
	var result struct {
		Total    int
		LastDate *time.Time
	}
	s.db.Model(&models.ProductionEntry{}).
		Where("production_order_id = ? AND stage_type = ?", productionOrderID, priorStage).
		Select("COALESCE(SUM(pipes_completed), 0) as total, MAX(entry_date) as last_date").
		Scan(&result)

	return &PriorStageInfo{
		StageType:      priorStage,
		PipesCompleted: result.Total,
		LastEntryDate:  result.LastDate,
	}, nil
}

// ── Mutation methods ──────────────────────────────────────────────────────────

func (s *ProductionEntryService) Create(req CreateProductionEntryRequest, userID int, createdBy string) (*models.ProductionEntry, error) {
	// 1. Validate stage
	stage := models.ProdStageType(req.StageType)
	if models.StageIndex(stage) < 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "invalid stageType"}
	}

	// 2. Load the production order and pipe config
	var order models.ProductionOrder
	if err := s.db.Preload("PipeConfig").First(&order, req.ProductionOrderID).Error; err != nil {
		return nil, &util.BusinessException{StatusCode: 400, Message: "production order not found"}
	}
	if order.Status == models.ProdOrderCancelled || order.Status == models.ProdOrderCompleted {
		return nil, &util.BusinessException{StatusCode: 400, Message: "cannot add entries to a completed or cancelled order"}
	}

	// 3. Prior-stage constraint
	priorInfo, err := s.GetPriorStageCompleted(req.ProductionOrderID, stage)
	if err != nil {
		return nil, err
	}
	if priorInfo != nil && req.PipesProcessed > priorInfo.PipesCompleted {
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message: fmt.Sprintf("pipesProcessed (%d) exceeds prior stage (%s) completed (%d)",
				req.PipesProcessed, priorInfo.StageType, priorInfo.PipesCompleted),
		}
	}

	// 4. Basic sanity checks
	if req.PipesCompleted > req.PipesProcessed {
		return nil, &util.BusinessException{StatusCode: 400, Message: "pipesCompleted cannot exceed pipesProcessed"}
	}
	if req.PipesProcessed < 0 || req.PipesCompleted < 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "pipe counts cannot be negative"}
	}

	// 5. BedType validation
	// DEMOULDING: required. SPINNING: optional. All other stages: not allowed.
	var bedTypePtr *models.BedType
	if stage == models.StageDemoulding {
		if req.BedType == nil || *req.BedType == "" {
			return nil, &util.BusinessException{StatusCode: 400, Message: "bedType is required for DEMOULDING stage"}
		}
		bt := models.BedType(*req.BedType)
		if bt != models.BedSmall && bt != models.BedLarge && bt != models.BedExtraLarge {
			return nil, &util.BusinessException{StatusCode: 400, Message: "bedType must be SMALL_BED, LARGE_BED or EXTRA_LARGE_BED"}
		}
		bedTypePtr = &bt
	} else if stage == models.StageSpinning {
		// Optional for spinning — accept if provided and valid, ignore if empty
		if req.BedType != nil && *req.BedType != "" {
			bt := models.BedType(*req.BedType)
			if bt != models.BedSmall && bt != models.BedLarge && bt != models.BedExtraLarge {
				return nil, &util.BusinessException{StatusCode: 400, Message: "bedType must be SMALL_BED, LARGE_BED or EXTRA_LARGE_BED"}
			}
			bedTypePtr = &bt
		}
	} else if req.BedType != nil && *req.BedType != "" {
		return nil, &util.BusinessException{StatusCode: 400, Message: "bedType is only valid for DEMOULDING and SPINNING stages"}
	}

	// 6. Compute rejected count
	rejected := req.PipesProcessed - req.PipesCompleted
	if req.PipesRejected != nil {
		rejected = *req.PipesRejected
	}

	// 7. Entry date
	entryDate := time.Now()
	if req.EntryDate != nil {
		entryDate = *req.EntryDate
	}

	// 8. Shift name
	var shiftNamePtr *models.ProdShiftName
	if req.ShiftName != nil {
		sn := models.ProdShiftName(*req.ShiftName)
		shiftNamePtr = &sn
	}

	entry := &models.ProductionEntry{
		ProductionOrderID: req.ProductionOrderID,
		PipeConfigID:      order.PipeConfigID,
		StageType:         stage,
		PipesProcessed:    req.PipesProcessed,
		PipesCompleted:    req.PipesCompleted,
		PipesRejected:     rejected,
		EntryDate:         entryDate,
		Notes:             req.Notes,
		BedType:           bedTypePtr,
		MachineID:         req.MachineID,
		ShiftName:         shiftNamePtr,
		OperatorUserID:    req.OperatorUserID,
		CreatedByUserID:   &userID,
		CreatedBy:         &createdBy,
		UpdatedBy:         &createdBy,
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(entry).Error; err != nil {
			return err
		}

		// 9. Auto-create material consumptions for SPINNING / WINDING / COATING
		if models.MaterialStages[stage] && req.PipesCompleted > 0 {
			if err := s.checkMaterialStock(tx, entry, req, order); err != nil {
				return err
			}
			if err := s.createConsumptions(tx, entry, req, order); err != nil {
				return err
			}
		}

		// 10. Auto-advance order status to IN_PROGRESS
		if order.Status == models.ProdOrderDraft || order.Status == models.ProdOrderPlanned {
			tx.Model(&models.ProductionOrder{}).Where("id = ?", order.ID).
				Updates(map[string]interface{}{
					"status":            models.ProdOrderInProgress,
					"actual_start_date": time.Now(),
				})
		}

		// 11. On FINAL_TESTING completion, credit finished-goods inventory
		if stage == models.StageFinalTesting && entry.PipesCompleted > 0 {
			if err := s.creditFinishedGoodsInventory(tx, order, entry.PipesCompleted, createdBy); err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	// 11. Trigger async cost sheet computation
	go func() {
		_, _ = s.costSheetService.ComputeForOrder(req.ProductionOrderID)
	}()

	return s.GetByID(entry.ID)
}

func (s *ProductionEntryService) createConsumptions(
	tx *gorm.DB,
	entry *models.ProductionEntry,
	req CreateProductionEntryRequest,
	order models.ProductionOrder,
) error {
	// Use caller-provided consumptions if supplied (actual qty override)
	if len(req.Consumptions) > 0 {
		for _, c := range req.Consumptions {
			// Get unit cost from inventory
			unitCost := decimal.Zero
			var inv models.Inventory
			if err := tx.Where("product_id = ? AND outlet_id = ?", c.MaterialProductID, order.OutletID).
				First(&inv).Error; err == nil {
				if inv.AverageCost != nil {
					unitCost = *inv.AverageCost
				}
			}
			consumption := &models.MaterialConsumption{
				ProductionEntryID:    entry.ID,
				PipeConfigMaterialID: c.PipeConfigMaterialID,
				MaterialProductID:    c.MaterialProductID,
				OutletID:             order.OutletID,
				ConsumedQty:          c.ConsumedQty,
				UOM:                  c.UOM,
				UnitCost:             unitCost,
				TotalCost:            unitCost.Mul(c.ConsumedQty),
				CreatedBy:            entry.CreatedBy,
			}
			if err := tx.Create(consumption).Error; err != nil {
				return err
			}
			// Deduct from inventory (non-blocking: warn only)
			s.deductInventory(tx, c.MaterialProductID, order.OutletID, c.ConsumedQty)
		}
		return nil
	}

	// Auto-calculate from pipe config formula
	var materials []models.PipeConfigMaterial
	tx.Where("pipe_config_id = ? AND stage_type = ?", entry.PipeConfigID, entry.StageType).
		Find(&materials)

	qty := decimal.NewFromInt(int64(entry.PipesCompleted))
	for _, mat := range materials {
		consumedQty := mat.QuantityPerPipe.Mul(qty)
		// Apply scrap percent: gross = qty_net × (1 + scrap%/100)
		if mat.ScrapPercent.GreaterThan(decimal.Zero) {
			factor := decimal.NewFromInt(1).Add(mat.ScrapPercent.Div(decimal.NewFromInt(100)))
			consumedQty = consumedQty.Mul(factor)
		}

		unitCost := decimal.Zero
		var inv models.Inventory
		if err := tx.Where("product_id = ? AND outlet_id = ?", mat.MaterialProductID, order.OutletID).
			First(&inv).Error; err == nil {
			if inv.AverageCost != nil {
				unitCost = *inv.AverageCost
			}
		}

		pcMatID := mat.ID
		consumption := &models.MaterialConsumption{
			ProductionEntryID:    entry.ID,
			PipeConfigMaterialID: &pcMatID,
			MaterialProductID:    mat.MaterialProductID,
			OutletID:             order.OutletID,
			ConsumedQty:          consumedQty,
			UOM:                  mat.UOM,
			UnitCost:             unitCost,
			TotalCost:            unitCost.Mul(consumedQty),
			CreatedBy:            entry.CreatedBy,
		}
		if err := tx.Create(consumption).Error; err != nil {
			// Non-fatal: material product may not exist in this DB instance
			continue
		}
		// Deduct from inventory
		s.deductInventory(tx, mat.MaterialProductID, order.OutletID, consumedQty)
	}
	return nil
}

func (s *ProductionEntryService) checkMaterialStock(tx *gorm.DB, entry *models.ProductionEntry, req CreateProductionEntryRequest, order models.ProductionOrder) error {
	// If caller provided explicit consumptions, check each one
	if len(req.Consumptions) > 0 {
		for _, c := range req.Consumptions {
			var inv models.Inventory
			if err := tx.Where("product_id = ? AND outlet_id = ?", c.MaterialProductID, order.OutletID).First(&inv).Error; err != nil {
				continue // no record — will be caught later, allow through
			}
			if inv.QuantityOnHand.LessThan(c.ConsumedQty) {
				var prod models.Product
				name := fmt.Sprintf("product #%d", c.MaterialProductID)
				if tx.First(&prod, c.MaterialProductID).Error == nil {
					name = prod.Name
				}
				return &util.BusinessException{
					StatusCode: 400,
					Message: fmt.Sprintf("insufficient stock for %s: available %.2f, required %.2f",
						name, inv.QuantityOnHand.InexactFloat64(), c.ConsumedQty.InexactFloat64()),
				}
			}
		}
		return nil
	}

	// Auto-calculated consumptions from pipe config formula
	var materials []models.PipeConfigMaterial
	tx.Where("pipe_config_id = ? AND stage_type = ?", entry.PipeConfigID, entry.StageType).Find(&materials)

	qty := decimal.NewFromInt(int64(entry.PipesCompleted))
	var shortfalls []string
	for _, mat := range materials {
		consumedQty := mat.QuantityPerPipe.Mul(qty)
		if mat.ScrapPercent.GreaterThan(decimal.Zero) {
			factor := decimal.NewFromInt(1).Add(mat.ScrapPercent.Div(decimal.NewFromInt(100)))
			consumedQty = consumedQty.Mul(factor)
		}
		var inv models.Inventory
		if err := tx.Where("product_id = ? AND outlet_id = ?", mat.MaterialProductID, order.OutletID).First(&inv).Error; err != nil {
			continue // no inventory record — allow through (deductInventory handles this)
		}
		if inv.QuantityOnHand.LessThan(consumedQty) {
			var prod models.Product
			name := fmt.Sprintf("product #%d", mat.MaterialProductID)
			if tx.First(&prod, mat.MaterialProductID).Error == nil {
				name = prod.Name
			}
			shortfalls = append(shortfalls, fmt.Sprintf("%s (available: %.2f %s, required: %.2f %s)",
				name, inv.QuantityOnHand.InexactFloat64(), mat.UOM, consumedQty.InexactFloat64(), mat.UOM))
		}
	}
	if len(shortfalls) > 0 {
		return &util.BusinessException{
			StatusCode: 400,
			Message:    "insufficient raw material stock:\n" + strings.Join(shortfalls, "\n"),
		}
	}
	return nil
}

func (s *ProductionEntryService) deductInventory(tx *gorm.DB, productID, outletID int, qty decimal.Decimal) {
	var inv models.Inventory
	if err := tx.Where("product_id = ? AND outlet_id = ?", productID, outletID).First(&inv).Error; err != nil {
		return // inventory record doesn't exist yet — non-blocking
	}
	newQOH := inv.QuantityOnHand.Sub(qty)
	now := time.Now()
	tx.Model(&inv).Updates(map[string]interface{}{
		"quantity_on_hand":  newQOH,
		"last_stock_update": now,
	})
}

// creditFinishedGoodsInventory finds-or-creates a FINISHED_PIPE product for the
// pipe config and adds pipesCompleted to its inventory for the outlet.
func (s *ProductionEntryService) creditFinishedGoodsInventory(
	tx *gorm.DB,
	order models.ProductionOrder,
	pipesCompleted int,
	updatedBy string,
) error {
	if order.PipeConfig == nil {
		// Reload pipe config if not preloaded
		var pc models.PipeConfig
		if err := tx.First(&pc, order.PipeConfigID).Error; err != nil {
			return fmt.Errorf("pipe config %d not found: %w", order.PipeConfigID, err)
		}
		order.PipeConfig = &pc
	}

	productName := order.PipeConfig.Name // e.g. "PCCP 500mm 10kg"

	// 1. Find or create the finished-goods product
	var product models.Product
	result := tx.Where("name = ? AND item_type = ?", productName, "FINISHED_PIPE").First(&product)
	if result.Error == gorm.ErrRecordNotFound {
		product = models.Product{
			Name:           productName,
			ItemType:       "FINISHED_PIPE",
			ProductType:    "PHYSICAL",
			UnitOfMeasure:  "pcs",
			TrackInventory: true,
			Active:         true,
			UpdatedBy:      &updatedBy,
			CreatedBy:      &updatedBy,
		}
		if err := tx.Create(&product).Error; err != nil {
			return fmt.Errorf("failed to create finished-goods product: %w", err)
		}
	} else if result.Error != nil {
		return fmt.Errorf("error looking up finished-goods product: %w", result.Error)
	}

	// 2. Upsert the inventory record — add pipesCompleted to quantity_on_hand
	qty := decimal.NewFromInt(int64(pipesCompleted))
	now := time.Now()

	var inv models.Inventory
	invResult := tx.Where("product_id = ? AND outlet_id = ? AND variant_id IS NULL", product.ID, order.OutletID).First(&inv)
	if invResult.Error == gorm.ErrRecordNotFound {
		// Create fresh inventory record
		inv = models.Inventory{
			ProductID:       product.ID,
			OutletID:        order.OutletID,
			QuantityOnHand:  qty,
			ReorderLevel:    0,
			ReorderQuantity: 0,
			LastStockUpdate: &now,
			CreatedBy:       &updatedBy,
			UpdatedBy:       &updatedBy,
		}
		return tx.Create(&inv).Error
	} else if invResult.Error != nil {
		return fmt.Errorf("error looking up inventory: %w", invResult.Error)
	}

	// Increment existing record
	return tx.Model(&inv).Updates(map[string]interface{}{
		"quantity_on_hand":  inv.QuantityOnHand.Add(qty),
		"last_stock_update": now,
		"updated_by":        updatedBy,
	}).Error
}
