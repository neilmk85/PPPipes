package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Invoice struct {
	ID               int            `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	InvoiceNumber    string         `gorm:"uniqueIndex;size:191;column:invoice_number" json:"invoiceNumber"`
	OrderID          *int           `gorm:"column:order_id" json:"orderId"`
	CustomerID       *int           `gorm:"column:customer_id" json:"customerId"`
	OutletID         int            `gorm:"column:outlet_id" json:"outletId"`
	IssueDate        time.Time      `gorm:"column:issue_date;type:date" json:"issueDate"`
	DueDate          *time.Time     `gorm:"column:due_date;type:date" json:"dueDate"`
	Status           InvoiceStatus  `gorm:"column:status;default:DRAFT" json:"status"`
	Subtotal         decimal.Decimal `gorm:"column:subtotal;type:decimal(10,2);default:0" json:"subtotal"`
	DiscountAmount   decimal.Decimal `gorm:"column:discount_amount;type:decimal(10,2);default:0" json:"discountAmount"`
	TaxAmount        decimal.Decimal `gorm:"column:tax_amount;type:decimal(10,2);default:0" json:"taxAmount"`
	TotalAmount      decimal.Decimal `gorm:"column:total_amount;type:decimal(10,2);default:0" json:"totalAmount"`
	PaidAmount       decimal.Decimal `gorm:"column:paid_amount;type:decimal(10,2);default:0" json:"paidAmount"`
	Notes            *string        `gorm:"column:notes" json:"notes"`
	TermsConditions  *string        `gorm:"column:terms_conditions;type:text" json:"termsConditions"`
	PaymentTerms     *string        `gorm:"column:payment_terms" json:"paymentTerms"`
	BillDiscountPct  decimal.Decimal `gorm:"column:bill_discount_pct;type:decimal(5,2);default:0" json:"billDiscountPct"`
	BillDiscountAmt  decimal.Decimal `gorm:"column:bill_discount_amt;type:decimal(10,2);default:0" json:"billDiscountAmt"`
	PONumber         *string        `gorm:"column:po_number" json:"poNumber"`
	DeliveryChallanNo *string       `gorm:"column:delivery_challan_no" json:"deliveryChallanNo"`
	EWayBillNo       *string        `gorm:"column:e_way_bill_no" json:"eWayBillNo"`
	EInvoiceNo       *string        `gorm:"column:e_invoice_no" json:"eInvoiceNo"`
	ShippingAmount   decimal.Decimal `gorm:"column:shipping_amount;type:decimal(10,2);default:0" json:"shippingAmount"`
	PrintNeeded      bool           `gorm:"column:print_needed;default:false" json:"printNeeded"`
	PrintedAt        *time.Time     `gorm:"column:printed_at" json:"printedAt"`
	CreatedAt        time.Time      `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time      `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy        *string        `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy        *string        `gorm:"column:updated_by" json:"updatedBy"`

	Order    *Order         `gorm:"foreignKey:OrderID" json:"order"`
	Customer *Customer      `gorm:"foreignKey:CustomerID" json:"customer"`
	Outlet   *Outlet        `gorm:"foreignKey:OutletID" json:"outlet"`
	Items    []InvoiceItem  `gorm:"foreignKey:InvoiceID" json:"items,omitempty"`
}

func (Invoice) TableName() string {
	return "invoices"
}
