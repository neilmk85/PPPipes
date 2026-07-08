package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type SalesOrderPayment struct {
	ID              int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	SalesOrderID    int             `gorm:"column:sales_order_id;index" json:"salesOrderId"`
	OutletID        int             `gorm:"column:outlet_id;index" json:"outletId"`
	Amount          decimal.Decimal `gorm:"column:amount;type:decimal(15,2)" json:"amount"`
	PaymentMethod   string          `gorm:"column:payment_method;size:50" json:"paymentMethod"`
	ReferenceNumber *string         `gorm:"column:reference_number;size:191" json:"referenceNumber"`
	PaymentDate     time.Time       `gorm:"column:payment_date;type:date" json:"paymentDate"`
	Notes           *string         `gorm:"column:notes;type:text" json:"notes"`
	CreatedBy       *string         `gorm:"column:created_by;size:191" json:"createdBy"`
	CreatedAt       time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`

	SalesOrder *SalesOrder `gorm:"foreignKey:SalesOrderID" json:"salesOrder,omitempty"`
}

func (SalesOrderPayment) TableName() string {
	return "sales_order_payments"
}
