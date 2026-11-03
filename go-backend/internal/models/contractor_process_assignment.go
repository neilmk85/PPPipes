package models

import "time"

// ContractorProcessAssignment records which contractor is assigned to a production process,
// with the date they commenced. Multiple rows per process are kept as history.
// The active assignment is the one with the latest commenced_at <= today.
type ContractorProcessAssignment struct {
	ID           uint        `gorm:"primaryKey;autoIncrement" json:"id"`
	ContractorID int         `gorm:"column:contractor_id;not null;index" json:"contractorId"`
	ProcessType  string      `gorm:"column:process_type;not null;size:50;index" json:"processType"`
	CommencedAt  time.Time   `gorm:"column:commenced_at;not null" json:"commencedAt"`
	CreatedAt    time.Time   `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	Contractor   *Contractor `gorm:"foreignKey:ContractorID" json:"contractor,omitempty"`
}

func (ContractorProcessAssignment) TableName() string {
	return "contractor_process_assignments"
}

// ContractorProcessType defines the assignable process types for contractor tracking.
// SPINNING is split by bed size since separate contractors can run each bed.
const (
	ContractorProcFabrication       = "FABRICATION"
	ContractorProcFabricationTest   = "FABRICATION_TESTING"
	ContractorProcSpinningSmallBed  = "SPINNING_SMALL_BED"
	ContractorProcSpinningLargeBed  = "SPINNING_LARGE_BED"
	ContractorProcWinding           = "WINDING"
	ContractorProcCoating           = "COATING"
	ContractorProcWinding2          = "WINDING_2"
	ContractorProcCoating2          = "COATING_2"
)
