package models

import "time"

// ProductionEntry records a single data-entry event for one process stage within a production order.
// Users fill this in for each of the 9 stages: Pipe Type, Date, Pipes Processed, Notes.
type ProductionEntry struct {
	ID                int           `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ProductionOrderID int           `gorm:"index;column:production_order_id" json:"productionOrderId"`
	PipeConfigID      int           `gorm:"column:pipe_config_id" json:"pipeConfigId"`
	StageType         ProdStageType `gorm:"column:stage_type" json:"stageType"`

	// Core user inputs — the same 4 fields for every process
	PipesProcessed int       `gorm:"column:pipes_processed" json:"pipesProcessed"` // pipes entering this stage
	PipesCompleted int       `gorm:"column:pipes_completed" json:"pipesCompleted"` // pipes successfully completing
	PipesRejected  int       `gorm:"column:pipes_rejected;default:0" json:"pipesRejected"`
	EntryDate      time.Time `gorm:"column:entry_date;type:date" json:"entryDate"`
	Notes          *string   `gorm:"column:notes;type:text" json:"notes"`

	// SPINNING-only field; must be NULL for all other stages
	BedType *BedType `gorm:"column:bed_type" json:"bedType"`

	// Optional operational metadata
	MachineID       *int           `gorm:"column:machine_id" json:"machineId"`
	ShiftName       *ProdShiftName `gorm:"column:shift_name" json:"shiftName"`
	OperatorUserID  *int           `gorm:"column:operator_user_id" json:"operatorUserId"`
	CreatedByUserID *int           `gorm:"column:created_by_user_id" json:"createdByUserId"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy *string   `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy *string   `gorm:"column:updated_by" json:"updatedBy"`

	ProductionOrder *ProductionOrder      `gorm:"foreignKey:ProductionOrderID" json:"productionOrder,omitempty"`
	PipeConfig      *PipeConfig           `gorm:"foreignKey:PipeConfigID" json:"pipeConfig,omitempty"`
	Machine         *ProductionMachine    `gorm:"foreignKey:MachineID" json:"machine,omitempty"`
	Consumptions    []MaterialConsumption `gorm:"foreignKey:ProductionEntryID" json:"consumptions,omitempty"`
}

func (ProductionEntry) TableName() string { return "production_entries" }
