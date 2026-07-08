package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type MaterialReceipt struct {
	ID            int             `gorm:"primaryKey;autoIncrement" json:"id"`
	SiteProjectID int             `gorm:"column:site_project_id;index;not null" json:"siteProjectId"`
	MaterialName  string          `gorm:"column:material_name;not null" json:"materialName"`
	Specification *string         `gorm:"column:specification" json:"specification"`
	Unit          string          `gorm:"column:unit;default:Nos" json:"unit"`
	Qty           decimal.Decimal `gorm:"column:qty;type:decimal(12,3);default:0" json:"qty"`
	SupplierName  *string         `gorm:"column:supplier_name" json:"supplierName"`
	InvoiceNo     *string         `gorm:"column:invoice_no" json:"invoiceNo"`
	ReceivedDate  string          `gorm:"column:received_date;type:date;not null" json:"receivedDate"`
	ReceivedBy    *string         `gorm:"column:received_by" json:"receivedBy"`
	VehicleNo     *string         `gorm:"column:vehicle_no" json:"vehicleNo"`
	SourceType    *string         `gorm:"column:source_type" json:"sourceType"` // PURCHASE | TRANSFER
	SourceRef     *string         `gorm:"column:source_ref" json:"sourceRef"`   // transfer number
	Notes         *string         `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string         `gorm:"column:updated_by" json:"updatedBy"`
}

func (MaterialReceipt) TableName() string { return "material_receipts" }

// MaterialStockEntry is a derived view — not a DB table
type MaterialStockEntry struct {
	MaterialName       string          `json:"materialName"`
	Specification      string          `json:"specification"`
	Unit               string          `json:"unit"`
	TotalReceived      decimal.Decimal `json:"totalReceived"`
	IssuedContractor   decimal.Decimal `json:"issuedContractor"`
	IssuedInhouse      decimal.Decimal `json:"issuedInhouse"`
	Balance            decimal.Decimal `json:"balance"`
}
