package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
)

type SubContractService struct {
	db *gorm.DB
}

func NewSubContractService(db *gorm.DB) *SubContractService {
	return &SubContractService{db: db}
}

func (s *SubContractService) generateNumber(projectID int) string {
	var count int64
	s.db.Model(&models.SubContract{}).Where("site_project_id = ?", projectID).Count(&count)
	return fmt.Sprintf("SC/%d/%04d/%d", projectID, count+1, time.Now().Year())
}

func (s *SubContractService) GetAll(projectID int, status string) ([]models.SubContract, error) {
	var list []models.SubContract
	q := s.db.Preload("Items").Order("created_at DESC")
	if projectID != 0 {
		q = q.Where("site_project_id = ?", projectID)
	}
	if status != "" && status != "ALL" {
		q = q.Where("status = ?", status)
	}
	return list, q.Find(&list).Error
}

func (s *SubContractService) GetByID(id int) (*models.SubContract, error) {
	var sc models.SubContract
	err := s.db.Preload("Items").First(&sc, id).Error
	return &sc, err
}

func (s *SubContractService) Create(sc *models.SubContract) error {
	if sc.AgreementNumber == "" {
		sc.AgreementNumber = s.generateNumber(sc.SiteProjectID)
	}
	return s.db.Create(sc).Error
}

func (s *SubContractService) Update(id int, sc *models.SubContract) error {
	if err := s.db.Where("sub_contract_id = ?", id).Delete(&models.SubContractItem{}).Error; err != nil {
		return err
	}
	sc.ID = id
	return s.db.Session(&gorm.Session{FullSaveAssociations: true}).Save(sc).Error
}

func (s *SubContractService) UpdateStatus(id int, status string) error {
	return s.db.Model(&models.SubContract{}).Where("id = ?", id).Update("status", status).Error
}

func (s *SubContractService) Delete(id int) error {
	return s.db.Select("Items").Delete(&models.SubContract{}, id).Error
}
