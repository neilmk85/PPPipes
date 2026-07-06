package database

import (
	"log/slog"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Seed populates the database with default/required data
func Seed(db *gorm.DB) error {
	slog.Info("[Database] Starting seed data insertion")

	// 1. Seed built-in roles
	roleNames := []models.RoleName{
		models.RoleSuperAdmin,
		models.RoleAdmin,
		models.RoleManager,
		models.RoleCashier,
		models.RoleInventoryManager,
		models.RoleAccountant,
	}

	for _, name := range roleNames {
		if err := db.FirstOrCreate(&models.Role{}, models.Role{Name: name}).Error; err != nil {
			slog.Error("[Database] Failed to seed role", "role", name, "error", err)
			return err
		}
	}
	slog.Info("[Database] Roles seeded successfully")

	// 2. Seed default tax groups (GST)
	// GST 0%, 5%, 12%, 18%, 28% with CGST/SGST splits
	taxGroups := []models.TaxGroup{
		{
			Name:      "GST 0%",
			TotalRate: decimal.NewFromFloat(0.0),
			CGSTRate:  ptrDecimal(decimal.NewFromFloat(0.0)),
			SGSTRate:  ptrDecimal(decimal.NewFromFloat(0.0)),
			IGSTRate:  ptrDecimal(decimal.NewFromFloat(0.0)),
			CessRate:  decimal.NewFromFloat(0.0),
			Active:    true,
		},
		{
			Name:      "GST 5%",
			TotalRate: decimal.NewFromFloat(5.0),
			CGSTRate:  ptrDecimal(decimal.NewFromFloat(2.5)),
			SGSTRate:  ptrDecimal(decimal.NewFromFloat(2.5)),
			IGSTRate:  ptrDecimal(decimal.NewFromFloat(5.0)),
			CessRate:  decimal.NewFromFloat(0.0),
			Active:    true,
		},
		{
			Name:      "GST 12%",
			TotalRate: decimal.NewFromFloat(12.0),
			CGSTRate:  ptrDecimal(decimal.NewFromFloat(6.0)),
			SGSTRate:  ptrDecimal(decimal.NewFromFloat(6.0)),
			IGSTRate:  ptrDecimal(decimal.NewFromFloat(12.0)),
			CessRate:  decimal.NewFromFloat(0.0),
			Active:    true,
		},
		{
			Name:      "GST 18%",
			TotalRate: decimal.NewFromFloat(18.0),
			CGSTRate:  ptrDecimal(decimal.NewFromFloat(9.0)),
			SGSTRate:  ptrDecimal(decimal.NewFromFloat(9.0)),
			IGSTRate:  ptrDecimal(decimal.NewFromFloat(18.0)),
			CessRate:  decimal.NewFromFloat(0.0),
			Active:    true,
		},
		{
			Name:      "GST 28%",
			TotalRate: decimal.NewFromFloat(28.0),
			CGSTRate:  ptrDecimal(decimal.NewFromFloat(14.0)),
			SGSTRate:  ptrDecimal(decimal.NewFromFloat(14.0)),
			IGSTRate:  ptrDecimal(decimal.NewFromFloat(28.0)),
			CessRate:  decimal.NewFromFloat(0.0),
			Active:    true,
		},
	}

	for _, tg := range taxGroups {
		var existing models.TaxGroup
		result := db.Where("name = ?", tg.Name).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&tg).Error; err != nil {
				slog.Error("[Database] Failed to seed tax group", "tax_group", tg.Name, "error", err)
				return err
			}
		} else if result.Error != nil {
			return result.Error
		}
	}
	slog.Info("[Database] Tax groups seeded successfully")

	// 3. Seed default outlet
	var outletCount int64
	db.Model(&models.Outlet{}).Count(&outletCount)

	if outletCount == 0 {
		mainCode := "MAIN"
		outlet := models.Outlet{
			Name:                   "Main Factory",
			Code:                   &mainCode,
			CurrencyCode:           "INR",
			CurrencySymbol:         "₹",
			Active:                 true,
			PrintReceiptByDefault:  true,
			ShowTaxBreakdown:       true,
			ShowBarcodeOnReceipt:   true,
		}
		if err := db.Create(&outlet).Error; err != nil {
			slog.Error("[Database] Failed to seed outlet", "error", err)
			return err
		}
		slog.Info("[Database] Default outlet seeded successfully", "outlet_id", outlet.ID)
	}

	// 4. Seed super admin user
	var userCount int64
	db.Model(&models.User{}).Count(&userCount)

	if userCount == 0 {
		hashedPassword, err := util.HashPassword("Admin@123")
		if err != nil {
			slog.Error("[Database] Failed to hash password", "error", err)
			return err
		}

		adminUser := models.User{
			Name:     "Administrator",
			Email:    "admin@pos.com",
			Password: hashedPassword,
			Active:   true,
		}

		if err := db.Create(&adminUser).Error; err != nil {
			slog.Error("[Database] Failed to seed admin user", "error", err)
			return err
		}

		// Assign SUPER_ADMIN role
		var superAdminRole models.Role
		if err := db.Where("name = ?", models.RoleSuperAdmin).First(&superAdminRole).Error; err != nil {
			slog.Error("[Database] Failed to find SUPER_ADMIN role", "error", err)
			return err
		}

		userRole := models.UserRole{
			UserID: adminUser.ID,
			RoleID: superAdminRole.ID,
		}

		if err := db.Create(&userRole).Error; err != nil {
			slog.Error("[Database] Failed to assign role to admin user", "error", err)
			return err
		}

		slog.Info("[Database] Super admin user seeded successfully",
			"user_id", adminUser.ID,
			"email", adminUser.Email,
		)
	}

	// 5. Seed default expense categories
	expenseCategories := []models.ExpenseCategory{
		{
			Name:        "Rent",
			Description: ptrString("Store rent and lease"),
			Color:       "#EF4444",
			Icon:        "home",
			System:      true,
			Active:      true,
		},
		{
			Name:        "Utilities",
			Description: ptrString("Electricity, water, gas"),
			Color:       "#F97316",
			Icon:        "zap",
			System:      true,
			Active:      true,
		},
		{
			Name:        "Salaries",
			Description: ptrString("Employee salaries and wages"),
			Color:       "#EAB308",
			Icon:        "users",
			System:      true,
			Active:      true,
		},
		{
			Name:        "Marketing",
			Description: ptrString("Marketing and advertising"),
			Color:       "#22C55E",
			Icon:        "megaphone",
			System:      true,
			Active:      true,
		},
		{
			Name:        "Supplies",
			Description: ptrString("Office and store supplies"),
			Color:       "#3B82F6",
			Icon:        "package",
			System:      true,
			Active:      true,
		},
		{
			Name:        "Maintenance",
			Description: ptrString("Equipment and building maintenance"),
			Color:       "#8B5CF6",
			Icon:        "wrench",
			System:      true,
			Active:      true,
		},
		{
			Name:        "Other",
			Description: ptrString("Miscellaneous expenses"),
			Color:       "#6B7280",
			Icon:        "receipt",
			System:      true,
			Active:      true,
		},
	}

	for _, ec := range expenseCategories {
		var existing models.ExpenseCategory
		result := db.Where("name = ?", ec.Name).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			if err := db.Create(&ec).Error; err != nil {
				slog.Error("[Database] Failed to seed expense category", "category", ec.Name, "error", err)
				return err
			}
		} else if result.Error != nil {
			return result.Error
		}
	}
	slog.Info("[Database] Expense categories seeded successfully")

	// 6. Seed raw materials master list
	if err := seedRawMaterials(db); err != nil {
		return err
	}

	// 7. Seed pipe configs (5.25m and 6.5m) with material consumption rows
	if err := SeedPipeConfigs(db); err != nil {
		return err
	}

	slog.Info("[Database] All seed data inserted successfully")
	return nil
}

func seedRawMaterials(db *gorm.DB) error {
	type rm struct {
		name string
		uom  string
	}
	materials := []rm{
		// Steel sheets (one per pipe diameter)
		{"1.6MM SHEET 350", "kg"},
		{"1.6MM SHEET 400", "kg"},
		{"1.6MM SHEET 450", "kg"},
		{"1.6MM SHEET 500", "kg"},
		{"1.6MM SHEET 600", "kg"},
		{"1.6MM SHEET 700", "kg"},
		{"1.6MM SHEET 800", "kg"},
		{"1.6MM SHEET 900", "kg"},
		{"1.6MM SHEET 1000", "kg"},
		{"1.6MM SHEET 1100", "kg"},
		{"1.6MM SHEET 1200", "kg"},
		{"1.6MM SHEET 1300", "kg"},
		{"1.6MM SHEET 1400", "kg"},
		{"1.6MM SHEET 1500", "kg"},
		{"1.6MM SHEET 1600", "kg"},
		{"1.6MM SHEET 1700", "kg"},
		{"1.6MM SHEET 1800", "kg"},
		{"1.6MM SHEET 1900", "kg"},
		{"1.6MM SHEET 2000", "kg"},
		{"1.6MM SHEET 2100", "kg"},
		{"1.6MM SHEET 2200", "kg"},
		// Steel / metal
		{"BACK-SHEET", "kg"},
		{"MS FLAT 6 MM", "kg"},
		{"MS FLAT 8 MM", "kg"},
		{"MS FLAT 10 MM", "kg"},
		{"MS FLAT 12 MM", "kg"},
		{"4MM WINDING WIRE", "kg"},
		// Aggregates
		{"10MM METAL", "kg"},
		{"20MM METAL", "kg"},
		{"CRUSHED SAND", "kg"},
		{"PLASTER SAND", "kg"},
		{"DUST", "kg"},
		// Cement (production-only — not purchasable)
		{"Silo CEMENT", "kg"},
		{"EXTRA CEMENT", "kg"},
		{"LOOSE CEMENT", "kg"},
		// Purchasable cement products
		{"Cement", "MT"},
		{"Cement Bags", "nos"},
		// Other
		{"CHEMICAL", "ltr"},
	}

	for _, m := range materials {
		var existing models.Product
		result := db.Where("name = ? AND item_type = ?", m.name, "RAW_MATERIAL").First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			product := models.Product{
				Name:           m.name,
				ItemType:       "RAW_MATERIAL",
				UnitOfMeasure:  m.uom,
				TrackInventory: true,
				Active:         true,
			}
			if err := db.Create(&product).Error; err != nil {
				slog.Error("[Database] Failed to seed raw material", "name", m.name, "error", err)
				return err
			}
		} else if result.Error != nil {
			return result.Error
		}
	}
	slog.Info("[Database] Raw materials seeded successfully")
	return nil
}

// Helper function to create string pointers
func ptrString(s string) *string {
	return &s
}

// Helper function to create time pointers
func ptrTime(t time.Time) *time.Time {
	return &t
}

// Helper function to create decimal pointers
func ptrDecimal(d decimal.Decimal) *decimal.Decimal {
	return &d
}
