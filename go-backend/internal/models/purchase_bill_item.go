package models

import "github.com/shopspring/decimal"

type PurchaseBillItem struct {
	ID          int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	BillID      int             `gorm:"column:bill_id" json:"billId"`
	ProductID   *int            `gorm:"column:product_id" json:"productId"`
	Description string          `gorm:"column:description" json:"description"`
	Quantity    decimal.Decimal `gorm:"column:quantity;type:decimal(10,2)" json:"quantity"`
	UnitCost    decimal.Decimal `gorm:"column:unit_cost;type:decimal(10,2)" json:"unitCost"`
	TaxRate     decimal.Decimal `gorm:"column:tax_rate;type:decimal(5,2);default:0" json:"taxRate"`
	LineTotal   decimal.Decimal `gorm:"column:line_total;type:decimal(10,2)" json:"lineTotal"`

	Bill    *PurchaseBill `gorm:"foreignKey:BillID" json:"bill"`
	Product *Product      `gorm:"foreignKey:ProductID" json:"product"`
}

func (PurchaseBillItem) TableName() string {
	return "purchase_bill_items"
}
