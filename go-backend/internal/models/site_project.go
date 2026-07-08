package models

import "time"

type SiteProject struct {
	ID            int       `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name          string    `gorm:"column:name;not null" json:"name"`
	ClientName    string    `gorm:"column:client_name" json:"clientName"`
	Location      string    `gorm:"column:location" json:"location"`
	ContractNo    *string   `gorm:"column:contract_no" json:"contractNo"`
	ContractValue *float64  `gorm:"column:contract_value" json:"contractValue"`
	StartDate     *string   `gorm:"column:start_date;type:date" json:"startDate"`
	EndDate       *string   `gorm:"column:end_date;type:date" json:"endDate"`
	// ACTIVE | COMPLETED | ON_HOLD
	Status        string    `gorm:"column:status;default:ACTIVE" json:"status"`
	Notes         *string   `gorm:"column:notes;type:text" json:"notes"`
	Active        bool      `gorm:"column:is_active;default:true" json:"active"`
	OutletID      *int      `gorm:"column:outlet_id" json:"outletId"`
	Outlet        *Outlet   `gorm:"foreignKey:OutletID" json:"outlet,omitempty"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string   `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string   `gorm:"column:updated_by" json:"updatedBy"`
}

func (SiteProject) TableName() string {
	return "site_projects"
}
