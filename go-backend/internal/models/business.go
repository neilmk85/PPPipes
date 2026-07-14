package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// ─── Silo Fill ────────────────────────────────────────────────────────────────
// Records each bulk cement fill event into a specific silo (1, 2 or 3).
// Silo 1 & 2 feed the Spinning stage; Silo 3 feeds the Coating stage.

type SiloFill struct {
	ID         uint            `gorm:"primaryKey;autoIncrement" json:"id"`
	Date       DateOnly        `gorm:"column:date;type:date;not null" json:"date"`
	SiloNumber int             `gorm:"column:silo_number;not null" json:"siloNumber"` // 1, 2 or 3
	QuantityMT decimal.Decimal `gorm:"column:quantity_mt;type:decimal(10,4);not null" json:"quantityMt"`
	Notes      string          `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt  time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (SiloFill) TableName() string { return "biz_silo_fills" }

// ─── Cement Bags ──────────────────────────────────────────────────────────────

type CementBag struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	Quantity  int       `gorm:"column:quantity;not null" json:"quantity"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (CementBag) TableName() string { return "biz_cement_bags" }

// ─── Vehicles ─────────────────────────────────────────────────────────────────

type Vehicle struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date         DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	CraneEnabled bool      `gorm:"column:crane_enabled;default:false" json:"craneEnabled"`
	CraneDiesel  string    `gorm:"column:crane_diesel" json:"craneDiesel"`
	CraneHours   string    `gorm:"column:crane_hours" json:"craneHours"`
	JcbEnabled   bool      `gorm:"column:jcb_enabled;default:false" json:"jcbEnabled"`
	JcbDiesel    string    `gorm:"column:jcb_diesel" json:"jcbDiesel"`
	JcbHours     string    `gorm:"column:jcb_hours" json:"jcbHours"`
	Notes        string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Vehicle) TableName() string { return "biz_vehicles" }

// ─── Maintenance ──────────────────────────────────────────────────────────────

type Maintenance struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	Process   string    `gorm:"column:process;not null" json:"process"`
	Vendor    string    `gorm:"column:vendor;not null" json:"vendor"`
	Amount    string    `gorm:"column:amount" json:"amount"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Maintenance) TableName() string { return "biz_maintenance" }

// ─── Silo ─────────────────────────────────────────────────────────────────────

type Silo struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	Silo1Value string   `gorm:"column:silo1_value" json:"silo1Value"`
	Silo1Unit  string   `gorm:"column:silo1_unit;default:MT" json:"silo1Unit"`
	Silo2Value string   `gorm:"column:silo2_value" json:"silo2Value"`
	Silo2Unit  string   `gorm:"column:silo2_unit;default:MT" json:"silo2Unit"`
	Silo3Value string   `gorm:"column:silo3_value" json:"silo3Value"`
	Silo3Unit  string   `gorm:"column:silo3_unit;default:MT" json:"silo3Unit"`
	Notes      string   `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Silo) TableName() string { return "biz_silos" }

// ─── Silo Extraction ──────────────────────────────────────────────────────────

type SiloExtraction struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date       DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	Silo1Value string    `gorm:"column:silo1_value" json:"silo1Value"`
	Silo1Unit  string    `gorm:"column:silo1_unit;default:MT" json:"silo1Unit"`
	Silo2Value string    `gorm:"column:silo2_value" json:"silo2Value"`
	Silo2Unit  string    `gorm:"column:silo2_unit;default:MT" json:"silo2Unit"`
	Silo3Value string    `gorm:"column:silo3_value" json:"silo3Value"`
	Silo3Unit  string    `gorm:"column:silo3_unit;default:MT" json:"silo3Unit"`
	Notes      string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (SiloExtraction) TableName() string { return "biz_silo_extractions" }

// ─── Diesel Maintenance ───────────────────────────────────────────────────────

type DieselMaintenance struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	Process   string    `gorm:"column:process;not null" json:"process"`
	Quantity  string    `gorm:"column:quantity" json:"quantity"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (DieselMaintenance) TableName() string { return "biz_diesel_maintenance" }

// ─── Store Room Material ──────────────────────────────────────────────────────

type StoreRoomMaterial struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	ItemName  string    `gorm:"column:item_name;not null" json:"itemName"`
	ItemType  string    `gorm:"column:item_type" json:"itemType"`
	Quantity  string    `gorm:"column:quantity" json:"quantity"`
	Uom       string    `gorm:"column:uom" json:"uom"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (StoreRoomMaterial) TableName() string { return "biz_store_room_materials" }

// ─── Extra Vehicles ───────────────────────────────────────────────────────────

type ExtraVehicle struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	Vendor    string    `gorm:"column:vendor" json:"vendor"`
	Vehicles  string    `gorm:"column:vehicles;type:json" json:"vehicles"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (ExtraVehicle) TableName() string { return "biz_extra_vehicles" }

// ─── Testing Lab ──────────────────────────────────────────────────────────────

type TestingLab struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date        DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	CsEnabled   bool      `gorm:"column:cs_enabled;default:false" json:"csEnabled"`
	CsDay7      string    `gorm:"column:cs_day7" json:"csDay7"`
	CsDay28     string    `gorm:"column:cs_day28" json:"csDay28"`
	PpEnabled   bool      `gorm:"column:pp_enabled;default:false" json:"ppEnabled"`
	PpNotes     string    `gorm:"column:pp_notes;type:text" json:"ppNotes"`
	NpEnabled   bool      `gorm:"column:np_enabled;default:false" json:"npEnabled"`
	NpNotes     string    `gorm:"column:np_notes;type:text" json:"npNotes"`
	BtEnabled   bool      `gorm:"column:bt_enabled;default:false" json:"btEnabled"`
	BtNotes     string    `gorm:"column:bt_notes;type:text" json:"btNotes"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (TestingLab) TableName() string { return "biz_testing_labs" }

// ─── Conversion ───────────────────────────────────────────────────────────────

type BizConversion struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	FromPipe  string    `gorm:"column:from_pipe" json:"fromPipe"`
	ToPipe    string    `gorm:"column:to_pipe" json:"toPipe"`
	Quantity  string    `gorm:"column:quantity" json:"quantity"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (BizConversion) TableName() string { return "biz_conversions" }

// ─── Cutting ──────────────────────────────────────────────────────────────────

type BizCutting struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	FromSheet string    `gorm:"column:from_sheet;size:100;not null" json:"fromSheet"`
	ToSheet   string    `gorm:"column:to_sheet;size:100;not null" json:"toSheet"`
	Quantity  int       `gorm:"column:quantity;not null" json:"quantity"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (BizCutting) TableName() string { return "biz_cuttings" }

// ─── Discard ──────────────────────────────────────────────────────────────────

type Discard struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date      DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	Process   string    `gorm:"column:process" json:"process"`
	PipeName  string    `gorm:"column:pipe_name" json:"pipeName"`
	Quantity  string    `gorm:"column:quantity" json:"quantity"`
	Notes     string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Discard) TableName() string { return "biz_discards" }

// ─── PDI ──────────────────────────────────────────────────────────────────────

type PDI struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date          DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	ThirdParty    string    `gorm:"column:third_party" json:"thirdParty"`
	PipeName      string    `gorm:"column:pipe_name" json:"pipeName"`
	Quantity      string    `gorm:"column:quantity" json:"quantity"`
	Finishing     bool      `gorm:"column:finishing;default:false" json:"finishing"`
	Colour        bool      `gorm:"column:colour;default:false" json:"colour"`
	Numbering     bool      `gorm:"column:numbering;default:false" json:"numbering"`
	Ghola         bool      `gorm:"column:ghola;default:false" json:"ghola"`
	QualityCheck  bool      `gorm:"column:quality_check;default:false" json:"qualityCheck"`
	DiameterCheck bool      `gorm:"column:diameter_check;default:false" json:"diameterCheck"`
	Notes         string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (PDI) TableName() string { return "biz_pdis" }

// ─── Loading Record ───────────────────────────────────────────────────────────

type LoadingRecord struct {
	ID               uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date             DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	PipeName         string    `gorm:"column:pipe_name;not null" json:"pipeName"`
	LengthM          float64   `gorm:"column:length_m;type:decimal(5,2);default:5.25" json:"lengthM"`
	Quantity         int       `gorm:"column:quantity;not null" json:"quantity"`
	VehicleNo        string    `gorm:"column:vehicle_no" json:"vehicleNo"`
	DriverName       string    `gorm:"column:driver_name" json:"driverName"`
	DriverContact    string    `gorm:"column:driver_contact" json:"driverContact"`
	Vendor           string    `gorm:"column:vendor" json:"vendor"`
	SiteAddress      string    `gorm:"column:site_address;type:text" json:"siteAddress"`
	TransportRate    string    `gorm:"column:transport_rate" json:"transportRate"`
	RateType         string    `gorm:"column:rate_type;default:per_pipe" json:"rateType"` // per_pipe | per_trip
	Notes            string    `gorm:"column:notes;type:text" json:"notes"`
	CustomerName     string    `gorm:"column:customer_name" json:"customerName"`
	CustomerPONo     string    `gorm:"column:customer_po_no" json:"customerPoNo"`
	PipeNo           string    `gorm:"column:pipe_no" json:"pipeNo"`
	ChallanPhotoURL  *string   `gorm:"column:challan_photo_url" json:"challanPhotoUrl"`
	InvoiceID        *int      `gorm:"column:invoice_id" json:"invoiceId"`
	InvoiceNumber    string    `gorm:"column:invoice_number" json:"invoiceNumber"`
	CreatedAt        time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (LoadingRecord) TableName() string { return "biz_loading_records" }

// ─── Labour ───────────────────────────────────────────────────────────────────

type Labour struct {
	ID                  uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date                DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	ContractorName      string    `gorm:"column:contractor_name;not null" json:"contractorName"`
	LabourCount         int       `gorm:"column:labour_count;not null" json:"labourCount"`
	RatePerDay          string    `gorm:"column:rate_per_day" json:"ratePerDay"`
	OvertimeHours        string    `gorm:"column:overtime_hours" json:"overtimeHours"`                          // optional decimal hours
	OvertimeLabourCount  int       `gorm:"column:overtime_labour_count;default:0" json:"overtimeLabourCount"`   // how many labours did OT
	OvertimeRatePerHour  string    `gorm:"column:overtime_rate_per_hour" json:"overtimeRatePerHour"`            // optional ₹ per hour per labour
	Notes               string    `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt           time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt           time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Labour) TableName() string { return "biz_labour" }

// ─── Business Rate Config ─────────────────────────────────────────────────────
// Single-row settings table (always upserted on ID = 1).

type BusinessRateConfig struct {
	ID                        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SmallBedRate              string    `gorm:"column:small_bed_rate" json:"smallBedRate"`                           // ₹ per pipe (moulding)
	LargeBedRate              string    `gorm:"column:large_bed_rate" json:"largeBedRate"`                           // ₹ per pipe (moulding)
	LabourRatePerDay          string    `gorm:"column:labour_rate_per_day" json:"labourRatePerDay"`                  // ₹ per labour per day
	OTRatePerHour             string    `gorm:"column:ot_rate_per_hour" json:"otRatePerHour"`                        // ₹ per labour per OT hour
	FabricationRateKg         string    `gorm:"column:fabrication_rate_kg" json:"fabricationRateKg"`                 // ₹ per kg
	SpinningSmallBedRate      string    `gorm:"column:spinning_small_bed_rate" json:"spinningSmallBedRate"`          // ₹ per pipe (spinning)
	SpinningLargeBedRate      string    `gorm:"column:spinning_large_bed_rate" json:"spinningLargeBedRate"`          // ₹ per pipe (spinning)
	SpinningExtraLargeBedRate string    `gorm:"column:spinning_extra_large_bed_rate" json:"spinningExtraLargeBedRate"` // ₹ per pipe (spinning)
	CoatingRate               string    `gorm:"column:coating_rate" json:"coatingRate"`                              // ₹ per pipe (coating)
	CreatedAt                 time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt                 time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (BusinessRateConfig) TableName() string { return "biz_rate_config" }

// ─── Coating Contractor Rate ──────────────────────────────────────────────────
// Per-diameter flat rate paid to the coating contractor (₹ per pipe).

type CoatingContractorRate struct {
	ID          uint            `gorm:"primaryKey;autoIncrement" json:"id"`
	DiameterMm  int             `gorm:"column:diameter_mm;uniqueIndex" json:"diameterMm"`
	RatePerPipe decimal.Decimal `gorm:"column:rate_per_pipe;type:decimal(10,2)" json:"ratePerPipe"`
	CreatedAt   time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (CoatingContractorRate) TableName() string { return "coating_contractor_rates" }

// ─── Spinning Bed Rate ────────────────────────────────────────────────────────
// Per-diameter, per-bed-size rate paid to the spinning contractor (₹ per pipe).

type SpinningBedRate struct {
	ID          uint            `gorm:"primaryKey;autoIncrement" json:"id"`
	BedSize     string          `gorm:"column:bed_size;index:idx_spinning_bed_dia" json:"bedSize"` // SMALL_BED | LARGE_BED
	DiameterMm  int             `gorm:"column:diameter_mm;index:idx_spinning_bed_dia" json:"diameterMm"`
	RatePerPipe decimal.Decimal `gorm:"column:rate_per_pipe;type:decimal(10,2)" json:"ratePerPipe"`
	CreatedAt   time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (SpinningBedRate) TableName() string { return "spinning_bed_rates" }

// ─── Third-Party Pipe Purchase ────────────────────────────────────────────────
// Records a direct purchase of finished pipes from an external vendor.
// On creation the matching finished-goods inventory record is credited.
// On deletion the inventory credit is reversed.

type ThirdPartyPipePurchase struct {
	ID            uint            `gorm:"primaryKey;autoIncrement" json:"id"`
	OutletID      int             `gorm:"column:outlet_id;not null;index" json:"outletId"`
	SupplierID    *int            `gorm:"column:supplier_id" json:"supplierId"`
	VendorName    string          `gorm:"column:vendor_name;size:255" json:"vendorName"`
	InvoiceNumber string          `gorm:"column:invoice_number;size:100" json:"invoiceNumber"`
	PurchaseDate  DateOnly        `gorm:"column:purchase_date;type:date;not null" json:"purchaseDate"`
	PipeConfigID  *int            `gorm:"column:pipe_config_id" json:"pipeConfigId"`
	PipeName      string          `gorm:"column:pipe_name;size:255;not null" json:"pipeName"`
	Quantity      int             `gorm:"column:quantity;not null" json:"quantity"`
	UnitRate      decimal.Decimal `gorm:"column:unit_rate;type:decimal(12,2);default:0" json:"unitRate"`
	TotalAmount   decimal.Decimal `gorm:"column:total_amount;type:decimal(14,2);default:0" json:"totalAmount"`
	GstPercent    float64         `gorm:"column:gst_percent;type:decimal(5,2);default:18" json:"gstPercent"`
	GstAmount     decimal.Decimal `gorm:"column:gst_amount;type:decimal(14,2);default:0" json:"gstAmount"`
	GrandTotal    decimal.Decimal `gorm:"column:grand_total;type:decimal(14,2);default:0" json:"grandTotal"`
	Notes         string          `gorm:"column:notes;type:text" json:"notes"`
	CreatedBy     string          `gorm:"column:created_by;size:255" json:"createdBy"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`

	Supplier   *Supplier   `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	PipeConfig *PipeConfig `gorm:"foreignKey:PipeConfigID" json:"pipeConfig,omitempty"`
}

func (ThirdPartyPipePurchase) TableName() string { return "biz_third_party_pipe_purchases" }

// ─── Extra Fabrication Charges ────────────────────────────────────────────────
type BizExtraFab struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date            DateOnly  `gorm:"column:date;type:date;not null" json:"date"`
	VendorName      string    `gorm:"column:vendor_name;size:255;not null" json:"vendorName"`
	Particular      string    `gorm:"column:particular;size:255;default:'Fabrication Charges'" json:"particular"`
	Rate            string    `gorm:"column:rate;type:decimal(12,2)" json:"rate"`
	Quantity        string    `gorm:"column:quantity" json:"quantity"`
	TaxPercent      string    `gorm:"column:tax_percent;type:decimal(5,2);default:0" json:"taxPercent"`
	LineTotal       string    `gorm:"column:line_total;type:decimal(14,2)" json:"lineTotal"`
	Notes           string    `gorm:"column:notes;type:text" json:"notes"`
	InvoiceNo       string    `gorm:"column:invoice_no;size:100" json:"invoiceNo"`
	VehicleNo       string    `gorm:"column:vehicle_no;size:100" json:"vehicleNo"`
	InvoiceData     string    `gorm:"column:invoice_data;type:text" json:"invoiceData"`
	SubTotal        string    `gorm:"column:sub_total;type:decimal(14,2)" json:"subTotal"`
	DiscountPercent string    `gorm:"column:discount_percent;type:decimal(5,2);default:0" json:"discountPercent"`
	BillPrice       string    `gorm:"column:bill_price;type:decimal(14,2)" json:"billPrice"`
	Taxable         string    `gorm:"column:taxable;type:decimal(14,2)" json:"taxable"`
	GstInclusive    bool      `gorm:"column:gst_inclusive;default:false" json:"gstInclusive"`
	RoundingOff     string    `gorm:"column:rounding_off;type:decimal(6,2);default:0" json:"roundingOff"`
	FinalBill       string    `gorm:"column:final_bill;type:decimal(14,2)" json:"finalBill"`
	CreatedAt       time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (BizExtraFab) TableName() string { return "biz_extra_fab" }
