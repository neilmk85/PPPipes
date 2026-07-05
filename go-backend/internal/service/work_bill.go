package service

import (
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type WorkBillService struct {
	db *gorm.DB
}

func NewWorkBillService(db *gorm.DB) *WorkBillService {
	return &WorkBillService{db: db}
}

func (s *WorkBillService) GetAll(search string, status string, projectID int) ([]models.WorkBill, error) {
	var bills []models.WorkBill
	q := s.db.Preload("Items").Preload("Payments").Order("contractor_name ASC, created_at DESC")
	if projectID != 0 {
		q = q.Joins("JOIN work_orders ON work_orders.id = work_bills.work_order_id").
			Where("work_orders.site_id = ?", projectID)
	}
	if search != "" {
		like := "%" + search + "%"
		q = q.Where("work_bills.bill_number LIKE ? OR work_bills.wo_number LIKE ? OR work_bills.contractor_name LIKE ?", like, like, like)
	}
	if status != "" && status != "ALL" {
		q = q.Where("work_bills.status = ?", status)
	}
	return bills, q.Find(&bills).Error
}

func (s *WorkBillService) GetByID(id int) (*models.WorkBill, error) {
	var b models.WorkBill
	err := s.db.Preload("Items").Preload("Payments").First(&b, id).Error
	return &b, err
}

func (s *WorkBillService) Create(b models.WorkBill, createdBy string) (*models.WorkBill, error) {
	num, err := util.GenerateWBNumber(s.db)
	if err != nil {
		return nil, err
	}
	b.BillNumber = num
	b.CreatedBy = &createdBy
	b.UpdatedBy = &createdBy
	if err := s.db.Create(&b).Error; err != nil {
		return nil, err
	}
	// Mark the linked work order as BILLED
	s.db.Model(&models.WorkOrder{}).Where("id = ?", b.WorkOrderID).
		Updates(map[string]interface{}{"status": models.WorkOrderStatusBilled})
	return s.GetByID(b.ID)
}

func (s *WorkBillService) Update(id int, patch models.WorkBill, updatedBy string) (*models.WorkBill, error) {
	var b models.WorkBill
	if err := s.db.First(&b, id).Error; err != nil {
		return nil, err
	}
	// Replace items
	if err := s.db.Where("work_bill_id = ?", id).Delete(&models.WorkBillItem{}).Error; err != nil {
		return nil, err
	}
	b.BillingPeriodFrom = patch.BillingPeriodFrom
	b.BillingPeriodTo = patch.BillingPeriodTo
	b.BillDate = patch.BillDate
	b.DueDate = patch.DueDate
	b.SupplyType = patch.SupplyType
	b.TDSRate = patch.TDSRate
	b.ContractorInvoiceNo = patch.ContractorInvoiceNo
	b.Notes = patch.Notes
	b.UpdatedBy = &updatedBy
	if err := s.db.Save(&b).Error; err != nil {
		return nil, err
	}
	for i := range patch.Items {
		patch.Items[i].WorkBillID = id
		patch.Items[i].ID = 0
	}
	if len(patch.Items) > 0 {
		if err := s.db.Create(&patch.Items).Error; err != nil {
			return nil, err
		}
	}
	return s.GetByID(id)
}

func (s *WorkBillService) UpdateStatus(id int, status models.WorkBillStatus, updatedBy string) (*models.WorkBill, error) {
	if err := s.db.Model(&models.WorkBill{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": status, "updated_by": updatedBy}).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *WorkBillService) AddPayment(billID int, p models.WorkBillPayment, createdBy string) (*models.WorkBill, error) {
	p.WorkBillID = billID
	p.CreatedBy = &createdBy
	if err := s.db.Create(&p).Error; err != nil {
		return nil, err
	}
	// Check if fully paid and auto-mark PAID
	bill, err := s.GetByID(billID)
	if err != nil {
		return nil, err
	}
	return bill, nil
}

func (s *WorkBillService) Delete(id int) error {
	return s.db.Delete(&models.WorkBill{}, id).Error
}
