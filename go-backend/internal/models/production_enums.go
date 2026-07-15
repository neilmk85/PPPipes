package models

// ProdStageType represents one of the 10 PCCP production process stages
type ProdStageType string

const (
	StageFabrication     ProdStageType = "FABRICATION"
	StageFabricationTest ProdStageType = "FABRICATION_TESTING"
	StageMoulding        ProdStageType = "MOULDING"
	StageSpinning        ProdStageType = "SPINNING"
	StageDemoulding      ProdStageType = "DEMOULDING"
	StageCuring1         ProdStageType = "CURING_1"
	StageCuring2         ProdStageType = "CURING_2"
	StageWinding         ProdStageType = "WINDING"
	StageCoating         ProdStageType = "COATING"
	StageFinalTesting    ProdStageType = "FINAL_TESTING"
)

// StageSequence defines the mandatory order of the 10 production stages
var StageSequence = []ProdStageType{
	StageFabrication, StageFabricationTest, StageMoulding,
	StageSpinning, StageDemoulding, StageCuring1,
	StageWinding, StageCoating, StageCuring2, StageFinalTesting,
}

// StageIndex returns the 0-based index of a stage in StageSequence, or -1 if not found
func StageIndex(stage ProdStageType) int {
	for i, s := range StageSequence {
		if s == stage {
			return i
		}
	}
	return -1
}

// MaterialStages lists the stages that consume raw materials
var MaterialStages = map[ProdStageType]bool{
	StageFabrication: true,
	StageSpinning:    true,
	StageWinding:     true,
	StageCoating:     true,
}

// BedType is used only during the SPINNING stage
type BedType string

const (
	BedSmall      BedType = "SMALL_BED"
	BedLarge      BedType = "LARGE_BED"
	BedExtraLarge BedType = "EXTRA_LARGE_BED"
)

// ProductionOrderStatus tracks the lifecycle of a production order
type ProductionOrderStatus string

const (
	ProdOrderDraft      ProductionOrderStatus = "DRAFT"
	ProdOrderPlanned    ProductionOrderStatus = "PLANNED"
	ProdOrderInProgress ProductionOrderStatus = "IN_PROGRESS"
	ProdOrderOnHold     ProductionOrderStatus = "ON_HOLD"
	ProdOrderCompleted  ProductionOrderStatus = "COMPLETED"
	ProdOrderCancelled  ProductionOrderStatus = "CANCELLED"
)

// MachineType categorises production machines
type MachineType string

const (
	MachineTypeFabrication MachineType = "FABRICATION"
	MachineTypeSpinning    MachineType = "SPINNING"
	MachineTypeWinding     MachineType = "WINDING"
	MachineTypeCoating     MachineType = "COATING"
	MachineTypeCuring      MachineType = "CURING"
	MachineTypeOther       MachineType = "OTHER"
)

// MachineStatus represents the operational state of a machine
type MachineStatus string

const (
	MachineActive      MachineStatus = "ACTIVE"
	MachineIdle        MachineStatus = "IDLE"
	MachineMaintenance MachineStatus = "MAINTENANCE"
	MachineRetired     MachineStatus = "RETIRED"
)

// ProdShiftName identifies a production shift
type ProdShiftName string

const (
	ShiftA ProdShiftName = "A"
	ShiftB ProdShiftName = "B"
	ShiftC ProdShiftName = "C"
)

// YardZoneType classifies a yard storage zone
type YardZoneType string

const (
	YardZoneWIP            YardZoneType = "WIP"
	YardZoneCuring         YardZoneType = "CURING"
	YardZoneFinishedGoods  YardZoneType = "FINISHED_GOODS"
	YardZoneDispatched     YardZoneType = "DISPATCHED"
)

// PipeStatus tracks an individual pipe's lifecycle in the yard
type PipeStatus string

const (
	PipeStatusWIP        PipeStatus = "WIP"
	PipeStatusCuring     PipeStatus = "CURING"
	PipeStatusReady      PipeStatus = "READY"
	PipeStatusDispatched PipeStatus = "DISPATCHED"
	PipeStatusScrapped   PipeStatus = "SCRAPPED"
)

// PlanningStatus tracks a production plan's lifecycle
type PlanningStatus string

const (
	PlanningDraft     PlanningStatus = "DRAFT"
	PlanningConfirmed PlanningStatus = "CONFIRMED"
	PlanningActive    PlanningStatus = "ACTIVE"
	PlanningCompleted PlanningStatus = "COMPLETED"
)

// CostType categorises cost sheet line items
type CostType string

const (
	CostTypeMaterial CostType = "MATERIAL"
	CostTypeLabor    CostType = "LABOR"
	CostTypeMachine  CostType = "MACHINE"
	CostTypeOverhead CostType = "OVERHEAD"
)
