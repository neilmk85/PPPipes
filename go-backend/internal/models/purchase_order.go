package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type PurchaseOrder struct {
	ID              int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	PONumber        string          `gorm:"uniqueIndex;size:191;column:po_number" json:"poNumber"`
	SupplierID      int             `gorm:"column:supplier_id" json:"supplierId"`
	OutletID        int             `gorm:"column:outlet_id" json:"outletId"`
	CreatedByUserID *int            `gorm:"column:created_by_id" json:"createdByUserId"`
	ExpectedDate    *time.Time      `gorm:"column:expected_date;type:date" json:"expectedDate"`
	ReceivedDate    *time.Time      `gorm:"column:received_date;type:date" json:"receivedDate"`
	Status          POStatus        `gorm:"column:status;default:DRAFT" json:"status"`
	Subtotal        decimal.Decimal `gorm:"column:subtotal;type:decimal(10,2);default:0" json:"subtotal"`
	TaxAmount       decimal.Decimal `gorm:"column:tax_amount;type:decimal(10,2);default:0" json:"taxAmount"`
	TotalAmount     decimal.Decimal `gorm:"column:total_amount;type:decimal(10,2);default:0" json:"totalAmount"`
	Notes           *string         `gorm:"column:notes" json:"notes"`
	IsDirect        bool            `gorm:"column:is_direct;default:false" json:"isDirect"`
	CreatedAt       time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy       *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy       *string         `gorm:"column:updated_by" json:"updatedBy"`

	Supplier        *Supplier            `gorm:"foreignKey:SupplierID" json:"supplier"`
	Outlet          *Outlet              `gorm:"foreignKey:OutletID" json:"outlet"`
	CreatedByUser   *User                `gorm:"foreignKey:CreatedByUserID;references:ID" json:"createdByUser"`
	Items           []PurchaseOrderItem  `gorm:"foreignKey:PurchaseOrderID" json:"items,omitempty"`
	PurchaseReturns []PurchaseReturn     `gorm:"foreignKey:PurchaseOrderID" json:"purchaseReturns,omitempty"`
	SourceBills     []PurchaseBill       `gorm:"foreignKey:SourcePoID;references:ID" json:"sourceBills,omitempty"`
}

func (PurchaseOrder) TableName() string {
	return "purchase_orders"
}
