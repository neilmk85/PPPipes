package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type VendorPaymentMethod string

const (
	VendorPaymentCash         VendorPaymentMethod = "CASH"
	VendorPaymentCheque       VendorPaymentMethod = "CHEQUE"
	VendorPaymentBankTransfer VendorPaymentMethod = "BANK_TRANSFER"
	VendorPaymentUPI          VendorPaymentMethod = "UPI"
	VendorPaymentOther        VendorPaymentMethod = "OTHER"
)

type VendorPayment struct {
	ID              int                 `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	BillID          *int                `gorm:"column:bill_id;index" json:"billId"`
	SupplierID      int                 `gorm:"column:supplier_id;index" json:"supplierId"`
	OutletID        int                 `gorm:"column:outlet_id;index" json:"outletId"`
	ReferenceNumber string              `gorm:"column:reference_number;size:100" json:"referenceNumber"`
	PaymentDate     time.Time           `gorm:"column:payment_date;type:date" json:"paymentDate"`
	Amount          decimal.Decimal     `gorm:"column:amount;type:decimal(10,2)" json:"amount"`
	PaymentMethod   VendorPaymentMethod `gorm:"column:payment_method;default:BANK_TRANSFER" json:"paymentMethod"`
	TDSAmount       decimal.Decimal     `gorm:"column:tds_amount;type:decimal(12,2);default:0" json:"tdsAmount"`
	TDSSectionID    *int                `gorm:"column:tds_section_id" json:"tdsSectionId"`
	Notes           *string             `gorm:"column:notes" json:"notes"`
	CreatedAt       time.Time           `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time           `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy       *string             `gorm:"column:created_by" json:"createdBy"`
	Bill            *PurchaseBill       `gorm:"foreignKey:BillID;references:ID" json:"bill,omitempty"`
	Supplier        *Supplier           `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	TDSSection      *TDSSection         `gorm:"foreignKey:TDSSectionID" json:"tdsSection,omitempty"`
}

func (VendorPayment) TableName() string { return "vendor_payments" }
