package models

import "time"

// ProcessContractorAssignment links a factory process to a specific supplier.
// FABRICATION and COATING: one row per process type. SPINNING: multiple rows allowed.
type ProcessContractorAssignment struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ProcessType string    `gorm:"column:process_type;index;size:50" json:"processType"`
	SupplierID  int       `gorm:"column:supplier_id" json:"supplierId"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	Supplier    *Supplier `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}

func (ProcessContractorAssignment) TableName() string { return "process_contractor_assignments" }
