package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Product struct {
	ID                 int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name               string           `gorm:"column:name" json:"name"`
	Description        *string          `gorm:"column:description" json:"description"`
	SKU                *string          `gorm:"uniqueIndex;size:191;column:sku" json:"sku"`
	Barcode            *string          `gorm:"column:barcode" json:"barcode"`
	CategoryID         *int             `gorm:"column:category_id" json:"categoryId"`
	TaxGroupID         *int             `gorm:"column:tax_group_id" json:"taxGroupId"`
	CostPrice          *decimal.Decimal `gorm:"column:cost_price;type:decimal(10,2)" json:"costPrice"`
	SellingPrice       decimal.Decimal  `gorm:"column:selling_price;type:decimal(10,2)" json:"sellingPrice"`
	MRP                *decimal.Decimal `gorm:"column:mrp;type:decimal(10,2)" json:"mrp"`
	MinSellingPrice    *decimal.Decimal `gorm:"column:min_selling_price;type:decimal(10,2)" json:"minSellingPrice"`
	HSNCode            *string          `gorm:"column:hsn_code" json:"hsnCode"`
	UnitOfMeasure      string           `gorm:"column:unit_of_measure;default:pcs" json:"unitOfMeasure"`
	PurchaseUOM        *string          `gorm:"column:purchase_uom" json:"purchaseUom"`
	SaleUOM            *string          `gorm:"column:sale_uom" json:"saleUom"`
	PurchaseFactor     decimal.Decimal  `gorm:"column:purchase_factor;type:decimal(10,4);default:1" json:"purchaseFactor"`
	SaleFactor         decimal.Decimal  `gorm:"column:sale_factor;type:decimal(10,4);default:1" json:"saleFactor"`
	ProductType        ProductType      `gorm:"column:product_type;default:PHYSICAL" json:"productType"`
	ItemType           string           `gorm:"column:item_type;default:GENERAL" json:"itemType"`
	TrackInventory     bool             `gorm:"column:track_inventory;default:true" json:"trackInventory"`
	AllowNegativeStock bool             `gorm:"column:allow_negative_stock;default:false" json:"allowNegativeStock"`
	ReorderLevel       int              `gorm:"column:reorder_level;default:10" json:"reorderLevel"`
	ImageURL           *string          `gorm:"column:image_url" json:"imageUrl"`
	Active             bool             `gorm:"column:is_active;default:true" json:"active"`
	Purchasable        bool             `gorm:"column:is_purchasable;default:true" json:"purchasable"`
	Featured           bool             `gorm:"column:is_featured;default:false" json:"featured"`
	CreatedAt          time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy          *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy          *string          `gorm:"column:updated_by" json:"updatedBy"`

	Category              *Category              `gorm:"foreignKey:CategoryID" json:"category"`
	TaxGroup              *TaxGroup              `gorm:"foreignKey:TaxGroupID" json:"taxGroup"`
	Variants              []ProductVariant      `gorm:"foreignKey:ProductID" json:"variants,omitempty"`
	Images                []ProductImage        `gorm:"foreignKey:ProductID" json:"images,omitempty"`
	Inventories           []Inventory           `gorm:"foreignKey:ProductID" json:"inventories,omitempty"`
	OrderItems            []OrderItem           `gorm:"foreignKey:ProductID" json:"orderItems,omitempty"`
	InvoiceItems          []InvoiceItem         `gorm:"foreignKey:ProductID" json:"invoiceItems,omitempty"`
	QuotationItems        []QuotationItem       `gorm:"foreignKey:ProductID" json:"quotationItems,omitempty"`
	DiscountProducts      []DiscountProduct     `gorm:"foreignKey:ProductID" json:"discountProducts,omitempty"`
	BulkPurchases         []BulkPurchase        `gorm:"foreignKey:ProductID" json:"bulkPurchases,omitempty"`
	PurchaseOrderItems    []PurchaseOrderItem   `gorm:"foreignKey:ProductID" json:"purchaseOrderItems,omitempty"`
	PurchaseBillItems     []PurchaseBillItem    `gorm:"foreignKey:ProductID" json:"purchaseBillItems,omitempty"`
	PurchaseReturnItems   []PurchaseReturnItem  `gorm:"foreignKey:ProductID" json:"purchaseReturnItems,omitempty"`
	StockAdjustments      []StockAdjustment     `gorm:"foreignKey:ProductID" json:"stockAdjustments,omitempty"`
	StockTransferItems    []StockTransferItem   `gorm:"foreignKey:ProductID" json:"stockTransferItems,omitempty"`
	ConversionTargets     []BulkPurchaseConversion `gorm:"foreignKey:TargetProductID;references:ID" json:"conversionTargets,omitempty"`
	PriceListItems        []PriceListItem       `gorm:"foreignKey:ProductID" json:"priceListItems,omitempty"`
	SalesOrderItems       []SalesOrderItem      `gorm:"foreignKey:ProductID" json:"salesOrderItems,omitempty"`
}

func (Product) TableName() string {
	return "products"
}
