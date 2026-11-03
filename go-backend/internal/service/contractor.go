package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type ContractorService struct {
	db *gorm.DB
}

func NewContractorService(db *gorm.DB) *ContractorService {
	return &ContractorService{db: db}
}

func (s *ContractorService) GetAll(search *string, active *bool) ([]models.Contractor, error) {
	query := s.db.Model(&models.Contractor{})

	if search != nil && *search != "" {
		p := "%" + *search + "%"
		query = query.Where("name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR gstin LIKE ?", p, p, p, p)
	}
	if active != nil {
		query = query.Where("is_active = ?", *active)
	}

	var contractors []models.Contractor
	err := query.Order("name ASC").Find(&contractors).Error
	return contractors, err
}

func (s *ContractorService) GetByID(id int) (*models.Contractor, error) {
	var c models.Contractor
	err := s.db.First(&c, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Contractor with ID %d not found", id)}
	}
	return &c, err
}

func (s *ContractorService) Create(data models.Contractor) (*models.Contractor, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

func (s *ContractorService) Update(id int, data models.Contractor) (*models.Contractor, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.Contractor{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *ContractorService) Delete(id int) error {
	c, err := s.GetByID(id)
	if err != nil {
		return err
	}
	return s.db.Model(c).Update("is_active", false).Error
}

// ── Process Assignments ───────────────────────────────────────────────────────

func (s *ContractorService) GetProcessAssignments(processType string) ([]models.ContractorProcessAssignment, error) {
	q := s.db.Preload("Contractor").Order("process_type ASC, commenced_at DESC")
	if processType != "" {
		q = q.Where("process_type = ?", processType)
	}
	var out []models.ContractorProcessAssignment
	return out, q.Find(&out).Error
}

func (s *ContractorService) CreateProcessAssignment(contractorID int, processType, commencedAt string) (*models.ContractorProcessAssignment, error) {
	t, err := time.Parse("2006-01-02", commencedAt)
	if err != nil {
		return nil, fmt.Errorf("invalid commencedAt date: %w", err)
	}
	a := models.ContractorProcessAssignment{
		ContractorID: contractorID,
		ProcessType:  processType,
		CommencedAt:  t,
	}
	if err := s.db.Create(&a).Error; err != nil {
		return nil, err
	}
	s.db.Preload("Contractor").First(&a, a.ID)
	return &a, nil
}

func (s *ContractorService) DeleteProcessAssignment(id int) error {
	res := s.db.Delete(&models.ContractorProcessAssignment{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return &util.ResourceNotFoundException{Message: fmt.Sprintf("assignment %d not found", id)}
	}
	return nil
}
