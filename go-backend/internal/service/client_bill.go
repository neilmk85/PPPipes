package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
)

type ClientBillService struct {
	db *gorm.DB
}

func NewClientBillService(db *gorm.DB) *ClientBillService {
	return &ClientBillService{db: db}
}

func (s *ClientBillService) generateBillNumber(projectID int) (string, error) {
	var count int64
	s.db.Model(&models.ClientBill{}).Where("site_project_id = ?", projectID).Count(&count)
	year := time.Now().Year()
	return fmt.Sprintf("RA/%d/%04d/%d", projectID, count+1, year), nil
}

func (s *ClientBillService) GetAll(projectID int, status string) ([]models.ClientBill, error) {
	var bills []models.ClientBill
	q := s.db.Preload("Items").Preload("Payments").Order("created_at DESC")
	if projectID != 0 {
		q = q.Where("site_project_id = ?", projectID)
	}
	if status != "" && status != "ALL" {
		q = q.Where("status = ?", status)
	}
	return bills, q.Find(&bills).Error
}

func (s *ClientBillService) GetByID(id int) (*models.ClientBill, error) {
	var b models.ClientBill
	err := s.db.Preload("Items").Preload("Payments").First(&b, id).Error
	return &b, err
}

func (s *ClientBillService) Create(b models.ClientBill, createdBy string) (*models.ClientBill, error) {
	num, err := s.generateBillNumber(b.SiteProjectID)
	if err != nil {
		return nil, err
	}
	b.BillNumber = num
	b.CreatedBy = &createdBy
	b.UpdatedBy = &createdBy
	if err := s.db.Create(&b).Error; err != nil {
		return nil, err
	}
	return s.GetByID(b.ID)
}

func (s *ClientBillService) Update(id int, patch models.ClientBill, updatedBy string) (*models.ClientBill, error) {
	var b models.ClientBill
	if err := s.db.First(&b, id).Error; err != nil {
		return nil, err
	}
	patch.ID = id
	patch.BillNumber = b.BillNumber
	patch.SiteProjectID = b.SiteProjectID
	patch.Status = b.Status
	patch.UpdatedBy = &updatedBy

	if err := s.db.Model(&b).Updates(&patch).Error; err != nil {
		return nil, err
	}
	// replace items
	s.db.Where("client_bill_id = ?", id).Delete(&models.ClientBillItem{})
	for i := range patch.Items {
		patch.Items[i].ClientBillID = id
		patch.Items[i].SortOrder = i
	}
	if len(patch.Items) > 0 {
		s.db.Create(&patch.Items)
	}
	return s.GetByID(id)
}

func (s *ClientBillService) UpdateStatus(id int, status models.ClientBillStatus, updatedBy string) (*models.ClientBill, error) {
	if err := s.db.Model(&models.ClientBill{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": status, "updated_by": updatedBy}).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *ClientBillService) AddPayment(billID int, p models.ClientBillPayment, createdBy string) (*models.ClientBill, error) {
	p.ClientBillID = billID
	p.CreatedBy = &createdBy
	if err := s.db.Create(&p).Error; err != nil {
		return nil, err
	}
	return s.GetByID(billID)
}

func (s *ClientBillService) DeletePayment(billID, paymentID int) (*models.ClientBill, error) {
	if err := s.db.Where("id = ? AND client_bill_id = ?", paymentID, billID).
		Delete(&models.ClientBillPayment{}).Error; err != nil {
		return nil, err
	}
	return s.GetByID(billID)
}

func (s *ClientBillService) Delete(id int) error {
	return s.db.Delete(&models.ClientBill{}, id).Error
}
