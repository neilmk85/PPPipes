package models

// RoleName enum
type RoleName string

const (
	RoleSuperAdmin       RoleName = "SUPER_ADMIN"
	RoleAdmin            RoleName = "ADMIN"
	RoleManager          RoleName = "MANAGER"
	RoleCashier          RoleName = "CASHIER"
	RoleInventoryManager RoleName = "INVENTORY_MANAGER"
	RoleAccountant       RoleName = "ACCOUNTANT"
)

// ProductType enum
type ProductType string

const (
	ProductTypePhysical ProductType = "PHYSICAL"
	ProductTypeService  ProductType = "SERVICE"
	ProductTypeDigital  ProductType = "DIGITAL"
	ProductTypeCombo    ProductType = "COMBO"
)

// OrderStatus enum
type OrderStatus string

const (
	OrderStatusPending           OrderStatus = "PENDING"
	OrderStatusConfirmed         OrderStatus = "CONFIRMED"
	OrderStatusCompleted         OrderStatus = "COMPLETED"
	OrderStatusCancelled         OrderStatus = "CANCELLED"
	OrderStatusRefunded          OrderStatus = "REFUNDED"
	OrderStatusPartiallyRefunded OrderStatus = "PARTIALLY_REFUNDED"
	OrderStatusHeld              OrderStatus = "HELD"
)

// OrderType enum
type OrderType string

const (
	OrderTypeSale       OrderType = "SALE"
	OrderTypeReturn     OrderType = "RETURN"
	OrderTypeExchange   OrderType = "EXCHANGE"
	OrderTypeCreditSale OrderType = "CREDIT_SALE"
)

// PaymentMethod enum
type PaymentMethod string

const (
	PaymentMethodCash         PaymentMethod = "CASH"
	PaymentMethodCard         PaymentMethod = "CARD"
	PaymentMethodUPI          PaymentMethod = "UPI"
	PaymentMethodNetBanking   PaymentMethod = "NET_BANKING"
	PaymentMethodCreditNote   PaymentMethod = "CREDIT_NOTE"
	PaymentMethodLoyaltyPoints PaymentMethod = "LOYALTY_POINTS"
	PaymentMethodCreditSale   PaymentMethod = "CREDIT_SALE"
	PaymentMethodAdvance      PaymentMethod = "ADVANCE"
)

// PaymentStatus enum
type PaymentStatus string

const (
	PaymentStatusPending           PaymentStatus = "PENDING"
	PaymentStatusCompleted         PaymentStatus = "COMPLETED"
	PaymentStatusFailed            PaymentStatus = "FAILED"
	PaymentStatusRefunded          PaymentStatus = "REFUNDED"
	PaymentStatusPartiallyRefunded PaymentStatus = "PARTIALLY_REFUNDED"
)

// InvoiceStatus enum
type InvoiceStatus string

const (
	InvoiceStatusDraft    InvoiceStatus = "DRAFT"
	InvoiceStatusSent     InvoiceStatus = "SENT"
	InvoiceStatusPaid     InvoiceStatus = "PAID"
	InvoiceStatusPartial  InvoiceStatus = "PARTIAL"
	InvoiceStatusOverdue  InvoiceStatus = "OVERDUE"
	InvoiceStatusCancelled InvoiceStatus = "CANCELLED"
)

// QuotationStatus enum
type QuotationStatus string

const (
	QuotationStatusDraft    QuotationStatus = "DRAFT"
	QuotationStatusSent     QuotationStatus = "SENT"
	QuotationStatusAccepted QuotationStatus = "ACCEPTED"
	QuotationStatusRejected QuotationStatus = "REJECTED"
	QuotationStatusExpired  QuotationStatus = "EXPIRED"
	QuotationStatusConverted QuotationStatus = "CONVERTED"
)

// CustomerSegment enum
type CustomerSegment string

const (
	CustomerSegmentRegular   CustomerSegment = "REGULAR"
	CustomerSegmentSilver    CustomerSegment = "SILVER"
	CustomerSegmentGold      CustomerSegment = "GOLD"
	CustomerSegmentVIP       CustomerSegment = "VIP"
	CustomerSegmentWholesale CustomerSegment = "WHOLESALE"
)

// CreditNoteStatus enum
type CreditNoteStatus string

const (
	CreditNoteStatusActive    CreditNoteStatus = "ACTIVE"
	CreditNoteStatusFullyUsed CreditNoteStatus = "FULLY_USED"
	CreditNoteStatusExpired   CreditNoteStatus = "EXPIRED"
	CreditNoteStatusCancelled CreditNoteStatus = "CANCELLED"
)

// ShiftStatus enum
type ShiftStatus string

const (
	ShiftStatusOpen   ShiftStatus = "OPEN"
	ShiftStatusClosed ShiftStatus = "CLOSED"
)

// AdjustmentReason enum
type AdjustmentReason string

const (
	AdjustmentReasonDamage       AdjustmentReason = "DAMAGE"
	AdjustmentReasonTheft        AdjustmentReason = "THEFT"
	AdjustmentReasonExpiry       AdjustmentReason = "EXPIRY"
	AdjustmentReasonCorrection   AdjustmentReason = "CORRECTION"
	AdjustmentReasonOpeningStock AdjustmentReason = "OPENING_STOCK"
	AdjustmentReasonAudit        AdjustmentReason = "AUDIT"
	AdjustmentReasonOther        AdjustmentReason = "OTHER"
)

// TransferStatus enum
type TransferStatus string

const (
	TransferStatusRequested          TransferStatus = "REQUESTED"
	TransferStatusApproved           TransferStatus = "APPROVED"
	TransferStatusInTransit          TransferStatus = "IN_TRANSIT"
	TransferStatusReceived           TransferStatus = "RECEIVED"
	TransferStatusCancelled          TransferStatus = "CANCELLED"
	TransferStatusPartiallyReceived  TransferStatus = "PARTIALLY_RECEIVED"
)

// POStatus enum
type POStatus string

const (
	POStatusDraft    POStatus = "DRAFT"
	POStatusSent     POStatus = "SENT"
	POStatusPartial  POStatus = "PARTIAL"
	POStatusReceived POStatus = "RECEIVED"
	POStatusCancelled POStatus = "CANCELLED"
)

// BillStatus enum
type BillStatus string

const (
	BillStatusDraft   BillStatus = "DRAFT"
	BillStatusUnpaid  BillStatus = "UNPAID"
	BillStatusPartial BillStatus = "PARTIAL"
	BillStatusPaid    BillStatus = "PAID"
)

// PurchaseReturnStatus enum
type PurchaseReturnStatus string

const (
	PurchaseReturnStatusCompleted PurchaseReturnStatus = "COMPLETED"
	PurchaseReturnStatusCancelled PurchaseReturnStatus = "CANCELLED"
)

// CreditMethod enum
type CreditMethod string

const (
	CreditMethodCash         CreditMethod = "CASH"
	CreditMethodBankTransfer CreditMethod = "BANK_TRANSFER"
	CreditMethodVendorCredit CreditMethod = "VENDOR_CREDIT"
)

// DiscountType enum
type DiscountType string

const (
	DiscountTypeManual      DiscountType = "MANUAL"
	DiscountTypeAutomatic   DiscountType = "AUTOMATIC"
	DiscountTypePromotional DiscountType = "PROMOTIONAL"
	DiscountTypeFestival    DiscountType = "FESTIVAL"
	DiscountTypeLoyalty     DiscountType = "LOYALTY"
)

// ApplyOn enum
type ApplyOn string

const (
	ApplyOnProduct  ApplyOn = "PRODUCT"
	ApplyOnCategory ApplyOn = "CATEGORY"
	ApplyOnCart     ApplyOn = "CART"
	ApplyOnCustomer ApplyOn = "CUSTOMER"
)

// ValueType enum
type ValueType string

const (
	ValueTypePercentage ValueType = "PERCENTAGE"
	ValueTypeFlat       ValueType = "FLAT"
	ValueTypeBuyXGetY   ValueType = "BUY_X_GET_Y"
	ValueTypeFreeItem   ValueType = "FREE_ITEM"
)

// ExpenseStatus enum
type ExpenseStatus string

const (
	ExpenseStatusPending  ExpenseStatus = "PENDING"
	ExpenseStatusApproved ExpenseStatus = "APPROVED"
	ExpenseStatusRejected ExpenseStatus = "REJECTED"
)

// ExpensePaymentMode enum
type ExpensePaymentMode string

const (
	ExpensePaymentModeCash        ExpensePaymentMode = "CASH"
	ExpensePaymentModeUPI         ExpensePaymentMode = "UPI"
	ExpensePaymentModeBankTransfer ExpensePaymentMode = "BANK_TRANSFER"
	ExpensePaymentModeCard        ExpensePaymentMode = "CARD"
	ExpensePaymentModeCheque      ExpensePaymentMode = "CHEQUE"
	ExpensePaymentModeOther       ExpensePaymentMode = "OTHER"
)

// SupplyType enum
type SupplyType string

const (
	SupplyTypeIntraState SupplyType = "INTRA_STATE"
	SupplyTypeInterState SupplyType = "INTER_STATE"
)

// RecurrenceInterval enum
type RecurrenceInterval string

const (
	RecurrenceIntervalWeekly  RecurrenceInterval = "WEEKLY"
	RecurrenceIntervalMonthly RecurrenceInterval = "MONTHLY"
)

// SalesOrderStatus enum
type SalesOrderStatus string

const (
	SalesOrderStatusDraft              SalesOrderStatus = "DRAFT"
	SalesOrderStatusInProduction       SalesOrderStatus = "IN_PRODUCTION"
	SalesOrderStatusProcessing         SalesOrderStatus = "PROCESSING"
	SalesOrderStatusPartiallyDelivered SalesOrderStatus = "PARTIALLY_DELIVERED"
	SalesOrderStatusDelivered          SalesOrderStatus = "DELIVERED"
	SalesOrderStatusInvoiced           SalesOrderStatus = "INVOICED"
	SalesOrderStatusCancelled          SalesOrderStatus = "CANCELLED"
	SalesOrderStatusOnHold             SalesOrderStatus = "ON_HOLD"
)

// ConversionStatus enum
type ConversionStatus string

const (
	ConversionStatusNotConverted      ConversionStatus = "NOT_CONVERTED"
	ConversionStatusPartiallyConverted ConversionStatus = "PARTIALLY_CONVERTED"
	ConversionStatusConverted         ConversionStatus = "CONVERTED"
)

// IncentiveRuleType enum
type IncentiveRuleType string

const (
	IncentiveRuleTypeCommission       IncentiveRuleType = "COMMISSION"
	IncentiveRuleTypeTargetBonus      IncentiveRuleType = "TARGET_BONUS"
	IncentiveRuleTypePerTransaction   IncentiveRuleType = "PER_TRANSACTION"
	IncentiveRuleTypeTieredCommission IncentiveRuleType = "TIERED_COMMISSION"
)

// LoyaltyTransactionType enum
type LoyaltyTransactionType string

const (
	LoyaltyTransactionTypeEarned   LoyaltyTransactionType = "EARNED"
	LoyaltyTransactionTypeRedeemed LoyaltyTransactionType = "REDEEMED"
	LoyaltyTransactionTypeExpired  LoyaltyTransactionType = "EXPIRED"
	LoyaltyTransactionTypeAdjusted LoyaltyTransactionType = "ADJUSTED"
	LoyaltyTransactionTypeBonus    LoyaltyTransactionType = "BONUS"
)
