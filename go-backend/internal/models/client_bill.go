package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type ClientBillStatus string

const (
	ClientBillStatusDraft     ClientBillStatus = "DRAFT"
	ClientBillStatusSubmitted ClientBillStatus = "SUBMITTED"
	ClientBillStatusCertified ClientBillStatus = "CERTIFIED"
	ClientBillStatusPaid      ClientBillStatus = "PAID"
)

type ClientBill struct {
	ID               int              `gorm:"primaryKey;autoIncrement" json:"id"`
	SiteProjectID    int              `gorm:"column:site_project_id;index;not null" json:"siteProjectId"`
	BillNumber       string           `gorm:"column:bill_number;size:191;uniqueIndex" json:"billNumber"`
	BillDate         string           `gorm:"column:bill_date;type:date;not null" json:"billDate"`
	PeriodFrom       *string          `gorm:"column:period_from;type:date" json:"periodFrom"`
	PeriodTo         *string          `gorm:"column:period_to;type:date" json:"periodTo"`
	ClientName       string           `gorm:"column:client_name" json:"clientName"`
	SupplyType       SupplyType       `gorm:"column:supply_type;default:INTRA_STATE" json:"supplyType"`
	TDSRate          decimal.Decimal  `gorm:"column:tds_rate;type:decimal(5,2);default:0" json:"tdsRate"`
	RetentionRate    decimal.Decimal  `gorm:"column:retention_rate;type:decimal(5,2);default:0" json:"retentionRate"`
	OtherDeductions  decimal.Decimal  `gorm:"column:other_deductions;type:decimal(12,2);default:0" json:"otherDeductions"`
	Status           ClientBillStatus `gorm:"column:status;default:DRAFT" json:"status"`
	Notes            *string          `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt        time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy        *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy        *string          `gorm:"column:updated_by" json:"updatedBy"`

	Items    []ClientBillItem    `gorm:"foreignKey:ClientBillID;constraint:OnDelete:CASCADE" json:"items"`
	Payments []ClientBillPayment `gorm:"foreignKey:ClientBillID;constraint:OnDelete:CASCADE" json:"payments"`
}

func (ClientBill) TableName() string { return "client_bills" }

type ClientBillItem struct {
	ID            int             `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientBillID  int             `gorm:"column:client_bill_id;index" json:"clientBillId"`
	Description   string          `gorm:"column:description" json:"description"`
	Unit          string          `gorm:"column:unit;default:RMT" json:"unit"`
	ContractedQty decimal.Decimal `gorm:"column:contracted_qty;type:decimal(12,3);default:0" json:"contractedQty"`
	PreviousQty   decimal.Decimal `gorm:"column:previous_qty;type:decimal(12,3);default:0" json:"previousQty"`
	CurrentQty    decimal.Decimal `gorm:"column:current_qty;type:decimal(12,3);default:0" json:"currentQty"`
	Rate          decimal.Decimal `gorm:"column:rate;type:decimal(12,2);default:0" json:"rate"`
	GSTRate       decimal.Decimal `gorm:"column:gst_rate;type:decimal(5,2);default:18" json:"gstRate"`
	Amount        decimal.Decimal `gorm:"column:amount;type:decimal(12,2);default:0" json:"amount"`
	SortOrder     int             `gorm:"column:sort_order;default:0" json:"sortOrder"`
}

func (ClientBillItem) TableName() string { return "client_bill_items" }

type ClientBillPayment struct {
	ID           int             `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientBillID int             `gorm:"column:client_bill_id;index" json:"clientBillId"`
	Date         string          `gorm:"column:date;type:date;not null" json:"date"`
	Amount       decimal.Decimal `gorm:"column:amount;type:decimal(12,2);default:0" json:"amount"`
	Mode         string          `gorm:"column:mode;default:BANK_TRANSFER" json:"mode"`
	Reference    *string         `gorm:"column:reference" json:"reference"`
	Notes        *string         `gorm:"column:notes" json:"notes"`
	CreatedAt    time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	CreatedBy    *string         `gorm:"column:created_by" json:"createdBy"`
}

func (ClientBillPayment) TableName() string { return "client_bill_payments" }
