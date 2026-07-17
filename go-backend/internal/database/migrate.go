package database

import (
	"log/slog"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

// Migrate performs database migrations for all models in proper order
// respecting foreign key dependencies
func Migrate(db *gorm.DB) error {
	slog.Info("[Database] Starting migrations")

	// Phase 0: Utility tables (sequences — used by all number generators)
	if err := db.AutoMigrate(&util.Sequence{}); err != nil {
		slog.Error("[Database] Failed to migrate Sequence", "error", err)
		return err
	}

	// Phase 1: Base entities with no dependencies
	if err := db.AutoMigrate(&models.Role{}); err != nil {
		slog.Error("[Database] Failed to migrate Role", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Outlet{}); err != nil {
		slog.Error("[Database] Failed to migrate Outlet", "error", err)
		return err
	}

	// Phase 2: User-related and catalog entities
	if err := db.AutoMigrate(&models.User{}); err != nil {
		slog.Error("[Database] Failed to migrate User", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.UserRole{}); err != nil {
		slog.Error("[Database] Failed to migrate UserRole", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Category{}); err != nil {
		slog.Error("[Database] Failed to migrate Category", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.TaxGroup{}); err != nil {
		slog.Error("[Database] Failed to migrate TaxGroup", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ExpenseCategory{}); err != nil {
		slog.Error("[Database] Failed to migrate ExpenseCategory", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.CustomRole{}); err != nil {
		slog.Error("[Database] Failed to migrate CustomRole", "error", err)
		return err
	}

	// Phase 3: Product and customer entities
	if err := db.AutoMigrate(&models.Product{}); err != nil {
		slog.Error("[Database] Failed to migrate Product", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductVariant{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductVariant", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductImage{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductImage", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Customer{}); err != nil {
		slog.Error("[Database] Failed to migrate Customer", "error", err)
		return err
	}

	// Phase 4: Inventory and supplier
	if err := db.AutoMigrate(&models.Inventory{}); err != nil {
		slog.Error("[Database] Failed to migrate Inventory", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Supplier{}); err != nil {
		slog.Error("[Database] Failed to migrate Supplier", "error", err)
		return err
	}

	// Phase 5: Sales entities (Shift, Order, Payment)
	if err := db.AutoMigrate(&models.Shift{}); err != nil {
		slog.Error("[Database] Failed to migrate Shift", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Order{}); err != nil {
		slog.Error("[Database] Failed to migrate Order", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.OrderItem{}); err != nil {
		slog.Error("[Database] Failed to migrate OrderItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Payment{}); err != nil {
		slog.Error("[Database] Failed to migrate Payment", "error", err)
		return err
	}

	// Phase 6: Invoice and quotation entities
	if err := db.AutoMigrate(&models.Invoice{}); err != nil {
		slog.Error("[Database] Failed to migrate Invoice", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.InvoiceItem{}); err != nil {
		slog.Error("[Database] Failed to migrate InvoiceItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Quotation{}); err != nil {
		slog.Error("[Database] Failed to migrate Quotation", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.QuotationItem{}); err != nil {
		slog.Error("[Database] Failed to migrate QuotationItem", "error", err)
		return err
	}

	// Phase 7: Credit notes, discounts, coupons
	if err := db.AutoMigrate(&models.CreditNote{}); err != nil {
		slog.Error("[Database] Failed to migrate CreditNote", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Discount{}); err != nil {
		slog.Error("[Database] Failed to migrate Discount", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.DiscountProduct{}); err != nil {
		slog.Error("[Database] Failed to migrate DiscountProduct", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.DiscountCategory{}); err != nil {
		slog.Error("[Database] Failed to migrate DiscountCategory", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Coupon{}); err != nil {
		slog.Error("[Database] Failed to migrate Coupon", "error", err)
		return err
	}

	// Phase 8: Stock management
	if err := db.AutoMigrate(&models.StockAdjustment{}); err != nil {
		slog.Error("[Database] Failed to migrate StockAdjustment", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.StockTransfer{}); err != nil {
		slog.Error("[Database] Failed to migrate StockTransfer", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.StockTransferItem{}); err != nil {
		slog.Error("[Database] Failed to migrate StockTransferItem", "error", err)
		return err
	}

	// Phase 9: Purchase management
	if err := db.AutoMigrate(&models.PurchaseOrder{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseOrder", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PurchaseOrderItem{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseOrderItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PurchaseBill{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseBill", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PurchaseBillItem{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseBillItem", "error", err)
		return err
	}

	// Phase 10: Purchase returns
	if err := db.AutoMigrate(&models.PurchaseReturn{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseReturn", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PurchaseReturnItem{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseReturnItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SaleReturn{}); err != nil {
		slog.Error("[Database] Failed to migrate SaleReturn", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SaleReturnItem{}); err != nil {
		slog.Error("[Database] Failed to migrate SaleReturnItem", "error", err)
		return err
	}

	// Phase 11: Expenses and bulk purchases
	if err := db.AutoMigrate(&models.Expense{}); err != nil {
		slog.Error("[Database] Failed to migrate Expense", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.BulkPurchase{}); err != nil {
		slog.Error("[Database] Failed to migrate BulkPurchase", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.BulkPurchaseConversion{}); err != nil {
		slog.Error("[Database] Failed to migrate BulkPurchaseConversion", "error", err)
		return err
	}

	// Phase 12: Incentives and loyalty
	if err := db.AutoMigrate(&models.IncentiveRule{}); err != nil {
		slog.Error("[Database] Failed to migrate IncentiveRule", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.IncentivePayout{}); err != nil {
		slog.Error("[Database] Failed to migrate IncentivePayout", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.LoyaltyTransaction{}); err != nil {
		slog.Error("[Database] Failed to migrate LoyaltyTransaction", "error", err)
		return err
	}

	// Phase 13: Logging and integration
	if err := db.AutoMigrate(&models.ActivityLog{}); err != nil {
		slog.Error("[Database] Failed to migrate ActivityLog", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.IntegrationConfig{}); err != nil {
		slog.Error("[Database] Failed to migrate IntegrationConfig", "error", err)
		return err
	}

	// Phase 14: Pricing
	if err := db.AutoMigrate(&models.PriceList{}); err != nil {
		slog.Error("[Database] Failed to migrate PriceList", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PriceListItem{}); err != nil {
		slog.Error("[Database] Failed to migrate PriceListItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PriceListSegment{}); err != nil {
		slog.Error("[Database] Failed to migrate PriceListSegment", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PriceListCustomer{}); err != nil {
		slog.Error("[Database] Failed to migrate PriceListCustomer", "error", err)
		return err
	}

	// Phase 15: Sales orders
	if err := db.AutoMigrate(&models.SalesOrder{}); err != nil {
		slog.Error("[Database] Failed to migrate SalesOrder", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SalesOrderItem{}); err != nil {
		slog.Error("[Database] Failed to migrate SalesOrderItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SalesOrderPayment{}); err != nil {
		slog.Error("[Database] Failed to migrate SalesOrderPayment", "error", err)
		return err
	}

	// Phase 16: PCCP Production Line
	// Order respects FK dependencies:
	// PipeConfig → PipeConfigMaterial (refs Product)
	// ProductionMachine (refs Outlet)
	// ProductionShiftTemplate (refs Outlet)
	// ProductionOrder (refs PipeConfig, Outlet, SalesOrder)
	// ProductionEntry (refs ProductionOrder, PipeConfig, ProductionMachine)
	// MaterialConsumption (refs ProductionEntry, PipeConfigMaterial, Product)
	// OverheadConfig (refs Outlet)
	// CostSheet / CostSheetLine (refs ProductionOrder)
	// ProductionPlan / ProductionPlanEntry (refs Outlet, ProductionOrder, ProductionMachine)
	// YardZone / YardLocation / YardMovement (refs Outlet, ProductionOrder, PipeConfig)
	if err := db.AutoMigrate(&models.PipeConfig{}); err != nil {
		slog.Error("[Database] Failed to migrate PipeConfig", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PipeConfigMaterial{}); err != nil {
		slog.Error("[Database] Failed to migrate PipeConfigMaterial", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductionMachine{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductionMachine", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductionShiftTemplate{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductionShiftTemplate", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductionOrder{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductionOrder", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductionEntry{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductionEntry", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.MaterialConsumption{}); err != nil {
		slog.Error("[Database] Failed to migrate MaterialConsumption", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.OverheadConfig{}); err != nil {
		slog.Error("[Database] Failed to migrate OverheadConfig", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.CostSheet{}); err != nil {
		slog.Error("[Database] Failed to migrate CostSheet", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.CostSheetLine{}); err != nil {
		slog.Error("[Database] Failed to migrate CostSheetLine", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductionPlan{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductionPlan", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductionPlanEntry{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductionPlanEntry", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.YardZone{}); err != nil {
		slog.Error("[Database] Failed to migrate YardZone", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.YardLocation{}); err != nil {
		slog.Error("[Database] Failed to migrate YardLocation", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.YardMovement{}); err != nil {
		slog.Error("[Database] Failed to migrate YardMovement", "error", err)
		return err
	}

	// Phase 17: Business page models (standalone, no FK dependencies)
	if err := db.AutoMigrate(&models.CementBag{}); err != nil {
		slog.Error("[Database] Failed to migrate CementBag", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Vehicle{}); err != nil {
		slog.Error("[Database] Failed to migrate Vehicle", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Maintenance{}); err != nil {
		slog.Error("[Database] Failed to migrate Maintenance", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Silo{}); err != nil {
		slog.Error("[Database] Failed to migrate Silo", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SiloExtraction{}); err != nil {
		slog.Error("[Database] Failed to migrate SiloExtraction", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.DieselMaintenance{}); err != nil {
		slog.Error("[Database] Failed to migrate DieselMaintenance", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.StoreRoomMaterial{}); err != nil {
		slog.Error("[Database] Failed to migrate StoreRoomMaterial", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ExtraVehicle{}); err != nil {
		slog.Error("[Database] Failed to migrate ExtraVehicle", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.TestingLab{}); err != nil {
		slog.Error("[Database] Failed to migrate TestingLab", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.BizConversion{}); err != nil {
		slog.Error("[Database] Failed to migrate BizConversion", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.BizCutting{}); err != nil {
		slog.Error("[Database] Failed to migrate BizCutting", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.BizExtraFab{}); err != nil {
		slog.Error("[Database] Failed to migrate BizExtraFab", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Discard{}); err != nil {
		slog.Error("[Database] Failed to migrate Discard", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PDI{}); err != nil {
		slog.Error("[Database] Failed to migrate PDI", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.LoadingRecord{}); err != nil {
		slog.Error("[Database] Failed to migrate LoadingRecord", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SiloFill{}); err != nil {
		slog.Error("[Database] Failed to migrate SiloFill", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Labour{}); err != nil {
		slog.Error("[Database] Failed to migrate Labour", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.BusinessRateConfig{}); err != nil {
		slog.Error("[Database] Failed to migrate BusinessRateConfig", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.CoatingContractorRate{}); err != nil {
		slog.Error("[Database] Failed to migrate CoatingContractorRate", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SpinningBedRate{}); err != nil {
		slog.Error("[Database] Failed to migrate SpinningBedRate", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProcessContractorAssignment{}); err != nil {
		slog.Error("[Database] Failed to migrate ProcessContractorAssignment", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ThirdPartyPipePurchase{}); err != nil {
		slog.Error("[Database] Failed to migrate ThirdPartyPipePurchase", "error", err)
		return err
	}
	// Add vendor_type column to suppliers
	if err := db.AutoMigrate(&models.Supplier{}); err != nil {
		slog.Error("[Database] Failed to migrate Supplier (vendor_type)", "error", err)
		return err
	}

	// Phase 17 additions: User preferences, vendor payments, vendor credits, cart holds
	if err := db.AutoMigrate(&models.UserPreference{}); err != nil {
		slog.Error("[Database] Failed to migrate UserPreference", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.VendorPayment{}); err != nil {
		slog.Error("[Database] Failed to migrate VendorPayment", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.VendorCredit{}); err != nil {
		slog.Error("[Database] Failed to migrate VendorCredit", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.CartHold{}); err != nil {
		slog.Error("[Database] Failed to migrate CartHold", "error", err)
		return err
	}

	// Phase 18: TDS (Tax Deducted at Source)
	if err := db.AutoMigrate(&models.TDSSection{}); err != nil {
		slog.Error("[Database] Failed to migrate TDSSection", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.TDSDeduction{}); err != nil {
		slog.Error("[Database] Failed to migrate TDSDeduction", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.TDSReceivable{}); err != nil {
		slog.Error("[Database] Failed to migrate TDSReceivable", "error", err)
		return err
	}
	// Add TDS columns to existing tables
	if err := db.AutoMigrate(&models.Supplier{}); err != nil {
		slog.Error("[Database] Failed to migrate Supplier (TDS)", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.VendorPayment{}); err != nil {
		slog.Error("[Database] Failed to migrate VendorPayment (TDS)", "error", err)
		return err
	}

	// Phase 19: Loading record invoice link
	if err := db.AutoMigrate(&models.LoadingRecord{}); err != nil {
		slog.Error("[Database] Failed to migrate LoadingRecord (invoice link)", "error", err)
		return err
	}

	// Phase 20: Invoice — delivery challan no, e-way bill no, e-invoice no
	if err := db.AutoMigrate(&models.Invoice{}); err != nil {
		slog.Error("[Database] Failed to migrate Invoice (DC/EWay/EInvoice)", "error", err)
		return err
	}

	// Phase 21: Site — Work Orders and Work Bills
	if err := db.AutoMigrate(&models.WorkOrder{}); err != nil {
		slog.Error("[Database] Failed to migrate WorkOrder", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.WorkOrderItem{}); err != nil {
		slog.Error("[Database] Failed to migrate WorkOrderItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.WorkBill{}); err != nil {
		slog.Error("[Database] Failed to migrate WorkBill", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.WorkBillItem{}); err != nil {
		slog.Error("[Database] Failed to migrate WorkBillItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.WorkBillPayment{}); err != nil {
		slog.Error("[Database] Failed to migrate WorkBillPayment", "error", err)
		return err
	}

	// ── Site: Contractors ──────────────────────────────────────────────────
	if err := db.AutoMigrate(&models.Contractor{}); err != nil {
		slog.Error("[Database] Failed to migrate Contractor", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SiteProject{}); err != nil {
		slog.Error("[Database] Failed to migrate SiteProject", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.WorkPackage{}); err != nil {
		slog.Error("[Database] Failed to migrate WorkPackage", "error", err)
		return err
	}
	// Add site_project_id and work_package_id columns to work_orders (nullable, backward compat)
	if err := db.AutoMigrate(&models.WorkOrder{}); err != nil {
		slog.Error("[Database] Failed to migrate WorkOrder (add package columns)", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.MaterialIssue{}); err != nil {
		slog.Error("[Database] Failed to migrate MaterialIssue", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProgressClaim{}); err != nil {
		slog.Error("[Database] Failed to migrate ProgressClaim", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProgressClaimItem{}); err != nil {
		slog.Error("[Database] Failed to migrate ProgressClaimItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.DailyProgress{}); err != nil {
		slog.Error("[Database] Failed to migrate DailyProgress", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.LabourAttendance{}); err != nil {
		slog.Error("[Database] Failed to migrate LabourAttendance", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.EquipmentLog{}); err != nil {
		slog.Error("[Database] Failed to migrate EquipmentLog", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.MaterialReceipt{}); err != nil {
		slog.Error("[Database] Failed to migrate MaterialReceipt", "error", err)
		return err
	}

	// Phase 22: Purchasable cement products
	for _, p := range []struct{ name, uom string }{{"Cement", "MT"}, {"Cement Bags", "nos"}} {
		var existing models.Product
		if db.Where("name = ? AND item_type = ?", p.name, "RAW_MATERIAL").First(&existing).Error != nil {
			db.Create(&models.Product{
				Name:          p.name,
				ItemType:      "RAW_MATERIAL",
				UnitOfMeasure: p.uom,
				TrackInventory: true,
				Active:        true,
				ProductType:   "PHYSICAL",
			})
		}
	}

	// Phase 23: Card permissions (user-level and role-level)
	if err := db.AutoMigrate(&models.UserCardPermission{}); err != nil {
		slog.Error("[Database] Failed to migrate UserCardPermission", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.RoleCardPermission{}); err != nil {
		slog.Error("[Database] Failed to migrate RoleCardPermission", "error", err)
		return err
	}

	// Phase 24: Out-of-office flag on users; print_needed + printed_at on invoices
	if err := db.AutoMigrate(&models.User{}); err != nil {
		slog.Error("[Database] Failed to migrate User (phase 24)", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Invoice{}); err != nil {
		slog.Error("[Database] Failed to migrate Invoice (phase 24)", "error", err)
		return err
	}

	// Phase 25: RA Bills (PP Pipes as sub-contractor) + ppPipesRole on SiteProject
	if err := db.AutoMigrate(&models.SiteProject{}); err != nil {
		slog.Error("[Database] Failed to migrate SiteProject (phase 25)", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ClientBill{}); err != nil {
		slog.Error("[Database] Failed to migrate ClientBill", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ClientBillItem{}); err != nil {
		slog.Error("[Database] Failed to migrate ClientBillItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ClientBillPayment{}); err != nil {
		slog.Error("[Database] Failed to migrate ClientBillPayment", "error", err)
		return err
	}

	// Phase 26: Sub-contracts
	if err := db.AutoMigrate(&models.SubContract{}); err != nil {
		slog.Error("[Database] Failed to migrate SubContract", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SubContractItem{}); err != nil {
		slog.Error("[Database] Failed to migrate SubContractItem", "error", err)
		return err
	}

	slog.Info("[Database] Migrations completed successfully")
	return nil
}
