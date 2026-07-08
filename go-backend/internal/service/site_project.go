package service

import (
	"fmt"
	"strings"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type SiteProjectService struct {
	db *gorm.DB
}

func NewSiteProjectService(db *gorm.DB) *SiteProjectService {
	return &SiteProjectService{db: db}
}

func (s *SiteProjectService) GetAll(search *string, status *string) ([]models.SiteProject, error) {
	query := s.db.Model(&models.SiteProject{}).Where("is_active = ?", true)

	if search != nil && *search != "" {
		p := "%" + *search + "%"
		query = query.Where("name LIKE ? OR client_name LIKE ? OR location LIKE ? OR contract_no LIKE ?", p, p, p, p)
	}
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}

	var projects []models.SiteProject
	err := query.Order("created_at DESC").Find(&projects).Error
	return projects, err
}

func (s *SiteProjectService) GetByID(id int) (*models.SiteProject, error) {
	var p models.SiteProject
	err := s.db.Where("id = ? AND is_active = ?", id, true).First(&p).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Site project with ID %d not found", id)}
	}
	return &p, err
}

// createOutletForProject creates a site outlet and returns its ID.
func (s *SiteProjectService) createOutletForProject(projectID int, name, location string) (int, error) {
	code := fmt.Sprintf("SITE-%04d", projectID)
	// Truncate name to 50 chars for the outlet name
	outletName := name
	if len(outletName) > 50 {
		outletName = outletName[:50]
	}
	loc := location
	outlet := models.Outlet{
		Name:    outletName + " (Site)",
		Code:    &code,
		City:    &loc,
		Active:  true,
	}
	if err := s.db.Where("code = ?", code).FirstOrCreate(&outlet).Error; err != nil {
		return 0, err
	}
	return outlet.ID, nil
}

func (s *SiteProjectService) Create(data models.SiteProject) (*models.SiteProject, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	// Auto-create a corresponding site outlet
	outletID, err := s.createOutletForProject(data.ID, data.Name, data.Location)
	if err == nil {
		s.db.Model(&models.SiteProject{}).Where("id = ?", data.ID).Update("outlet_id", outletID)
		data.OutletID = &outletID
	}
	return &data, nil
}

func (s *SiteProjectService) Update(id int, data models.SiteProject) (*models.SiteProject, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	// Don't overwrite outlet_id via update
	data.OutletID = nil
	if err := s.db.Model(&models.SiteProject{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *SiteProjectService) UpdateStatus(id int, status string) (*models.SiteProject, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.SiteProject{}).Where("id = ?", id).Update("status", status).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *SiteProjectService) Delete(id int) error {
	p, err := s.GetByID(id)
	if err != nil {
		return err
	}
	return s.db.Model(p).Update("is_active", false).Error
}

// EnsureOutlets creates site outlets for any existing site projects that don't have one.
// Called on backend startup after migration.
func (s *SiteProjectService) EnsureOutlets() error {
	var projects []models.SiteProject
	if err := s.db.Where("outlet_id IS NULL AND is_active = ?", true).Find(&projects).Error; err != nil {
		return err
	}
	for _, p := range projects {
		outletID, err := s.createOutletForProject(p.ID, p.Name, strings.TrimSpace(p.Location))
		if err != nil {
			continue
		}
		s.db.Model(&models.SiteProject{}).Where("id = ?", p.ID).Update("outlet_id", outletID)
	}
	return nil
}
