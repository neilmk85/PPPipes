package service

import (
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type VendorPaymentService struct{ db *gorm.DB }

func NewVendorPaymentService(db *gorm.DB) *VendorPaymentService {
	return &VendorPaymentService{db: db}
}

func (s *VendorPaymentService) GetAll(outletID, supplierID *int, page, size int) ([]models.VendorPayment, int64, error) {
	q := s.db.Model(&models.VendorPayment{}).Preload("Supplier")
	if outletID != nil {
		q = q.Where("outlet_id = ?", *outletID)
	}
	if supplierID != nil {
		q = q.Where("supplier_id = ?", *supplierID)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []models.VendorPayment
	err := q.Order("payment_date DESC, id DESC").Offset(page * size).Limit(size).Find(&rows).Error
	return rows, total, err
}

func (s *VendorPaymentService) CreateWithTDS(billID *int, supplierID, outletID int, amount decimal.Decimal,
	method models.VendorPaymentMethod, ref string, date time.Time, notes *string, createdBy string,
	tdsSectionID *int, tdsAmount decimal.Decimal) (*models.VendorPayment, error) {
	p := &models.VendorPayment{
		BillID: billID, SupplierID: supplierID, OutletID: outletID,
		Amount: amount, PaymentMethod: method, ReferenceNumber: ref,
		PaymentDate: date, Notes: notes, CreatedBy: &createdBy,
		TDSSectionID: tdsSectionID, TDSAmount: tdsAmount,
	}
	return p, s.db.Create(p).Error
}
