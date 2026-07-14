package service

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	excelize "github.com/xuri/excelize/v2"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ImportRowResult holds per-row result for import preview/actual
type ImportRowResult struct {
	RowNumber int    `json:"rowNumber"`
	Name      string `json:"name"`
	Phone     string `json:"phone,omitempty"`
	Email     string `json:"email,omitempty"`
	City      string `json:"city,omitempty"`
	Segment   string `json:"segment,omitempty"`
	Status    string `json:"status"` // "OK" | "ERROR"
	Error     string `json:"error,omitempty"`
}

// ImportResult is the structured response for import / dry-run
type ImportResult struct {
	TotalRows int               `json:"totalRows"`
	Created   int               `json:"created"`
	Skipped   int               `json:"skipped"`
	DryRun    bool              `json:"dryRun"`
	Rows      []ImportRowResult `json:"rows"`
}

type CustomerService struct {
	db *gorm.DB
}

func NewCustomerService(db *gorm.DB) *CustomerService {
	return &CustomerService{db: db}
}

// GetAll returns paginated list of customers with optional filtering
func (cs *CustomerService) GetAll(page, size int, search *string, segment *string, active *bool) (customers []models.Customer, total int64, err error) {
	query := cs.db

	if search != nil && *search != "" {
		searchPattern := "%" + *search + "%"
		query = query.Where("name LIKE ? OR phone LIKE ? OR email LIKE ?",
			searchPattern, searchPattern, searchPattern)
	}

	if segment != nil && *segment != "" {
		query = query.Where("segment = ?", *segment)
	}

	if active != nil {
		query = query.Where("is_active = ?", *active)
	}

	if err := query.Model(&models.Customer{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&customers).Error

	return customers, total, err
}

// GetByID returns a single customer by ID
func (cs *CustomerService) GetByID(id int) (*models.Customer, error) {
	customer := &models.Customer{}
	err := cs.db.First(customer, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Customer with ID %d not found", id)}
	}
	return customer, err
}

// GetByPhone returns a customer by phone number
func (cs *CustomerService) GetByPhone(phone string) (*models.Customer, error) {
	customer := &models.Customer{}
	err := cs.db.Where("phone = ?", phone).First(customer).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Customer with phone %s not found", phone)}
	}
	return customer, err
}

// Search returns customers matching query on name, phone, or email
func (cs *CustomerService) Search(q string) ([]models.Customer, error) {
	var customers []models.Customer
	searchPattern := "%" + q + "%"
	err := cs.db.Where("is_active = ? AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)",
		true, searchPattern, searchPattern, searchPattern).
		Limit(20).
		Find(&customers).Error
	return customers, err
}

// GetWithDues returns customers with outstanding dues
func (cs *CustomerService) GetWithDues() ([]models.Customer, error) {
	var customers []models.Customer
	err := cs.db.Where("outstanding_due > ?", 0).
		Order("outstanding_due DESC").
		Find(&customers).Error
	return customers, err
}

// GetLoyaltyHistory returns paginated loyalty transactions for a customer
func (cs *CustomerService) GetLoyaltyHistory(customerId, page, size int) (transactions []models.LoyaltyTransaction, total int64, err error) {
	query := cs.db.Where("customer_id = ?", customerId)

	if err := query.Model(&models.LoyaltyTransaction{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&transactions).Error

	return transactions, total, err
}

// Create creates a new customer
func (cs *CustomerService) Create(data models.Customer) (*models.Customer, error) {
	// Check if phone already exists
	if data.Phone != nil && *data.Phone != "" {
		var existing models.Customer
		if err := cs.db.Where("phone = ?", *data.Phone).First(&existing).Error; err == nil {
			return nil, &util.BusinessException{
				StatusCode: 400,
				Message:    fmt.Sprintf("Phone %s already registered", *data.Phone),
			}
		}
	}

	if err := cs.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

// Update updates an existing customer
func (cs *CustomerService) Update(id int, data models.Customer) (*models.Customer, error) {
	// Check if customer exists
	if _, err := cs.GetByID(id); err != nil {
		return nil, err
	}

	if err := cs.db.Model(&models.Customer{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}

	return cs.GetByID(id)
}

// AddLoyaltyPoints adds loyalty points to a customer
func (cs *CustomerService) AddLoyaltyPoints(customerId int, points decimal.Decimal, orderId *int, description *string) error {
	customer, err := cs.GetByID(customerId)
	if err != nil {
		return err
	}

	newBalance := customer.LoyaltyPoints.Add(points)

	return cs.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Customer{}).Where("id = ?", customerId).
			Update("loyalty_points", newBalance).Error; err != nil {
			return err
		}

		loyalty := models.LoyaltyTransaction{
			CustomerID:   customerId,
			OrderID:      orderId,
			Type:         models.LoyaltyTransactionTypeEarned,
			Points:       points,
			BalanceAfter: &newBalance,
			Description:  description,
		}
		return tx.Create(&loyalty).Error
	})
}

// RedeemLoyaltyPoints redeems loyalty points from a customer
func (cs *CustomerService) RedeemLoyaltyPoints(customerId int, points decimal.Decimal) error {
	customer, err := cs.GetByID(customerId)
	if err != nil {
		return err
	}

	if points.GreaterThan(customer.LoyaltyPoints) {
		return &util.BusinessException{
			StatusCode: 400,
			Message:    "Insufficient loyalty points",
		}
	}

	newBalance := customer.LoyaltyPoints.Sub(points)
	negPoints := points.Neg()

	return cs.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Customer{}).Where("id = ?", customerId).
			Update("loyalty_points", newBalance).Error; err != nil {
			return err
		}

		desc := "Points redeemed"
		loyalty := models.LoyaltyTransaction{
			CustomerID:   customerId,
			Type:         models.LoyaltyTransactionTypeRedeemed,
			Points:       negPoints,
			BalanceAfter: &newBalance,
			Description:  &desc,
		}
		return tx.Create(&loyalty).Error
	})
}

// ToggleActive flips the is_active flag on a customer
func (cs *CustomerService) ToggleActive(id int) (*models.Customer, error) {
	customer, err := cs.GetByID(id)
	if err != nil {
		return nil, err
	}
	newActive := !customer.Active
	if err := cs.db.Model(&models.Customer{}).Where("id = ?", id).
		Update("is_active", newActive).Error; err != nil {
		return nil, err
	}
	customer.Active = newActive
	return customer, nil
}

// InvoiceSummaryRow holds per-customer invoice totals computed from the invoices table.
type InvoiceSummaryRow struct {
	CustomerID  int             `json:"customerId"`
	TotalBilled decimal.Decimal `json:"totalBilled"`
	TotalPaid   decimal.Decimal `json:"totalPaid"`
	Outstanding decimal.Decimal `json:"outstanding"`
}

// GetInvoiceSummary returns invoice-based totals for every customer in the outlet.
func (cs *CustomerService) GetInvoiceSummary(outletId int) ([]InvoiceSummaryRow, error) {
	type row struct {
		CustomerID  int
		TotalBilled decimal.Decimal
		TotalPaid   decimal.Decimal
	}
	var rows []row
	err := cs.db.Raw(`
		SELECT customer_id,
		       COALESCE(SUM(total_amount), 0) AS total_billed,
		       COALESCE(SUM(paid_amount),  0) AS total_paid
		FROM invoices
		WHERE outlet_id = ? AND customer_id IS NOT NULL
		GROUP BY customer_id
	`, outletId).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]InvoiceSummaryRow, len(rows))
	for i, r := range rows {
		result[i] = InvoiceSummaryRow{
			CustomerID:  r.CustomerID,
			TotalBilled: r.TotalBilled,
			TotalPaid:   r.TotalPaid,
			Outstanding: r.TotalBilled.Sub(r.TotalPaid),
		}
	}
	return result, nil
}

// UpdateTotalSpent increments the total spent amount for a customer
func (cs *CustomerService) UpdateTotalSpent(customerId int, amount decimal.Decimal) error {
	return cs.db.Model(&models.Customer{}).Where("id = ?", customerId).
		Update("total_spent", gorm.Expr("total_spent + ?", amount)).Error
}

// UpdateOutstandingDue increments the outstanding due amount for a customer
func (cs *CustomerService) UpdateOutstandingDue(customerId int, amount decimal.Decimal) error {
	return cs.db.Model(&models.Customer{}).Where("id = ?", customerId).
		Update("outstanding_due", gorm.Expr("outstanding_due + ?", amount)).Error
}

// parseFileRows reads all data rows (skipping the header) from a CSV or xlsx reader.
// Filename is used to detect the format.
func parseFileRows(file io.Reader, filename string) ([][]string, error) {
	lower := strings.ToLower(filename)
	isXlsx := strings.HasSuffix(lower, ".xlsx") || strings.HasSuffix(lower, ".xls")

	if isXlsx {
		data, err := io.ReadAll(file)
		if err != nil {
			return nil, err
		}
		f, err := excelize.OpenReader(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("failed to open excel file: %w", err)
		}
		defer f.Close()

		sheets := f.GetSheetList()
		if len(sheets) == 0 {
			return nil, fmt.Errorf("no sheets found in excel file")
		}
		rows, err := f.GetRows(sheets[0])
		if err != nil {
			return nil, fmt.Errorf("failed to read rows: %w", err)
		}
		if len(rows) <= 1 {
			return [][]string{}, nil
		}
		return rows[1:], nil // skip header row
	}

	// Default: treat as CSV
	reader := csv.NewReader(file)
	if _, err := reader.Read(); err != nil { // skip header
		if err == io.EOF {
			return [][]string{}, nil
		}
		return nil, err
	}
	var result [][]string
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		result = append(result, record)
	}
	return result, nil
}

// col safely returns the trimmed value at index i, or "" if out of range.
func col(record []string, i int) string {
	if i < len(record) {
		return strings.TrimSpace(record[i])
	}
	return ""
}

// ImportFile imports customers from a CSV or xlsx file.
// When dryRun=true it validates every row and returns a preview without touching the DB.
func (cs *CustomerService) ImportFile(file io.Reader, filename string, dryRun bool) (*ImportResult, error) {
	rows, err := parseFileRows(file, filename)
	if err != nil {
		return nil, err
	}

	validSegments := map[string]bool{
		"REGULAR": true, "SILVER": true, "GOLD": true, "VIP": true,
	}

	result := &ImportResult{
		DryRun: dryRun,
		Rows:   make([]ImportRowResult, 0, len(rows)),
	}

	for i, record := range rows {
		rowNum := i + 2 // 1-indexed; +1 to account for skipped header

		// Skip fully-empty rows
		allEmpty := true
		for _, v := range record {
			if strings.TrimSpace(v) != "" {
				allEmpty = false
				break
			}
		}
		if allEmpty {
			continue
		}

		rowResult := ImportRowResult{RowNumber: rowNum, Status: "OK"}
		result.TotalRows++

		name := col(record, 0)
		if name == "" {
			rowResult.Status = "ERROR"
			rowResult.Error = "Name is required"
			result.Skipped++
			result.Rows = append(result.Rows, rowResult)
			continue
		}
		rowResult.Name = name
		rowResult.Phone = col(record, 1)
		rowResult.Email = col(record, 2)
		rowResult.City = col(record, 3)

		segment := "REGULAR"
		if s := strings.ToUpper(col(record, 5)); s != "" {
			if !validSegments[s] {
				rowResult.Status = "ERROR"
				rowResult.Error = fmt.Sprintf("Invalid segment '%s' (must be REGULAR/SILVER/GOLD/VIP)", col(record, 5))
				result.Skipped++
				result.Rows = append(result.Rows, rowResult)
				continue
			}
			segment = s
		}
		rowResult.Segment = segment

		if dryRun {
			// In dry-run mode just check if the phone already exists; still mark OK (will update).
			result.Created++
			result.Rows = append(result.Rows, rowResult)
			continue
		}

		// ── Actual import ──
		customer := models.Customer{
			Name:    name,
			Segment: models.CustomerSegment(segment),
		}
		if rowResult.Phone != "" {
			customer.Phone = &rowResult.Phone
		}
		if rowResult.Email != "" {
			customer.Email = &rowResult.Email
		}
		if rowResult.City != "" {
			customer.City = &rowResult.City
		}
		if state := col(record, 4); state != "" {
			customer.State = &state
		}

		// Upsert by phone: if phone matches an existing customer, update it.
		if customer.Phone != nil && *customer.Phone != "" {
			var existing models.Customer
			if cs.db.Where("phone = ?", *customer.Phone).First(&existing).Error == nil {
				cs.db.Model(&existing).Updates(customer)
				result.Created++
				result.Rows = append(result.Rows, rowResult)
				continue
			}
		}

		if err := cs.db.Create(&customer).Error; err != nil {
			rowResult.Status = "ERROR"
			rowResult.Error = "Failed to save: " + err.Error()
			result.Skipped++
		} else {
			result.Created++
		}
		result.Rows = append(result.Rows, rowResult)
	}

	return result, nil
}

// ExportCSV exports all customers as CSV
func (cs *CustomerService) ExportCSV() (string, error) {
	customers, _, err := cs.GetAll(0, 10000, nil, nil, nil)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	writer := csv.NewWriter(&sb)

	// Write header
	writer.Write([]string{"name", "phone", "email", "city", "state", "segment", "loyaltyPoints", "totalSpent", "outstandingDue"})

	// Write data
	for _, c := range customers {
		phone := ""
		if c.Phone != nil {
			phone = *c.Phone
		}
		email := ""
		if c.Email != nil {
			email = *c.Email
		}
		city := ""
		if c.City != nil {
			city = *c.City
		}
		state := ""
		if c.State != nil {
			state = *c.State
		}

		writer.Write([]string{
			c.Name,
			phone,
			email,
			city,
			state,
			string(c.Segment),
			c.LoyaltyPoints.String(),
			c.TotalSpent.String(),
			c.OutstandingDue.String(),
		})
	}

	writer.Flush()
	return sb.String(), writer.Error()
}
