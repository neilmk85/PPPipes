package models

import "github.com/shopspring/decimal"

type PurchaseOrderItem struct {
	ID               int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	PurchaseOrderID  int              `gorm:"column:purchase_order_id" json:"purchaseOrderId"`
	ProductID        *int             `gorm:"column:product_id" json:"productId"`
	Description      string           `gorm:"column:description" json:"description"`
	VariantID        *int             `gorm:"column:variant_id" json:"variantId"`
	OrderedQuantity  decimal.Decimal  `gorm:"column:ordered_quantity;type:decimal(10,2)" json:"orderedQuantity"`
	ReceivedQuantity decimal.Decimal  `gorm:"column:received_quantity;type:decimal(10,2);default:0" json:"receivedQuantity"`
	UnitCost         decimal.Decimal  `gorm:"column:unit_cost;type:decimal(10,2)" json:"unitCost"`
	TaxRate          decimal.Decimal  `gorm:"column:tax_rate;type:decimal(5,2);default:0" json:"taxRate"`
	LineTotal        decimal.Decimal  `gorm:"column:line_total;type:decimal(10,2)" json:"lineTotal"`

	PurchaseOrder *PurchaseOrder  `gorm:"foreignKey:PurchaseOrderID" json:"purchaseOrder"`
	Product       *Product        `gorm:"foreignKey:ProductID" json:"product"`
	Variant       *ProductVariant `gorm:"foreignKey:VariantID" json:"variant"`
}

func (PurchaseOrderItem) TableName() string {
	return "purchase_order_items"
}
