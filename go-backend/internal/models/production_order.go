package models

import "time"

// ProductionOrder tracks a batch production job for a specific pipe configuration.
type ProductionOrder struct {
	ID             int                   `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	PONumber       string                `gorm:"uniqueIndex;size:191;column:po_number" json:"poNumber"` // auto-generated, e.g. "PRD-2025-0001"
	SalesOrderID   *int                  `gorm:"column:sales_order_id" json:"salesOrderId"`    // nullable — production can start without a SO
	PipeConfigID   *int                  `gorm:"column:pipe_config_id" json:"pipeConfigId"`
	DiameterMm     int                   `gorm:"column:diameter_mm;default:0" json:"diameterMm"`
	OutletID       int                   `gorm:"column:outlet_id" json:"outletId"`
	PlannedQty     int                   `gorm:"column:planned_qty" json:"plannedQty"`
	Status         ProductionOrderStatus `gorm:"column:status;default:DRAFT" json:"status"`
	PlannedStart   *time.Time            `gorm:"column:planned_start_date" json:"plannedStartDate"`
	PlannedEnd     *time.Time            `gorm:"column:planned_end_date" json:"plannedEndDate"`
	ActualStart    *time.Time            `gorm:"column:actual_start_date" json:"actualStartDate"`
	ActualEnd      *time.Time            `gorm:"column:actual_end_date" json:"actualEndDate"`
	Notes           *string               `gorm:"column:notes;type:text" json:"notes"`
	HoldReason      *string               `gorm:"column:hold_reason;type:text" json:"holdReason"`
	HoldAt          *time.Time            `gorm:"column:hold_at" json:"holdAt"`
	HoldQtyProduced *int                  `gorm:"column:hold_qty_produced" json:"holdQtyProduced"`
	CompletionQty   *int                  `gorm:"column:completion_qty" json:"completionQty"`
	CompletionNote  *string               `gorm:"column:completion_note;type:text" json:"completionNote"`
	IsEarlyComplete bool                  `gorm:"column:is_early_complete;default:false" json:"isEarlyComplete"`
	CreatedByUserID *int                  `gorm:"column:created_by_user_id" json:"createdByUserId"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy *string   `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy *string   `gorm:"column:updated_by" json:"updatedBy"`

	SalesOrder *SalesOrder        `gorm:"foreignKey:SalesOrderID" json:"salesOrder,omitempty"`
	PipeConfig *PipeConfig        `gorm:"foreignKey:PipeConfigID;references:ID" json:"pipeConfig,omitempty"`
	Outlet     *Outlet            `gorm:"foreignKey:OutletID" json:"outlet,omitempty"`
	Entries    []ProductionEntry  `gorm:"foreignKey:ProductionOrderID" json:"entries,omitempty"`
	CostSheet  *CostSheet         `gorm:"foreignKey:ProductionOrderID" json:"costSheet,omitempty"`
}

func (ProductionOrder) TableName() string { return "production_orders" }
