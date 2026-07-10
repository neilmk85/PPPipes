package models

import "time"

type User struct {
	ID                 int        `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name               string     `gorm:"column:name" json:"name"`
	Email              string     `gorm:"uniqueIndex;size:191;column:email" json:"email"`
	Password           string     `gorm:"column:password" json:"password"`
	Phone              *string    `gorm:"column:phone" json:"phone"`
	EmployeeCode       *string    `gorm:"uniqueIndex;size:191;column:employee_code" json:"employeeCode"`
	PinCode            *string    `gorm:"column:pin_code" json:"pinCode"`
	OutletID           *int       `gorm:"column:outlet_id" json:"outletId"`
	Active             bool       `gorm:"column:is_active;default:true" json:"active"`
	OutOfOffice        bool       `gorm:"column:out_of_office;default:false" json:"outOfOffice"`
	LastLogin          *time.Time `gorm:"column:last_login" json:"lastLogin"`
	ProfileImage       *string    `gorm:"column:profile_image" json:"profileImage"`
	MaxDiscountPercent float64    `gorm:"column:max_discount_percent;default:10.0" json:"maxDiscountPercent"`
	CreatedAt          time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy          *string    `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy          *string    `gorm:"column:updated_by" json:"updatedBy"`

	Outlet              *Outlet            `gorm:"foreignKey:OutletID" json:"outlet"`
	UserRoles           []UserRole         `gorm:"foreignKey:UserID" json:"userRoles,omitempty"`
	CashierOrders       []Order            `gorm:"foreignKey:CashierID;references:ID" json:"cashierOrders,omitempty"`
	CashierShifts       []Shift            `gorm:"foreignKey:CashierID;references:ID" json:"cashierShifts,omitempty"`
	AdjustedBy          []StockAdjustment  `gorm:"foreignKey:AdjustedByID;references:ID" json:"adjustedBy,omitempty"`
	RequestedTransfers  []StockTransfer    `gorm:"foreignKey:RequestedByID;references:ID" json:"requestedTransfers,omitempty"`
	ApprovedTransfers   []StockTransfer    `gorm:"foreignKey:ApprovedByID;references:ID" json:"approvedTransfers,omitempty"`
	ReceivedTransfers   []StockTransfer    `gorm:"foreignKey:ReceivedByID;references:ID" json:"receivedTransfers,omitempty"`
	PurchaseOrders      []PurchaseOrder    `gorm:"foreignKey:CreatedByUserID;references:ID" json:"purchaseOrders,omitempty"`
	SalesOrders         []SalesOrder       `gorm:"foreignKey:CreatedByUserID;references:ID" json:"salesOrders,omitempty"`
}

func (User) TableName() string {
	return "users"
}
