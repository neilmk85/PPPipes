package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type ProductionOrderService struct {
	db *gorm.DB
}

func NewProductionOrderService(db *gorm.DB) *ProductionOrderService {
	return &ProductionOrderService{db: db}
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

type CreateProductionOrderRequest struct {
	SalesOrderID    *int       `json:"salesOrderId"`
	PipeConfigID    int        `json:"pipeConfigId"`
	OutletID        int        `json:"outletId"`
	PlannedQty      int        `json:"plannedQty"`
	PlannedStart    *time.Time `json:"plannedStartDate"`
	PlannedEnd      *time.Time `json:"plannedEndDate"`
	Notes           *string    `json:"notes"`
}

type UpdateProductionOrderStatusRequest struct {
	Status          string  `json:"status"`
	HoldReason      *string `json:"holdReason"`
	HoldQtyProduced *int    `json:"holdQtyProduced"`
}

// StageProgress summarises pipe counts for one stage
type StageProgress struct {
	StageType      models.ProdStageType `json:"stageType"`
	PipesProcessed int                  `json:"pipesProcessed"`
	PipesCompleted int                  `json:"pipesCompleted"`
	PipesRejected  int                  `json:"pipesRejected"`
	EntryCount     int                  `json:"entryCount"`
}

type ProductionProgress struct {
	ProductionOrderID int              `json:"productionOrderId"`
	PlannedQty        int              `json:"plannedQty"`
	Stages            []StageProgress  `json:"stages"`
}

// ── DTOs (summary) ────────────────────────────────────────────────────────────

// OrderSummary is a lightweight view of a production order used for list pages.
// FinishedPipes is the sum of pipesCompleted for FINAL_TESTING entries.
type OrderSummary struct {
	ID             int       `json:"id"`
	PONumber       string    `json:"poNumber"`
	PlannedQty     int       `json:"plannedQty"`
	Status         string    `json:"status"`
	OutletID       int       `json:"outletId"`
	FinishedPipes  int       `json:"finishedPipes"`
	PipeConfigID   int       `json:"pipeConfigId"`
	PipeConfigName string    `json:"pipeConfigName"`
	DiameterMm     int       `json:"diameterMm"`
	PressureClass  string    `json:"pressureClass"`
	LengthM        float64   `json:"lengthM"`
	CreatedAt      time.Time `json:"createdAt"`
}

// GetSummaries returns all production orders with their per-stage completed count.
// stage: which stage to measure completion against (defaults to FINAL_TESTING).
// finishedPipes = sum of pipes_completed for the given stage.
func (s *ProductionOrderService) GetSummaries(stage string) ([]OrderSummary, error) {
	if stage == "" {
		stage = "FINAL_TESTING"
	}
	var summaries []OrderSummary
	err := s.db.
		Table("production_orders po").
		Select(`po.id, po.po_number, po.planned_qty, po.status, po.outlet_id, po.pipe_config_id, po.created_at,
			pc.name AS pipe_config_name, pc.diameter_mm, pc.pressure_class, COALESCE(pc.length_m, 5.25) AS length_m,
			COALESCE(SUM(CASE WHEN pe.stage_type = ? THEN pe.pipes_completed ELSE 0 END), 0) AS finished_pipes`, stage).
		Joins("LEFT JOIN pipe_configs pc ON pc.id = po.pipe_config_id").
		Joins("LEFT JOIN production_entries pe ON pe.production_order_id = po.id").
		Group("po.id, po.po_number, po.planned_qty, po.status, po.outlet_id, po.pipe_config_id, po.created_at, pc.name, pc.diameter_mm, pc.pressure_class, pc.length_m").
		Order("po.created_at DESC").
		Scan(&summaries).Error
	return summaries, err
}

// ── Stage Overview ────────────────────────────────────────────────────────────

// StageOverviewRow holds, per pipe config, the total planned quantity from all
// ACTIVE (non-cancelled, non-completed) production orders, plus the cumulative
// pipes_completed at each stage for those same orders.
type StageOverviewRow struct {
	PipeConfigID       int    `gorm:"column:pipe_config_id"    json:"pipeConfigId"`
	PipeName           string `gorm:"column:pipe_name"         json:"pipeName"`
	DiameterMm         int    `gorm:"column:diameter_mm"       json:"diameterMm"`
	PressureClass      string `gorm:"column:pressure_class"    json:"pressureClass"`
	TotalPlanned       int    `gorm:"column:total_planned"     json:"totalPlanned"`
	Fabrication        int    `gorm:"column:fabrication"        json:"fabrication"`
	FabricationTesting int    `gorm:"column:fabrication_testing" json:"fabricationTesting"`
	Moulding           int    `gorm:"column:moulding"           json:"moulding"`
	Spinning           int    `gorm:"column:spinning"           json:"spinning"`
	Demoulding         int    `gorm:"column:demoulding"         json:"demoulding"`
	Curing1            int    `gorm:"column:curing_1"           json:"curing1"`
	Curing2            int    `gorm:"column:curing_2"           json:"curing2"`
	Winding            int    `gorm:"column:winding"            json:"winding"`
	Coating            int    `gorm:"column:coating"            json:"coating"`
	FinalTesting       int    `gorm:"column:final_testing"      json:"finalTesting"`
}

// GetStageOverview returns one row per pipe config that has at least one active
// production order (status not in CANCELLED / COMPLETED).
//
// total_planned  = SUM(planned_qty) from active orders only — computed in a
//                  subquery so it is never inflated by the entry-level join.
// per-stage done = SUM(pipes_completed) from entries that belong to active orders.
func (s *ProductionOrderService) GetStageOverview() ([]StageOverviewRow, error) {
	var rows []StageOverviewRow
	err := s.db.Raw(`
		SELECT
			pc.id   AS pipe_config_id,
			pc.name AS pipe_name,
			pc.diameter_mm,
			pc.pressure_class,
			plans.total_planned,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'FABRICATION'         THEN pe.pipes_completed ELSE 0 END), 0) AS fabrication,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'FABRICATION_TESTING' THEN pe.pipes_completed ELSE 0 END), 0) AS fabrication_testing,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'MOULDING'            THEN pe.pipes_completed ELSE 0 END), 0) AS moulding,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'SPINNING'            THEN pe.pipes_completed ELSE 0 END), 0) AS spinning,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'DEMOULDING'          THEN pe.pipes_completed ELSE 0 END), 0) AS demoulding,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'CURING_1'            THEN pe.pipes_completed ELSE 0 END), 0) AS curing_1,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'CURING_2'            THEN pe.pipes_completed ELSE 0 END), 0) AS curing_2,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'WINDING'             THEN pe.pipes_completed ELSE 0 END), 0) AS winding,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'COATING'             THEN pe.pipes_completed ELSE 0 END), 0) AS coating,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'FINAL_TESTING'       THEN pe.pipes_completed ELSE 0 END), 0) AS final_testing
		FROM pipe_configs pc
		INNER JOIN (
			SELECT pipe_config_id, SUM(planned_qty) AS total_planned
			FROM   production_orders
			WHERE  status NOT IN ('CANCELLED', 'COMPLETED')
			GROUP  BY pipe_config_id
		) plans ON plans.pipe_config_id = pc.id
		LEFT JOIN production_orders po
			ON  po.pipe_config_id = pc.id
			AND po.status NOT IN ('CANCELLED', 'COMPLETED')
		LEFT JOIN production_entries pe ON pe.production_order_id = po.id
		GROUP BY pc.id, pc.name, pc.diameter_mm, pc.pressure_class, plans.total_planned
		ORDER BY pc.name ASC
	`).Scan(&rows).Error
	return rows, err
}

// PipeSummary aggregates production data per pipe type across all orders.
type PipeSummary struct {
	PipeConfigID   int    `json:"pipeConfigId"`
	PipeName       string `json:"pipeName"`
	DiameterMm     int    `json:"diameterMm"`
	PressureClass  string `json:"pressureClass"`
	TotalOrdered   int    `json:"totalOrdered"`
	TotalFinished  int    `json:"totalFinished"`
	TotalRejected  int    `json:"totalRejected"`
}

// GetPipeSummary returns one row per pipe config with totals summed across all
// production orders. Optional filters:
//   - pipeName: partial case-insensitive match on pc.name
//   - fromDate/toDate: restrict FINAL_TESTING entries by entry_date
//
// totalOrdered is always the full plannedQty sum (unaffected by date).
// totalFinished counts FINAL_TESTING pipesCompleted within the date window.
func (s *ProductionOrderService) GetPipeSummary(pipeName, fromDate, toDate string) ([]PipeSummary, error) {
	// Build the conditional expression for finished pipes so the date filter
	// only narrows the FINAL_TESTING rows, not the whole join.
	finishedExpr := `CASE WHEN pe.stage_type = 'FINAL_TESTING'`
	var args []interface{}
	if fromDate != "" {
		finishedExpr += ` AND pe.entry_date >= ?`
		args = append(args, fromDate)
	}
	if toDate != "" {
		finishedExpr += ` AND pe.entry_date <= ?`
		args = append(args, toDate)
	}
	finishedExpr += ` THEN pe.pipes_completed ELSE 0 END`

	q := s.db.
		Table("pipe_configs pc").
		Select(`pc.id AS pipe_config_id, pc.name AS pipe_name, pc.diameter_mm, pc.pressure_class,
			COALESCE(SUM(po.planned_qty), 0) AS total_ordered,
			COALESCE(SUM(`+finishedExpr+`), 0) AS total_finished,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'FINAL_TESTING' THEN pe.pipes_rejected ELSE 0 END), 0) AS total_rejected`, args...).
		Joins("LEFT JOIN production_orders po ON po.pipe_config_id = pc.id").
		Joins("LEFT JOIN production_entries pe ON pe.production_order_id = po.id").
		Group("pc.id, pc.name, pc.diameter_mm, pc.pressure_class").
		Order("pc.name ASC")

	if pipeName != "" {
		q = q.Where("pc.name LIKE ?", "%"+pipeName+"%")
	}

	var rows []PipeSummary
	return rows, q.Scan(&rows).Error
}

// IntermediateStock holds pipe counts waiting at key intermediate stages.
type IntermediateStock struct {
	PipeConfigID  int    `json:"pipeConfigId"`
	PipeName      string `json:"pipeName"`
	DiameterMm    int    `json:"diameterMm"`
	PressureClass string `json:"pressureClass"`
	Curing1       int    `json:"curing1"`
	Curing2       int    `json:"curing2"`
	FinalTesting  int    `json:"finalTesting"`
	Total         int    `json:"total"`
}

// AllStagesStock holds pipe counts at every production stage.
type AllStagesStock struct {
	PipeConfigID       int    `json:"pipeConfigId"`
	PipeName           string `json:"pipeName"`
	DiameterMm         int    `json:"diameterMm"`
	PressureClass      string `json:"pressureClass"`
	Fabrication        int    `json:"fabrication"`
	FabricationTesting int    `json:"fabricationTesting"`
	Moulding           int    `json:"moulding"`
	Spinning           int    `json:"spinning"`
	Demoulding         int    `json:"demoulding"`
	Curing1            int    `json:"curing1"`
	Curing2            int    `json:"curing2"`
	Winding            int    `json:"winding"`
	Coating            int    `json:"coating"`
	FinalTesting       int    `json:"finalTesting"`
	Total              int    `json:"total"`
}

// GetAllStagesStock returns, per pipe config, how many pipes completed each
// production stage. Optionally filtered by entry_date range (YYYY-MM-DD strings).
func (s *ProductionOrderService) GetAllStagesStock(fromDate, toDate string) ([]AllStagesStock, error) {
	var rows []AllStagesStock
	// Join directly via pe.pipe_config_id (the entry's own FK) to avoid
	// missing rows when a production_order's pipe_config_id diverges from the entry.
	q := s.db.
		Table("pipe_configs pc").
		Select(`
			pc.id  AS pipe_config_id,
			pc.name AS pipe_name,
			pc.diameter_mm,
			pc.pressure_class,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'FABRICATION'         THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS fabrication,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'FABRICATION_TESTING' THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS fabrication_testing,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'MOULDING'            THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS moulding,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'SPINNING'            THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS spinning,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'DEMOULDING'          THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS demoulding,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'CURING_1'            THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS curing1,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'CURING_2'            THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS curing2,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'WINDING'             THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS winding,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'COATING'             THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS coating,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'FINAL_TESTING'       THEN GREATEST(pe.pipes_processed, pe.pipes_completed) ELSE 0 END), 0) AS final_testing`).
		Joins("LEFT JOIN production_entries pe ON pe.pipe_config_id = pc.id")

	if fromDate != "" {
		q = q.Where("pe.entry_date >= ?", fromDate)
	}
	if toDate != "" {
		q = q.Where("pe.entry_date <= ?", toDate)
	}

	err := q.
		Group("pc.id, pc.name, pc.diameter_mm, pc.pressure_class").
		Order("pc.name ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	// Compute totals and drop rows where every stage is zero (pipe configs with
	// no entries at all). Filtering in Go avoids HAVING alias issues in MySQL.
	result := rows[:0]
	for _, r := range rows {
		r.Total = r.Fabrication + r.FabricationTesting + r.Moulding +
			r.Spinning + r.Demoulding + r.Curing1 + r.Curing2 +
			r.Winding + r.Coating + r.FinalTesting
		if r.Total > 0 {
			result = append(result, r)
		}
	}
	return result, nil
}

// GetIntermediateStock returns, per pipe config, how many pipes are currently
// sitting at CURING_1, CURING_2, and FINAL_TESTING stages.
// Optionally filtered by entry_date range (YYYY-MM-DD strings).
func (s *ProductionOrderService) GetIntermediateStock(fromDate, toDate string) ([]IntermediateStock, error) {
	var rows []IntermediateStock
	q := s.db.
		Table("pipe_configs pc").
		Select(`
			pc.id  AS pipe_config_id,
			pc.name AS pipe_name,
			pc.diameter_mm,
			pc.pressure_class,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'CURING_1'      THEN pe.pipes_completed ELSE 0 END), 0) AS curing1,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'CURING_2'      THEN pe.pipes_completed ELSE 0 END), 0) AS curing2,
			COALESCE(SUM(CASE WHEN pe.stage_type = 'FINAL_TESTING' THEN pe.pipes_completed ELSE 0 END), 0) AS final_testing`).
		Joins("LEFT JOIN production_orders po ON po.pipe_config_id = pc.id").
		Joins("LEFT JOIN production_entries pe ON pe.production_order_id = po.id")

	if fromDate != "" {
		q = q.Where("pe.entry_date >= ?", fromDate)
	}
	if toDate != "" {
		q = q.Where("pe.entry_date <= ?", toDate)
	}

	err := q.
		Group("pc.id, pc.name, pc.diameter_mm, pc.pressure_class").
		Order("pc.name ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := rows[:0]
	for _, r := range rows {
		r.Total = r.Curing1 + r.Curing2 + r.FinalTesting
		if r.Total > 0 {
			result = append(result, r)
		}
	}
	return result, nil
}

// ── Query methods ─────────────────────────────────────────────────────────────

func (s *ProductionOrderService) GetAll(outletID, soID, pipeConfigID *int, status *string, page, size int) ([]models.ProductionOrder, int64, error) {
	q := s.db.Model(&models.ProductionOrder{})
	if outletID != nil {
		q = q.Where("outlet_id = ?", *outletID)
	}
	if soID != nil {
		q = q.Where("sales_order_id = ?", *soID)
	}
	if pipeConfigID != nil {
		q = q.Where("pipe_config_id = ?", *pipeConfigID)
	}
	if status != nil {
		q = q.Where("status = ?", *status)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var orders []models.ProductionOrder
	err := q.
		Preload("PipeConfig").
		Preload("SalesOrder").
		Order("created_at DESC").
		Offset(page * size).Limit(size).
		Find(&orders).Error
	return orders, total, err
}

func (s *ProductionOrderService) GetByID(id int) (*models.ProductionOrder, error) {
	var order models.ProductionOrder
	err := s.db.
		Preload("PipeConfig").
		Preload("PipeConfig.Materials").
		Preload("PipeConfig.Materials.MaterialProduct").
		Preload("Outlet").
		Preload("SalesOrder").
		First(&order, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Production order %d not found", id)}
	}
	return &order, err
}

// ── Mutation methods ──────────────────────────────────────────────────────────

func (s *ProductionOrderService) Create(req CreateProductionOrderRequest, userID int, createdBy string) (*models.ProductionOrder, error) {
	if req.PipeConfigID == 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "pipeConfigId is required"}
	}
	if req.OutletID == 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "outletId is required"}
	}
	if req.PlannedQty <= 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "plannedQty must be > 0"}
	}

	// Verify pipe config exists
	var pc models.PipeConfig
	if err := s.db.First(&pc, req.PipeConfigID).Error; err != nil {
		return nil, &util.BusinessException{StatusCode: 400, Message: "pipeConfigId not found"}
	}

	poNumber, err := util.GenerateProductionOrderNumber(s.db)
	if err != nil {
		return nil, err
	}

	order := &models.ProductionOrder{
		PONumber:        poNumber,
		SalesOrderID:    req.SalesOrderID,
		PipeConfigID:    req.PipeConfigID,
		OutletID:        req.OutletID,
		PlannedQty:      req.PlannedQty,
		Status:          models.ProdOrderDraft,
		PlannedStart:    req.PlannedStart,
		PlannedEnd:      req.PlannedEnd,
		Notes:           req.Notes,
		CreatedByUserID: &userID,
		CreatedBy:       &createdBy,
		UpdatedBy:       &createdBy,
	}
	if err := s.db.Create(order).Error; err != nil {
		return nil, err
	}
	return s.GetByID(order.ID)
}

func (s *ProductionOrderService) UpdateStatus(id int, req UpdateProductionOrderStatusRequest, updatedBy string) (*models.ProductionOrder, error) {
	order, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}

	newStatus := models.ProductionOrderStatus(req.Status)
	switch newStatus {
	case models.ProdOrderDraft, models.ProdOrderPlanned, models.ProdOrderInProgress,
		models.ProdOrderOnHold, models.ProdOrderCompleted, models.ProdOrderCancelled:
	default:
		return nil, &util.BusinessException{StatusCode: 400, Message: "invalid status value"}
	}

	now := time.Now()
	if newStatus == models.ProdOrderInProgress && order.ActualStart == nil {
		order.ActualStart = &now
	}
	if newStatus == models.ProdOrderCompleted && order.ActualEnd == nil {
		order.ActualEnd = &now
	}
	if newStatus == models.ProdOrderOnHold {
		order.HoldAt = &now
		order.HoldReason = req.HoldReason
		order.HoldQtyProduced = req.HoldQtyProduced
	}
	// Resume from hold — clear hold snapshot
	if newStatus == models.ProdOrderInProgress && order.Status == models.ProdOrderOnHold {
		order.HoldAt = nil
		order.HoldReason = nil
		order.HoldQtyProduced = nil
	}

	order.Status = newStatus
	order.UpdatedBy = &updatedBy
	if err := s.db.Save(order).Error; err != nil {
		return nil, err
	}
	return order, nil
}

func (s *ProductionOrderService) GetProgress(id int) (*ProductionProgress, error) {
	order, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}

	var entries []models.ProductionEntry
	s.db.Where("production_order_id = ?", id).Find(&entries)

	// Aggregate per stage
	stageMap := make(map[models.ProdStageType]*StageProgress)
	for _, stage := range models.StageSequence {
		stageMap[stage] = &StageProgress{StageType: stage}
	}
	for _, e := range entries {
		sp := stageMap[e.StageType]
		sp.PipesProcessed += e.PipesProcessed
		sp.PipesCompleted += e.PipesCompleted
		sp.PipesRejected += e.PipesRejected
		sp.EntryCount++
	}

	stages := make([]StageProgress, 0, len(models.StageSequence))
	for _, stage := range models.StageSequence {
		stages = append(stages, *stageMap[stage])
	}

	return &ProductionProgress{
		ProductionOrderID: id,
		PlannedQty:        order.PlannedQty,
		Stages:            stages,
	}, nil
}
