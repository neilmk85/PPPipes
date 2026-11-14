package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type SalesOrder struct {
	ID               int               `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	SONumber         string            `gorm:"uniqueIndex;size:191;column:so_number" json:"soNumber"`
	CustomerID       int               `gorm:"column:customer_id" json:"customerId"`
	OutletID         int               `gorm:"column:outlet_id" json:"outletId"`
	CreatedByUserID  *int              `gorm:"column:created_by_user_id" json:"createdByUserId"`
	CustomerPONumber *string           `gorm:"column:customer_po_number" json:"customerPoNumber"`
	OrderDate        time.Time         `gorm:"column:order_date;type:date" json:"orderDate"`
	RequiredDate     *time.Time        `gorm:"column:required_date;type:date" json:"requiredDate"`
	DeliveryDate     *time.Time        `gorm:"column:delivery_date;type:date" json:"deliveryDate"`
	Status           SalesOrderStatus  `gorm:"column:status;default:DRAFT" json:"status"`
	Subtotal         decimal.Decimal   `gorm:"column:subtotal;type:decimal(10,2);default:0" json:"subtotal"`
	DiscountAmount   decimal.Decimal   `gorm:"column:discount_amount;type:decimal(10,2);default:0" json:"discountAmount"`
	TaxAmount        decimal.Decimal   `gorm:"column:tax_amount;type:decimal(10,2);default:0" json:"taxAmount"`
	ShippingAmount   decimal.Decimal   `gorm:"column:shipping_amount;type:decimal(10,2);default:0" json:"shippingAmount"`
	TotalAmount      decimal.Decimal   `gorm:"column:total_amount;type:decimal(10,2);default:0" json:"totalAmount"`
	AdvanceAmount    decimal.Decimal   `gorm:"column:advance_amount;type:decimal(10,2);default:0" json:"advanceAmount"`
	PaymentTerms     *string           `gorm:"column:payment_terms" json:"paymentTerms"`
	ShippingAddress  *string           `gorm:"column:shipping_address" json:"shippingAddress"`
	ShippingCity     *string           `gorm:"column:shipping_city" json:"shippingCity"`
	ShippingState    *string           `gorm:"column:shipping_state" json:"shippingState"`
	Notes            *string           `gorm:"column:notes" json:"notes"`
	TermsConditions  *string           `gorm:"column:terms_conditions;type:text" json:"termsConditions"`
	EarlyCloseNote   *string           `gorm:"column:early_close_note;type:text" json:"earlyCloseNote"`
	EarlyClosedAt    *time.Time        `gorm:"column:early_closed_at" json:"earlyClosedAt"`
	CreatedAt        time.Time         `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time         `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy        *string           `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy        *string           `gorm:"column:updated_by" json:"updatedBy"`

	Customer      *Customer        `gorm:"foreignKey:CustomerID" json:"customer"`
	Outlet        *Outlet          `gorm:"foreignKey:OutletID" json:"outlet"`
	CreatedByUser *User            `gorm:"foreignKey:CreatedByUserID;references:ID" json:"createdByUser"`
	Items         []SalesOrderItem `gorm:"foreignKey:SalesOrderID" json:"items,omitempty"`
}

func (SalesOrder) TableName() string {
	return "sales_orders"
}
