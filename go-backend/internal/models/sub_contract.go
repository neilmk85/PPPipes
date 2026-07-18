package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type SubContract struct {
	ID                 int              `gorm:"primaryKey;autoIncrement" json:"id"`
	SiteProjectID      int              `gorm:"column:site_project_id;index;not null" json:"siteProjectId"`
	AgreementNumber    string           `gorm:"column:agreement_number" json:"agreementNumber"`
	AgreementDate      string           `gorm:"column:agreement_date;type:date" json:"agreementDate"`
	MainContractorName string           `gorm:"column:main_contractor_name" json:"mainContractorName"`
	ProjectName        string           `gorm:"column:project_name" json:"projectName"`
	Location           *string          `gorm:"column:location" json:"location"`
	ScopeDescription   *string          `gorm:"column:scope_description;type:text" json:"scopeDescription"`
	StartDate          *string          `gorm:"column:start_date;type:date" json:"startDate"`
	EndDate            *string          `gorm:"column:end_date;type:date" json:"endDate"`
	ContractValue      decimal.Decimal  `gorm:"column:contract_value;type:decimal(15,2);default:0" json:"contractValue"`
	Status             string           `gorm:"column:status;default:DRAFT" json:"status"` // DRAFT | ACTIVE | COMPLETED | TERMINATED
	Notes              *string          `gorm:"column:notes;type:text" json:"notes"`
	Items              []SubContractItem `gorm:"foreignKey:SubContractID;constraint:OnDelete:CASCADE" json:"items"`
	CreatedAt          time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy          *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy          *string          `gorm:"column:updated_by" json:"updatedBy"`
}

type SubContractItem struct {
	ID            int             `gorm:"primaryKey;autoIncrement" json:"id"`
	SubContractID int             `gorm:"column:sub_contract_id;index;not null" json:"subContractId"`
	Description   string          `gorm:"column:description" json:"description"`
	Unit          string          `gorm:"column:unit" json:"unit"`
	Qty           decimal.Decimal `gorm:"column:qty;type:decimal(15,3);default:0" json:"qty"`
	Rate          decimal.Decimal `gorm:"column:rate;type:decimal(15,2);default:0" json:"rate"`
	Amount        decimal.Decimal `gorm:"column:amount;type:decimal(15,2);default:0" json:"amount"`
	SortOrder     int             `gorm:"column:sort_order;default:0" json:"sortOrder"`
}

func (SubContract) TableName() string     { return "sub_contracts" }
func (SubContractItem) TableName() string { return "sub_contract_items" }
