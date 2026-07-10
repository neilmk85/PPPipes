package router

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"

	"github.com/nilesh/pos-backend/internal/config"
	"github.com/nilesh/pos-backend/internal/handler"
	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/websocket"
	"gorm.io/gorm"
)

// Setup creates and configures the HTTP router with all routes and middleware
func Setup(db *gorm.DB, cfg *config.Config, wsHub *websocket.Hub) http.Handler {
	mux := http.NewServeMux()

	// Initialize services and handlers
	authService := service.NewAuthService(db)
	authHandler := handler.NewAuthHandler(authService)

	userService := service.NewUserService(db)
	usersHandler := handler.NewUsersHandler(userService)

	outletsHandler := handler.NewOutletsHandler(db)
	staffHandler := handler.NewStaffHandler(db)

	// ==================== CUSTOMER & PURCHASING SERVICES ====================
	customerService := service.NewCustomerService(db)
	customerHandler := handler.NewCustomerHandler(customerService)

	vendorService := service.NewVendorService(db)
	vendorHandler := handler.NewVendorHandler(vendorService)

	purchaseOrderService := service.NewPurchaseOrderService(db)
	purchaseOrderHandler := handler.NewPurchaseOrderHandler(purchaseOrderService)

	purchaseBillService := service.NewPurchaseBillService(db)
	purchaseBillHandler := handler.NewPurchaseBillHandler(purchaseBillService)

	userPreferenceService := service.NewUserPreferenceService(db)
	userPreferenceHandler := handler.NewUserPreferenceHandler(userPreferenceService)

	vendorPaymentService := service.NewVendorPaymentService(db)
	tdsService := service.NewTDSService(db)
	tdsHandler := handler.NewTDSHandler(tdsService)
	vendorPaymentHandler := handler.NewVendorPaymentHandler(vendorPaymentService, purchaseBillService, tdsService)

	vendorCreditService := service.NewVendorCreditService(db)
	vendorCreditHandler := handler.NewVendorCreditHandler(vendorCreditService)

	cartHoldService := service.NewCartHoldService(db)
	cartHoldHandler := handler.NewCartHoldHandler(cartHoldService)

	purchaseReturnService := service.NewPurchaseReturnService(db)
	purchaseReturnHandler := handler.NewPurchaseReturnHandler(purchaseReturnService)

	saleReturnService := service.NewSaleReturnService(db)
	saleReturnHandler := handler.NewSaleReturnHandler(saleReturnService)

	bulkPurchaseService := service.NewBulkPurchaseService(db)
	bulkPurchaseHandler := handler.NewBulkPurchaseHandler(bulkPurchaseService)

	// ==================== INTEGRATION, SALES ORDERS & OTHER SERVICES ====================
	integrationService := service.NewIntegrationService(db)
	integrationHandler := handler.NewIntegrationHandler(integrationService)

	salesOrderService := service.NewSalesOrderService(db)
	salesOrderHandler := handler.NewSalesOrderHandler(salesOrderService)

	categoryService := service.NewCategoryService(db)
	categoryHandler := handler.NewCategoryHandler(categoryService)

	taxGroupService := service.NewTaxGroupService(db)
	taxGroupHandler := handler.NewTaxGroupHandler(taxGroupService)

	productService := service.NewProductService(db)
	productHandler := handler.NewProductHandler(productService, cfg.UploadDir, int64(cfg.MaxFileSize))

	reportService := service.NewReportService(db)
	reportHandler := handler.NewReportHandler(reportService)

	dayBookService := service.NewDayBookService(db)
	dayBookHandler := handler.NewDayBookHandler(dayBookService)

	stockStatementService := service.NewStockStatementService(db)
	stockStatementHandler := handler.NewStockStatementHandler(stockStatementService)

	inventoryService := service.NewInventoryService(db)
	inventoryHandler := handler.NewInventoryHandler(inventoryService)

	incentiveService := service.NewIncentiveService(db)
	incentiveHandler := handler.NewIncentiveHandler(incentiveService)

	expenseService := service.NewExpenseService(db)
	expenseCategoryHandler := handler.NewExpenseCategoryHandler(expenseService)
	expenseHandler := handler.NewExpenseHandler(expenseService)

	invoiceService := service.NewInvoiceService(db)
	invoiceHandler := handler.NewInvoiceHandler(invoiceService)

	quotationService := service.NewQuotationService(db)
	quotationHandler := handler.NewQuotationHandler(quotationService)

	creditNoteService := service.NewCreditNoteService(db)
	creditNoteHandler := handler.NewCreditNoteHandler(creditNoteService)

	discountService := service.NewDiscountService(db)
	discountHandler := handler.NewDiscountHandler(discountService)

	shiftService := service.NewShiftService(db)
	shiftHandler := handler.NewShiftHandler(shiftService)

	orderService := service.NewOrderService(db)
	orderHandler := handler.NewOrderHandler(orderService)

	priceListService := service.NewPriceListService(db)
	priceListHandler := handler.NewPriceListHandler(priceListService)

	customRoleHandler := handler.NewCustomRoleHandler(db)
	activityLogHandler := handler.NewActivityLogHandler(db)

	workOrderService := service.NewWorkOrderService(db)
	workOrderHandler := handler.NewWorkOrderHandler(workOrderService)

	workBillService := service.NewWorkBillService(db)
	workBillHandler := handler.NewWorkBillHandler(workBillService)

	contractorService := service.NewContractorService(db)
	contractorHandler := handler.NewContractorHandler(contractorService)

	siteProjectService := service.NewSiteProjectService(db)
	siteProjectHandler := handler.NewSiteProjectHandler(siteProjectService)

	workPackageService := service.NewWorkPackageService(db)
	workPackageHandler := handler.NewWorkPackageHandler(workPackageService)

	materialIssueService := service.NewMaterialIssueService(db)
	materialIssueHandler := handler.NewMaterialIssueHandler(materialIssueService)

	progressClaimService := service.NewProgressClaimService(db)
	progressClaimHandler := handler.NewProgressClaimHandler(progressClaimService)

	dailyProgressService := service.NewDailyProgressService(db)
	dailyProgressHandler := handler.NewDailyProgressHandler(dailyProgressService)

	labourAttendanceService := service.NewLabourAttendanceService(db)
	labourAttendanceHandler := handler.NewLabourAttendanceHandler(labourAttendanceService)

	equipmentLogService := service.NewEquipmentLogService(db)
	equipmentLogHandler := handler.NewEquipmentLogHandler(equipmentLogService)

	materialReceiptService := service.NewMaterialReceiptService(db)
	materialReceiptHandler := handler.NewMaterialReceiptHandler(materialReceiptService)

	siteReportService := service.NewSiteReportService(db)
	siteReportHandler := handler.NewSiteReportHandler(siteReportService)

	// ==================== WEBSOCKET ====================
	mux.HandleFunc("GET /ws", wsHub.HandleWS)

	// ==================== HEALTH CHECKS ====================
	mux.HandleFunc("GET /health", handler.HealthCheck)
	mux.HandleFunc("GET /api/health", handler.HealthCheck)

	// ==================== AUTHENTICATION ====================
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/auth/register", middleware.Chain(
		authHandler.Register,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/auth/refresh", authHandler.RefreshToken)
	mux.HandleFunc("POST /api/auth/logout", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
	))

	// ==================== USERS / STAFF ====================
	mux.HandleFunc("GET /api/users", middleware.Chain(
		usersHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/users/me", middleware.Chain(
		usersHandler.GetProfile,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/users/me", middleware.Chain(
		usersHandler.UpdateProfile,
		middleware.Authenticate(db),
	))
	// /api/users/outlet/{outletId} — adapter: rewrites path param → query param for staffHandler.GetAll
	mux.HandleFunc("GET /api/users/outlet/{outletId}", middleware.Chain(
		func(w http.ResponseWriter, r *http.Request) {
			outletId := r.PathValue("outletId")
			q := r.URL.Query()
			q.Set("outletId", outletId)
			r.URL.RawQuery = q.Encode()
			staffHandler.GetAll(w, r)
		},
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/users/{id}", middleware.Chain(
		usersHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/users", middleware.Chain(
		usersHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/users/{id}", middleware.Chain(
		usersHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/users/{id}", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/users/{id}/change-password", middleware.Chain(
		usersHandler.ChangePassword,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/users/{id}/deactivate", middleware.Chain(
		usersHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/users/{id}/activate", middleware.Chain(
		usersHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	mux.HandleFunc("PATCH /api/users/me/out-of-office", middleware.Chain(
		usersHandler.ToggleOutOfOffice,
		middleware.Authenticate(db),
	))

	mux.HandleFunc("GET /api/card-permissions/{id}", middleware.Chain(
		usersHandler.GetCardPermissions,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/card-permissions/{id}", middleware.Chain(
		usersHandler.UpdateCardPermissions,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/card-permissions/role/{roleName}", middleware.Chain(
		usersHandler.GetRoleCardPermissions,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/card-permissions/role/{roleName}", middleware.Chain(
		usersHandler.UpdateRoleCardPermissions,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// Staff endpoints (alias for users)
	mux.HandleFunc("GET /api/staff", middleware.Chain(
		staffHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/staff/export/csv", middleware.Chain(
		staffHandler.ExportCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/staff", middleware.Chain(
		usersHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/staff/{id}", middleware.Chain(
		usersHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/staff/{id}", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== OUTLETS ====================
	mux.HandleFunc("GET /api/outlets", middleware.Chain(
		outletsHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/outlets/{id}", middleware.Chain(
		outletsHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/outlets", middleware.Chain(
		outletsHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN"),
	))
	mux.HandleFunc("PUT /api/outlets/{id}", middleware.Chain(
		outletsHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PATCH /api/outlets/{id}", middleware.Chain(
		outletsHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== PRODUCTS ====================
	mux.HandleFunc("GET /api/products", middleware.Chain(
		productHandler.GetAll,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/search", middleware.Chain(
		productHandler.Search,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/units", middleware.Chain(
		productHandler.GetUnits,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/low-stock", middleware.Chain(
		productHandler.GetLowStock,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/products/generate-barcode", middleware.Chain(
		productHandler.GenerateBarcode,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/products/import/template", middleware.Chain(
		productHandler.GetImportTemplate,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/products/export/csv", middleware.Chain(
		productHandler.ExportCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/products/barcode/{barcode}", middleware.Chain(
		productHandler.GetByBarcode,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/category/{categoryId}", middleware.Chain(
		productHandler.GetByCategory,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/{id}", middleware.Chain(
		productHandler.GetByID,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("POST /api/products", middleware.Chain(
		productHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/products/{id}", middleware.Chain(
		productHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PATCH /api/products/{id}/toggle-active", middleware.Chain(
		productHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/products/{id}", middleware.Chain(
		productHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/products/bulk-import", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/products/{id}/images", middleware.Chain(
		productHandler.UploadImage,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/products/{id}/images/{imageId}", middleware.Chain(
		productHandler.DeleteImage,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/products/{id}/variants", middleware.Chain(
		productHandler.CreateVariant,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/products/{id}/variants/{variantId}", middleware.Chain(
		productHandler.UpdateVariant,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/products/{id}/variants/{variantId}", middleware.Chain(
		productHandler.DeleteVariant,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))

	// ==================== CATEGORIES ====================
	mux.HandleFunc("GET /api/categories/roots", middleware.Chain(
		categoryHandler.GetRoots,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/categories/{id}/children", middleware.Chain(
		categoryHandler.GetChildren,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/categories", middleware.Chain(
		categoryHandler.GetAll,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/categories/{id}", middleware.Chain(
		categoryHandler.GetByID,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("POST /api/categories", middleware.Chain(
		categoryHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/categories/{id}", middleware.Chain(
		categoryHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PATCH /api/categories/{id}/toggle-active", middleware.Chain(
		categoryHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/categories/{id}", middleware.Chain(
		categoryHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== TAX GROUPS ====================
	mux.HandleFunc("GET /api/tax-groups", middleware.Chain(
		taxGroupHandler.GetAll,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/tax-groups/{id}", middleware.Chain(
		taxGroupHandler.GetByID,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("POST /api/tax-groups", middleware.Chain(
		taxGroupHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("PUT /api/tax-groups/{id}", middleware.Chain(
		taxGroupHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("DELETE /api/tax-groups/{id}", middleware.Chain(
		taxGroupHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== INVENTORY ====================
	mux.HandleFunc("GET /api/inventory/low-stock", middleware.Chain(
		inventoryHandler.GetLowStock,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/adjustments", middleware.Chain(
		inventoryHandler.GetAdjustments,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/transfers", middleware.Chain(
		inventoryHandler.GetTransfers,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/transfers/{id}", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/inventory/transfers/{id}/approve", middleware.Chain(
		inventoryHandler.ApproveTransfer,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/inventory/transfers/{id}/ship", middleware.Chain(
		inventoryHandler.ShipTransfer,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/inventory/transfers/{id}/receive", middleware.Chain(
		inventoryHandler.ReceiveTransfer,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/inventory", middleware.Chain(
		inventoryHandler.GetByOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/outlet/{outletId}", middleware.Chain(
		inventoryHandler.GetByOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/product/{productId}/outlet/{outletId}", middleware.Chain(
		inventoryHandler.GetByProductAndOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/product/{productId}/all-outlets", middleware.Chain(
		inventoryHandler.GetByProductAllOutlets,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/inventory/reorder-level", middleware.Chain(
		inventoryHandler.UpdateReorderLevel,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/inventory/adjustments", middleware.Chain(
		inventoryHandler.AdjustStock,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/inventory/transfers", middleware.Chain(
		inventoryHandler.CreateTransfer,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/inventory/export", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
	))

	// ==================== CUSTOMERS ====================
	mux.HandleFunc("GET /api/customers", middleware.Chain(
		customerHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/with-dues", middleware.Chain(
		customerHandler.GetWithDues,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/search", middleware.Chain(
		customerHandler.Search,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/phone", middleware.Chain(
		customerHandler.GetByPhone,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/{id}", middleware.Chain(
		customerHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/{id}/loyalty-history", middleware.Chain(
		customerHandler.GetLoyaltyHistory,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/customers", middleware.Chain(
		customerHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/customers/{id}", middleware.Chain(
		customerHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/customers/{id}/toggle-active", middleware.Chain(
		customerHandler.ToggleActive,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/customers/import", middleware.Chain(
		customerHandler.ImportCSV,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/customers/export/csv", middleware.Chain(
		customerHandler.ExportCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/export/excel", middleware.Chain(
		customerHandler.ExportExcel,
		middleware.Authenticate(db),
	))

	// ==================== ORDERS ====================
	mux.HandleFunc("GET /api/orders", middleware.Chain(
		orderHandler.GetByOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/orders/customer/{customerId}", middleware.Chain(
		orderHandler.GetByCustomer,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/orders/number/{orderNumber}", middleware.Chain(
		orderHandler.GetByOrderNumber,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/orders", middleware.Chain(
		orderHandler.Checkout,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))
	mux.HandleFunc("POST /api/orders/{id}/return", middleware.Chain(
		orderHandler.ProcessReturn,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))
	mux.HandleFunc("POST /api/orders/{id}/hold", middleware.Chain(
		orderHandler.HoldOrder,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))
	mux.HandleFunc("POST /api/orders/{id}/cancel", middleware.Chain(
		orderHandler.CancelOrder,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))

	// ==================== INVOICES ====================
	mux.HandleFunc("GET /api/invoices", middleware.Chain(
		invoiceHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/invoices/next-number", middleware.Chain(
		invoiceHandler.PeekNextNumber,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/invoices/{id}", middleware.Chain(
		invoiceHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/invoices", middleware.Chain(
		invoiceHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRoleOrPermission("CONVERT_LOADING_TO_INVOICE", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/invoices/{id}", middleware.Chain(
		invoiceHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("PATCH /api/invoices/{id}/status", middleware.Chain(
		invoiceHandler.UpdateStatus,
		middleware.Authenticate(db),
		middleware.RequireRoleOrPermission("CONVERT_LOADING_TO_INVOICE", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("POST /api/invoices/{id}/payment", middleware.Chain(
		invoiceHandler.RecordPayment,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("POST /api/invoices/{id}/send", middleware.Chain(
		invoiceHandler.SendEmail,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("DELETE /api/invoices/{id}", middleware.Chain(
		invoiceHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	mux.HandleFunc("GET /api/invoices/print-queue", middleware.Chain(
		invoiceHandler.GetPrintQueue,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNTANT"),
	))
	mux.HandleFunc("PATCH /api/invoices/{id}/mark-printed", middleware.Chain(
		invoiceHandler.MarkPrinted,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNTANT"),
	))

	// ==================== QUOTATIONS ====================
	mux.HandleFunc("GET /api/quotations/next-number", middleware.Chain(
		quotationHandler.PeekNextNumber,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/quotations", middleware.Chain(
		quotationHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/quotations/{id}", middleware.Chain(
		quotationHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/quotations", middleware.Chain(
		quotationHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/quotations/{id}", middleware.Chain(
		quotationHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PATCH /api/quotations/{id}/status", middleware.Chain(
		quotationHandler.UpdateStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/quotations/{id}", middleware.Chain(
		quotationHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== CREDIT NOTES ====================
	mux.HandleFunc("GET /api/credit-notes", middleware.Chain(
		creditNoteHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/credit-notes/customer/{customerId}", middleware.Chain(
		creditNoteHandler.GetByCustomer,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/credit-notes/customer/{customerId}/active", middleware.Chain(
		creditNoteHandler.GetActiveByCustomer,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/credit-notes", middleware.Chain(
		creditNoteHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("POST /api/credit-notes/{id}/apply", middleware.Chain(
		creditNoteHandler.Apply,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("POST /api/credit-notes/{id}/cancel", middleware.Chain(
		creditNoteHandler.Cancel,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))

	// ==================== DISCOUNTS & COUPONS ====================
	mux.HandleFunc("GET /api/discounts", middleware.Chain(
		discountHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/discounts/coupons", middleware.Chain(
		discountHandler.GetCoupons,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/discounts", middleware.Chain(
		discountHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/discounts/{id}", middleware.Chain(
		discountHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/discounts/{id}", middleware.Chain(
		discountHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/discounts/coupons", middleware.Chain(
		discountHandler.CreateCoupon,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/discounts/coupons/{id}", middleware.Chain(
		discountHandler.UpdateCoupon,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/discounts/coupons/{id}", middleware.Chain(
		discountHandler.DeleteCoupon,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/discounts/coupons/{code}/validate", middleware.Chain(
		discountHandler.ValidateCoupon,
		middleware.OptionalAuth(db),
	))

	// ==================== SHIFTS ====================
	mux.HandleFunc("GET /api/shifts/outlet/{outletId}", middleware.Chain(
		shiftHandler.GetByOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/shifts/current/{cashierId}", middleware.Chain(
		shiftHandler.GetCurrent,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/shifts/open", middleware.Chain(
		shiftHandler.Open,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/shifts/{id}/close", middleware.Chain(
		shiftHandler.Close,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))

	// ==================== PRICE LISTS ====================
	mux.HandleFunc("GET /api/price-lists", middleware.Chain(
		priceListHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/price-lists/{id}", middleware.Chain(
		priceListHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/price-lists", middleware.Chain(
		priceListHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/price-lists/{id}", middleware.Chain(
		priceListHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PATCH /api/price-lists/{id}/toggle-active", middleware.Chain(
		priceListHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/price-lists/{id}", middleware.Chain(
		priceListHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/price-lists/resolve", middleware.Chain(
		priceListHandler.ResolvePrice,
		middleware.OptionalAuth(db),
	))

	// ==================== VENDORS / SUPPLIERS ====================
	mux.HandleFunc("GET /api/vendors", middleware.Chain(
		vendorHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/vendors/{id}", middleware.Chain(
		vendorHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/vendors", middleware.Chain(
		vendorHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/vendors/{id}", middleware.Chain(
		vendorHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/vendors/{id}", middleware.Chain(
		vendorHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/vendors/import", middleware.Chain(
		vendorHandler.ImportCSV,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/vendors/import/template", middleware.Chain(
		vendorHandler.GetImportTemplate,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/vendors/export/csv", middleware.Chain(
		vendorHandler.ExportCSV,
		middleware.Authenticate(db),
	))

	// ==================== SITE: CONTRACTORS ====================
	mux.HandleFunc("GET /api/contractors", middleware.Chain(
		contractorHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/contractors/{id}", middleware.Chain(
		contractorHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/contractors", middleware.Chain(
		contractorHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/contractors/{id}", middleware.Chain(
		contractorHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/contractors/{id}", middleware.Chain(
		contractorHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: PROJECTS ====================
	mux.HandleFunc("GET /api/site-projects", middleware.Chain(
		siteProjectHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/site-projects/{id}", middleware.Chain(
		siteProjectHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/site-projects", middleware.Chain(
		siteProjectHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/site-projects/{id}", middleware.Chain(
		siteProjectHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/site-projects/{id}/status", middleware.Chain(
		siteProjectHandler.UpdateStatus,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/site-projects/{id}", middleware.Chain(
		siteProjectHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: WORK PACKAGES ====================
	mux.HandleFunc("GET /api/site-projects/{projectId}/work-packages", middleware.Chain(
		workPackageHandler.GetByProject,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/work-packages", middleware.Chain(
		workPackageHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/work-packages/{id}", middleware.Chain(
		workPackageHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/work-packages/{id}", middleware.Chain(
		workPackageHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/work-packages/{id}/status", middleware.Chain(
		workPackageHandler.UpdateStatus,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/work-packages/{id}", middleware.Chain(
		workPackageHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: MATERIAL ISSUES ====================
	mux.HandleFunc("GET /api/material-issues", middleware.Chain(
		materialIssueHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/material-issues", middleware.Chain(
		materialIssueHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/material-issues/{id}", middleware.Chain(
		materialIssueHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/material-issues/{id}", middleware.Chain(
		materialIssueHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/material-issues/{id}", middleware.Chain(
		materialIssueHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: PROGRESS CLAIMS ====================
	mux.HandleFunc("GET /api/progress-claims", middleware.Chain(
		progressClaimHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/work-orders/{workOrderId}/progress-claims", middleware.Chain(
		progressClaimHandler.GetByWorkOrder,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/progress-claims", middleware.Chain(
		progressClaimHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/progress-claims/{id}", middleware.Chain(
		progressClaimHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/progress-claims/{id}", middleware.Chain(
		progressClaimHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/progress-claims/{id}/verify", middleware.Chain(
		progressClaimHandler.Verify,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/progress-claims/{id}", middleware.Chain(
		progressClaimHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: DAILY PROGRESS ====================
	mux.HandleFunc("GET /api/site-projects/{projectId}/daily-progress", middleware.Chain(
		dailyProgressHandler.GetByProject,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/daily-progress", middleware.Chain(
		dailyProgressHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/daily-progress/{id}", middleware.Chain(
		dailyProgressHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/daily-progress/{id}", middleware.Chain(
		dailyProgressHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/daily-progress/{id}", middleware.Chain(
		dailyProgressHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: LABOUR ATTENDANCE ====================
	mux.HandleFunc("GET /api/site-projects/{projectId}/labour-attendance", middleware.Chain(
		labourAttendanceHandler.GetByProject,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/labour-attendance", middleware.Chain(
		labourAttendanceHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/labour-attendance/{id}", middleware.Chain(
		labourAttendanceHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/labour-attendance/{id}", middleware.Chain(
		labourAttendanceHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/labour-attendance/{id}", middleware.Chain(
		labourAttendanceHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: EQUIPMENT LOGS ====================
	mux.HandleFunc("GET /api/site-projects/{projectId}/equipment-logs", middleware.Chain(
		equipmentLogHandler.GetByProject,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/equipment-logs", middleware.Chain(
		equipmentLogHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/equipment-logs/{id}", middleware.Chain(
		equipmentLogHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/equipment-logs/{id}", middleware.Chain(
		equipmentLogHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/equipment-logs/{id}", middleware.Chain(
		equipmentLogHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: REPORTS ====================
	mux.HandleFunc("GET /api/site-projects/{projectId}/dashboard", middleware.Chain(
		siteReportHandler.GetDashboard,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/site-projects/{projectId}/financial-summary", middleware.Chain(
		siteReportHandler.GetFinancialSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/site-projects/{projectId}/progress-report", middleware.Chain(
		siteReportHandler.GetProgressReport,
		middleware.Authenticate(db),
	))

	// ==================== SITE: MATERIAL RECEIPTS & STOCK REGISTER ====================
	mux.HandleFunc("GET /api/site-projects/{projectId}/material-receipts", middleware.Chain(
		materialReceiptHandler.GetByProject,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/site-projects/{projectId}/stock-register", middleware.Chain(
		materialReceiptHandler.GetStockRegister,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/material-receipts", middleware.Chain(
		materialReceiptHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/material-receipts/{id}", middleware.Chain(
		materialReceiptHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/material-receipts/{id}", middleware.Chain(
		materialReceiptHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/material-receipts/{id}", middleware.Chain(
		materialReceiptHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: WORK ORDERS ====================
	mux.HandleFunc("GET /api/work-orders", middleware.Chain(
		workOrderHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/work-orders/{id}", middleware.Chain(
		workOrderHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/work-orders", middleware.Chain(
		workOrderHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/work-orders/{id}", middleware.Chain(
		workOrderHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/work-orders/{id}/status", middleware.Chain(
		workOrderHandler.UpdateStatus,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/work-orders/{id}", middleware.Chain(
		workOrderHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== SITE: WORK BILLS ====================
	mux.HandleFunc("GET /api/work-bills", middleware.Chain(
		workBillHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/work-bills/{id}", middleware.Chain(
		workBillHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/work-bills", middleware.Chain(
		workBillHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/work-bills/{id}", middleware.Chain(
		workBillHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/work-bills/{id}/status", middleware.Chain(
		workBillHandler.UpdateStatus,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/work-bills/{id}/payments", middleware.Chain(
		workBillHandler.AddPayment,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/work-bills/{id}", middleware.Chain(
		workBillHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== PURCHASE ORDERS ====================
	mux.HandleFunc("GET /api/purchase-orders", middleware.Chain(
		purchaseOrderHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/purchase-orders/direct", middleware.Chain(
		purchaseOrderHandler.CreateDirect,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/purchase-orders/direct/{id}", middleware.Chain(
		purchaseOrderHandler.UpdateDirect,
		middleware.Authenticate(db)))
	mux.HandleFunc("GET /api/purchase-orders/{poNumber}", middleware.Chain(
		purchaseOrderHandler.GetByPONumber,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/purchase-orders", middleware.Chain(
		purchaseOrderHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/purchase-orders/{id}", middleware.Chain(
		purchaseOrderHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PATCH /api/purchase-orders/{id}/status", middleware.Chain(
		purchaseOrderHandler.UpdateStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/purchase-orders/{id}", middleware.Chain(
		purchaseOrderHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== PURCHASE BILLS ====================
	mux.HandleFunc("GET /api/purchase-bills", middleware.Chain(
		purchaseBillHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/purchase-bills/summary", middleware.Chain(
		purchaseBillHandler.GetSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/purchase-bills/{id}", middleware.Chain(
		purchaseBillHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/purchase-bills", middleware.Chain(
		purchaseBillHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/purchase-bills/from-po", middleware.Chain(
		purchaseBillHandler.CreateFromPO,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/purchase-bills/{id}/payment", middleware.Chain(
		purchaseBillHandler.RecordPayment,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("DELETE /api/purchase-bills/{id}", middleware.Chain(
		purchaseBillHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== PURCHASE RETURNS ====================
	mux.HandleFunc("GET /api/sale-returns", middleware.Chain(
		saleReturnHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/sale-returns", middleware.Chain(
		saleReturnHandler.Create,
		middleware.Authenticate(db),
	))

	mux.HandleFunc("GET /api/purchase-returns", middleware.Chain(
		purchaseReturnHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/purchase-returns/{id}", middleware.Chain(
		purchaseReturnHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/purchase-returns", middleware.Chain(
		purchaseReturnHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))

	// ==================== BULK PURCHASES ====================
	mux.HandleFunc("POST /api/bulk-purchases", middleware.Chain(
		bulkPurchaseHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/bulk-purchases/stats", middleware.Chain(
		bulkPurchaseHandler.GetStats,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/bulk-purchases/product", middleware.Chain(
		bulkPurchaseHandler.GetByProduct,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/bulk-purchases", middleware.Chain(
		bulkPurchaseHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/bulk-purchases/{id}/conversion-status", middleware.Chain(
		bulkPurchaseHandler.UpdateConversionStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/bulk-purchases/{id}/convert", middleware.Chain(
		bulkPurchaseHandler.Convert,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/bulk-purchases/{id}/conversions", middleware.Chain(
		bulkPurchaseHandler.GetConversions,
		middleware.Authenticate(db),
	))

	// ==================== EXPENSES ====================
	mux.HandleFunc("GET /api/expenses/stats", middleware.Chain(
		expenseHandler.GetStats,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/expenses/export/csv", middleware.Chain(
		expenseHandler.ExportCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/expenses/generate-recurring", middleware.Chain(
		expenseHandler.GenerateRecurring,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/expenses", middleware.Chain(
		expenseHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/expenses", middleware.Chain(
		expenseHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/expenses/{id}", middleware.Chain(
		expenseHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PATCH /api/expenses/{id}/status", middleware.Chain(
		expenseHandler.UpdateStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/expenses/{id}", middleware.Chain(
		expenseHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/expense-categories", middleware.Chain(
		expenseCategoryHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/expense-categories", middleware.Chain(
		expenseCategoryHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/expense-categories/{id}", middleware.Chain(
		expenseCategoryHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/expense-categories/{id}", middleware.Chain(
		expenseCategoryHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== INCENTIVES & LOYALTY ====================
	mux.HandleFunc("GET /api/incentives/rules", middleware.Chain(
		incentiveHandler.GetRules,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/incentives/payouts", middleware.Chain(
		incentiveHandler.GetPayouts,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/incentives/leaderboard", middleware.Chain(
		incentiveHandler.GetLeaderboard,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/incentives/recalculate", middleware.Chain(
		incentiveHandler.Recalculate,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("POST /api/incentives", middleware.Chain(
		incentiveHandler.CreateRule,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/incentives/{id}", middleware.Chain(
		incentiveHandler.UpdateRule,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/incentives/{id}", middleware.Chain(
		incentiveHandler.DeleteRule,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== SALES ORDERS ====================
	mux.HandleFunc("GET /api/sales-orders", middleware.Chain(
		salesOrderHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/sales-orders/{id}", middleware.Chain(
		salesOrderHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/sales-orders", middleware.Chain(
		salesOrderHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/sales-orders/{id}", middleware.Chain(
		salesOrderHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PATCH /api/sales-orders/{id}/confirm", middleware.Chain(
		salesOrderHandler.Confirm,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("POST /api/sales-orders/{id}/convert-all", middleware.Chain(
		salesOrderHandler.ConvertAllToPOs,
		middleware.Authenticate(db),
		middleware.RequireRoleOrPermission("CONVERT_SO_TO_PO", "SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("POST /api/sales-orders/items/{itemId}/convert", middleware.Chain(
		salesOrderHandler.ConvertItemToPO,
		middleware.Authenticate(db),
		middleware.RequireRoleOrPermission("CONVERT_SO_TO_PO", "SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("POST /api/sales-orders/{id}/payments", middleware.Chain(
		salesOrderHandler.RecordPayment,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"),
	))
	mux.HandleFunc("GET /api/sales-orders/{id}/payments", middleware.Chain(
		salesOrderHandler.GetPaymentsForOrder,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/sales-order-payments", middleware.Chain(
		salesOrderHandler.GetAllPayments,
		middleware.Authenticate(db),
	))

	// ==================== ACTIVITY LOGS ====================
	mux.HandleFunc("GET /api/activity-logs", middleware.Chain(
		activityLogHandler.GetAll,
		middleware.Authenticate(db),
	))

	// ==================== ROLES (alias for custom-roles) ====================
	mux.HandleFunc("GET /api/roles", middleware.Chain(
		customRoleHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/roles/{id}", middleware.Chain(
		customRoleHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/roles", middleware.Chain(
		customRoleHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/roles/{id}", middleware.Chain(
		customRoleHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/roles/{id}", middleware.Chain(
		customRoleHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN"),
	))

	// ==================== CUSTOM ROLES ====================
	mux.HandleFunc("GET /api/custom-roles", middleware.Chain(
		customRoleHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/custom-roles/{id}", middleware.Chain(
		customRoleHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/custom-roles", middleware.Chain(
		customRoleHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/custom-roles/{id}", middleware.Chain(
		customRoleHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/custom-roles/{id}", middleware.Chain(
		customRoleHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN"),
	))

	// ==================== INTEGRATION CONFIG ====================
	mux.HandleFunc("GET /api/integrations/channels", middleware.Chain(
		integrationHandler.GetChannels,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/integrations/channels", middleware.Chain(
		integrationHandler.UpdateChannels,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/integrations/templates", middleware.Chain(
		integrationHandler.GetTemplates,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/integrations/templates", middleware.Chain(
		integrationHandler.UpdateTemplates,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/integrations/test", middleware.Chain(
		integrationHandler.TestChannel,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/integrations/send/invoice-email", middleware.Chain(
		integrationHandler.SendInvoiceEmail,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("POST /api/integrations/send/quotation-email", middleware.Chain(
		integrationHandler.SendQuotationEmail,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))

	// ==================== REPORTS ====================
	mux.HandleFunc("GET /api/reports/sales-summary", middleware.Chain(
		reportHandler.SalesSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/top-products", middleware.Chain(
		reportHandler.TopProducts,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/payment-methods", middleware.Chain(
		reportHandler.PaymentMethods,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/daily-trend", middleware.Chain(
		reportHandler.DailyTrend,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/sales-by-category", middleware.Chain(
		reportHandler.SalesByCategory,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/sales-by-product", middleware.Chain(
		reportHandler.SalesByProduct,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/sales-by-customer", middleware.Chain(
		reportHandler.SalesByCustomer,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/sales-csv", middleware.Chain(
		reportHandler.ExportSalesCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/purchase-summary", middleware.Chain(
		reportHandler.PurchaseSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/purchase-by-supplier", middleware.Chain(
		reportHandler.PurchaseBySupplier,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/outstanding-pos", middleware.Chain(
		reportHandler.OutstandingPOs,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/sale-returns", middleware.Chain(
		reportHandler.SaleReturns,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/purchase-returns", middleware.Chain(
		reportHandler.PurchaseReturns,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/outstanding-receivable", middleware.Chain(
		reportHandler.OutstandingReceivable,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/purchase-csv", middleware.Chain(
		reportHandler.ExportPurchaseCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/payment-method-report", middleware.Chain(
		reportHandler.PaymentMethodReport,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/payment-csv", middleware.Chain(
		reportHandler.ExportPaymentCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/debtors-ledger", middleware.Chain(
		reportHandler.DebtorsLedger,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/creditors-ledger", middleware.Chain(
		reportHandler.CreditorsLedger,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/debtors-csv", middleware.Chain(
		reportHandler.ExportDebtorsCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/creditors-csv", middleware.Chain(
		reportHandler.ExportCreditorsCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/ledger", middleware.Chain(
		reportHandler.GetLedger,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/ledger-detail", middleware.Chain(
		reportHandler.GetLedgerDetail,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/tds", middleware.Chain(
		tdsHandler.GetReport,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/tds-inward", middleware.Chain(
		tdsHandler.GetReceivableReport,
		middleware.Authenticate(db),
	))

	// Legacy / alternate route names (kept for compatibility)
	mux.HandleFunc("GET /api/reports/sales-by-payment", middleware.Chain(
		reportHandler.PaymentMethods,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/daily-sales", middleware.Chain(
		reportHandler.DailyTrend,
		middleware.Authenticate(db),
	))

	mux.HandleFunc("GET /api/reports/daybook", middleware.Chain(
		dayBookHandler.GetEntries,
		middleware.Authenticate(db),
	))

	mux.HandleFunc("GET /api/reports/stock-statement", middleware.Chain(
		stockStatementHandler.GetStatement,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION MODULE ====================
	pipeConfigService := service.NewPipeConfigService(db)
	pipeConfigHandler := handler.NewPipeConfigHandler(pipeConfigService)

	costSheetService := service.NewCostSheetService(db)
	productionOrderService := service.NewProductionOrderService(db)
	productionOrderHandler := handler.NewProductionOrderHandler(productionOrderService, costSheetService)

	productionEntryService := service.NewProductionEntryService(db, costSheetService)
	productionEntryHandler := handler.NewProductionEntryHandler(productionEntryService)

	// ==================== PRODUCTION — PIPE CONFIGURATION ====================

	// NOTE: /lookup must be registered before /{id} to avoid route conflict
	mux.HandleFunc("GET /api/production/pipe-configs/lookup", middleware.Chain(
		pipeConfigHandler.Lookup,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/pipe-configs", middleware.Chain(
		pipeConfigHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/production/pipe-configs", middleware.Chain(
		pipeConfigHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/pipe-configs/{id}", middleware.Chain(
		pipeConfigHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/production/pipe-configs/{id}", middleware.Chain(
		pipeConfigHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/production/pipe-configs/{id}/toggle-active", middleware.Chain(
		pipeConfigHandler.ToggleActive,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/production/pipe-configs/{id}/materials", middleware.Chain(
		pipeConfigHandler.UpsertMaterials,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — INTERMEDIATE STOCK ====================
	mux.HandleFunc("GET /api/production/intermediate-stock", middleware.Chain(
		productionOrderHandler.GetIntermediateStock,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — ALL STAGES STOCK ====================
	mux.HandleFunc("GET /api/production/all-stages-stock", middleware.Chain(
		productionOrderHandler.GetAllStagesStock,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — PIPE SUMMARY ====================
	mux.HandleFunc("GET /api/production/pipe-summary", middleware.Chain(
		productionOrderHandler.GetPipeSummary,
		middleware.Authenticate(db),
	))

	mux.HandleFunc("GET /api/production/stage-overview", middleware.Chain(
		productionOrderHandler.GetStageOverview,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — ORDERS ====================
	mux.HandleFunc("GET /api/production/orders", middleware.Chain(
		productionOrderHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/production/orders", middleware.Chain(
		productionOrderHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/orders/summaries", middleware.Chain(
		productionOrderHandler.GetSummaries,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/orders/{id}", middleware.Chain(
		productionOrderHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/production/orders/{id}/status", middleware.Chain(
		productionOrderHandler.UpdateStatus,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/orders/{id}/progress", middleware.Chain(
		productionOrderHandler.GetProgress,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/orders/{id}/cost-sheet", middleware.Chain(
		productionOrderHandler.GetCostSheet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/production/orders/{id}/cost-sheet/compute", middleware.Chain(
		productionOrderHandler.RecomputeCostSheet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/orders/{id}/stage-costs", middleware.Chain(
		productionOrderHandler.GetStageCosts,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — MACHINES ====================
	machineService := service.NewMachineService(db)
	machineHandler := handler.NewMachineHandler(machineService)

	mux.HandleFunc("GET /api/production/machines", middleware.Chain(
		machineHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/production/machines", middleware.Chain(
		machineHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/machines/{id}", middleware.Chain(
		machineHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/production/machines/{id}", middleware.Chain(
		machineHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/production/machines/{id}/toggle-active", middleware.Chain(
		machineHandler.ToggleActive,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — SHIFT TEMPLATES ====================
	shiftTemplateService := service.NewShiftTemplateService(db)
	shiftTemplateHandler := handler.NewShiftTemplateHandler(shiftTemplateService)

	mux.HandleFunc("GET /api/production/shift-templates", middleware.Chain(
		shiftTemplateHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/production/shift-templates", middleware.Chain(
		shiftTemplateHandler.Upsert,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/shift-templates/{id}", middleware.Chain(
		shiftTemplateHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/production/shift-templates/{id}", middleware.Chain(
		shiftTemplateHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — OVERHEAD CONFIGS ====================
	overheadConfigService := service.NewOverheadConfigService(db)
	overheadConfigHandler := handler.NewOverheadConfigHandler(overheadConfigService)

	mux.HandleFunc("GET /api/production/overhead-configs", middleware.Chain(
		overheadConfigHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/production/overhead-configs", middleware.Chain(
		overheadConfigHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/overhead-configs/{id}", middleware.Chain(
		overheadConfigHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/production/overhead-configs/{id}", middleware.Chain(
		overheadConfigHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/production/overhead-configs/{id}/toggle-active", middleware.Chain(
		overheadConfigHandler.ToggleActive,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — REPORTS ====================
	productionReportService := service.NewProductionReportService(db)
	productionReportHandler := handler.NewProductionReportHandler(productionReportService)

	mux.HandleFunc("GET /api/production/reports/stage-summary", middleware.Chain(
		productionReportHandler.StageSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/reports/cost-summary", middleware.Chain(
		productionReportHandler.CostSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/reports/material-consumption", middleware.Chain(
		productionReportHandler.MaterialConsumption,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/reports/machine-utilization", middleware.Chain(
		productionReportHandler.MachineUtilization,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/reports/contractor-costs", middleware.Chain(
		productionReportHandler.ContractorCosts,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/reports/spinning-costs", middleware.Chain(
		productionReportHandler.SpinningCosts,
		middleware.Authenticate(db),
	))

	// ==================== PRODUCTION — ENTRIES ====================
	// NOTE: static sub-paths must be registered before /{id}
	mux.HandleFunc("GET /api/production/entries/by-order/{orderId}", middleware.Chain(
		productionEntryHandler.GetByOrder,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/entries/prior-stage", middleware.Chain(
		productionEntryHandler.GetPriorStageCompleted,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/entries", middleware.Chain(
		productionEntryHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/production/entries", middleware.Chain(
		productionEntryHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/production/entries/{id}", middleware.Chain(
		productionEntryHandler.GetByID,
		middleware.Authenticate(db),
	))

	// ==================== BUSINESS PAGES ====================
	pipePurchaseService := service.NewPipePurchaseService(db)
	businessHandler := handler.NewBusinessHandler(db, cfg.UploadDir, int64(cfg.MaxFileSize), pipePurchaseService)

	// Cement Bags
	mux.HandleFunc("GET /api/business/cement-bags", middleware.Chain(businessHandler.ListCementBags, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/cement-bags", middleware.Chain(businessHandler.CreateCementBag, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/cement-bags/{id}", middleware.Chain(businessHandler.UpdateCementBag, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/cement-bags/{id}", middleware.Chain(businessHandler.DeleteCementBag, middleware.Authenticate(db)))

	// Vehicles
	mux.HandleFunc("GET /api/business/vehicles", middleware.Chain(businessHandler.ListVehicles, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/vehicles", middleware.Chain(businessHandler.CreateVehicle, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/vehicles/{id}", middleware.Chain(businessHandler.UpdateVehicle, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/vehicles/{id}", middleware.Chain(businessHandler.DeleteVehicle, middleware.Authenticate(db)))

	// Maintenance
	mux.HandleFunc("GET /api/business/maintenance", middleware.Chain(businessHandler.ListMaintenance, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/maintenance", middleware.Chain(businessHandler.CreateMaintenance, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/maintenance/{id}", middleware.Chain(businessHandler.UpdateMaintenance, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/maintenance/{id}", middleware.Chain(businessHandler.DeleteMaintenance, middleware.Authenticate(db)))

	// Silo Fills (cement refill events) + summary
	mux.HandleFunc("GET /api/business/silo-fills", middleware.Chain(businessHandler.ListSiloFills, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/silo-fills", middleware.Chain(businessHandler.CreateSiloFill, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/silo-fills/{id}", middleware.Chain(businessHandler.DeleteSiloFill, middleware.Authenticate(db)))
	mux.HandleFunc("GET /api/business/silo-summary", middleware.Chain(businessHandler.GetSiloSummary, middleware.Authenticate(db)))

	// Silos (legacy)
	mux.HandleFunc("GET /api/business/silos", middleware.Chain(businessHandler.ListSilos, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/silos", middleware.Chain(businessHandler.CreateSilo, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/silos/{id}", middleware.Chain(businessHandler.UpdateSilo, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/silos/{id}", middleware.Chain(businessHandler.DeleteSilo, middleware.Authenticate(db)))

	// Silo Extractions
	mux.HandleFunc("GET /api/business/silo-extractions", middleware.Chain(businessHandler.ListSiloExtractions, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/silo-extractions", middleware.Chain(businessHandler.CreateSiloExtraction, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/silo-extractions/{id}", middleware.Chain(businessHandler.UpdateSiloExtraction, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/silo-extractions/{id}", middleware.Chain(businessHandler.DeleteSiloExtraction, middleware.Authenticate(db)))

	// Diesel Maintenance
	mux.HandleFunc("GET /api/business/diesel-maintenance", middleware.Chain(businessHandler.ListDieselMaintenance, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/diesel-maintenance", middleware.Chain(businessHandler.CreateDieselMaintenance, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/diesel-maintenance/{id}", middleware.Chain(businessHandler.UpdateDieselMaintenance, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/diesel-maintenance/{id}", middleware.Chain(businessHandler.DeleteDieselMaintenance, middleware.Authenticate(db)))

	// Extra Fabrication Charges
	mux.HandleFunc("GET /api/business/extra-fab", middleware.Chain(businessHandler.ListExtraFab, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/extra-fab", middleware.Chain(businessHandler.CreateExtraFab, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/extra-fab/{id}", middleware.Chain(businessHandler.UpdateExtraFab, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/extra-fab/{id}", middleware.Chain(businessHandler.DeleteExtraFab, middleware.Authenticate(db)))

	// Store Room Materials
	mux.HandleFunc("GET /api/business/store-room-materials", middleware.Chain(businessHandler.ListStoreRoomMaterials, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/store-room-materials", middleware.Chain(businessHandler.CreateStoreRoomMaterial, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/store-room-materials/{id}", middleware.Chain(businessHandler.UpdateStoreRoomMaterial, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/store-room-materials/{id}", middleware.Chain(businessHandler.DeleteStoreRoomMaterial, middleware.Authenticate(db)))

	// Extra Vehicles
	mux.HandleFunc("GET /api/business/extra-vehicles", middleware.Chain(businessHandler.ListExtraVehicles, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/extra-vehicles", middleware.Chain(businessHandler.CreateExtraVehicle, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/extra-vehicles/{id}", middleware.Chain(businessHandler.UpdateExtraVehicle, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/extra-vehicles/{id}", middleware.Chain(businessHandler.DeleteExtraVehicle, middleware.Authenticate(db)))

	// Testing Lab
	mux.HandleFunc("GET /api/business/testing-labs", middleware.Chain(businessHandler.ListTestingLabs, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/testing-labs", middleware.Chain(businessHandler.CreateTestingLab, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/testing-labs/{id}", middleware.Chain(businessHandler.UpdateTestingLab, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/testing-labs/{id}", middleware.Chain(businessHandler.DeleteTestingLab, middleware.Authenticate(db)))

	// Conversions
	mux.HandleFunc("GET /api/business/conversions", middleware.Chain(businessHandler.ListConversions, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/conversions", middleware.Chain(businessHandler.CreateConversion, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/conversions/{id}", middleware.Chain(businessHandler.UpdateConversion, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/conversions/{id}", middleware.Chain(businessHandler.DeleteConversion, middleware.Authenticate(db)))

	// Cuttings
	mux.HandleFunc("GET /api/business/cuttings", middleware.Chain(businessHandler.ListCuttings, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/cuttings", middleware.Chain(businessHandler.CreateCutting, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/cuttings/{id}", middleware.Chain(businessHandler.UpdateCutting, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/cuttings/{id}", middleware.Chain(businessHandler.DeleteCutting, middleware.Authenticate(db)))

	// Discards
	mux.HandleFunc("GET /api/business/discards", middleware.Chain(businessHandler.ListDiscards, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/discards", middleware.Chain(businessHandler.CreateDiscard, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/discards/{id}", middleware.Chain(businessHandler.UpdateDiscard, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/discards/{id}", middleware.Chain(businessHandler.DeleteDiscard, middleware.Authenticate(db)))

	// PDI
	mux.HandleFunc("GET /api/business/pdis", middleware.Chain(businessHandler.ListPDIs, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/pdis", middleware.Chain(businessHandler.CreatePDI, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/pdis/{id}", middleware.Chain(businessHandler.UpdatePDI, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/pdis/{id}", middleware.Chain(businessHandler.DeletePDI, middleware.Authenticate(db)))

	// Loading Records
	mux.HandleFunc("GET /api/business/loading-records", middleware.Chain(businessHandler.ListLoadingRecords, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/loading-records", middleware.Chain(businessHandler.CreateLoadingRecord, middleware.Authenticate(db)))
	mux.HandleFunc("GET /api/business/loading-records/{id}", middleware.Chain(businessHandler.GetLoadingRecord, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/loading-records/{id}", middleware.Chain(businessHandler.UpdateLoadingRecord, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/loading-records/{id}", middleware.Chain(businessHandler.DeleteLoadingRecord, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/loading-records/{id}/challan-photo", middleware.Chain(businessHandler.UploadChallanPhoto, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/loading-records/{id}/challan-photo", middleware.Chain(businessHandler.DeleteChallanPhoto, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/loading-records/{id}/convert-to-invoice", middleware.Chain(businessHandler.ConvertToInvoice, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/loading-records/{id}/link-invoice", middleware.Chain(businessHandler.LinkInvoice, middleware.Authenticate(db)))

	// Labour
	mux.HandleFunc("GET /api/business/labour", middleware.Chain(businessHandler.ListLabour, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/labour", middleware.Chain(businessHandler.CreateLabour, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/labour/{id}", middleware.Chain(businessHandler.UpdateLabour, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/labour/{id}", middleware.Chain(businessHandler.DeleteLabour, middleware.Authenticate(db)))

	// Third-Party Pipe Purchases
	mux.HandleFunc("GET /api/business/pipe-purchases", middleware.Chain(businessHandler.ListPipePurchases, middleware.Authenticate(db)))
	mux.HandleFunc("POST /api/business/pipe-purchases", middleware.Chain(businessHandler.CreatePipePurchase, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/pipe-purchases/{id}", middleware.Chain(businessHandler.UpdatePipePurchase, middleware.Authenticate(db)))
	mux.HandleFunc("DELETE /api/business/pipe-purchases/{id}", middleware.Chain(businessHandler.DeletePipePurchase, middleware.Authenticate(db)))

	// Business rate config (singleton)
	mux.HandleFunc("GET /api/business/rate-config", middleware.Chain(businessHandler.GetBusinessRateConfig, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/rate-config", middleware.Chain(businessHandler.UpdateBusinessRateConfig, middleware.Authenticate(db)))
	mux.HandleFunc("GET /api/business/coating-rates", middleware.Chain(businessHandler.GetCoatingRates, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/coating-rates", middleware.Chain(businessHandler.UpsertCoatingRates, middleware.Authenticate(db)))
	mux.HandleFunc("GET /api/business/spinning-rates", middleware.Chain(businessHandler.GetSpinningRates, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/spinning-rates", middleware.Chain(businessHandler.UpsertSpinningRates, middleware.Authenticate(db)))
	mux.HandleFunc("GET /api/business/process-contractors", middleware.Chain(businessHandler.GetProcessContractors, middleware.Authenticate(db)))
	mux.HandleFunc("PUT /api/business/process-contractors", middleware.Chain(businessHandler.UpsertProcessContractor, middleware.Authenticate(db)))

	// ==================== USER PREFERENCES ====================
	mux.HandleFunc("GET /api/users/preferences", middleware.Chain(
		userPreferenceHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/users/preferences/{key}", middleware.Chain(
		userPreferenceHandler.Set,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/users/preferences/{key}", middleware.Chain(
		userPreferenceHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== VENDOR PAYMENTS ====================
	mux.HandleFunc("GET /api/tds/sections", middleware.Chain(
		tdsHandler.GetSections,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/tds/sections", middleware.Chain(
		tdsHandler.CreateSection,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/tds/sections/{id}", middleware.Chain(
		tdsHandler.UpdateSection,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/tds/sections/{id}", middleware.Chain(
		tdsHandler.DeleteSection,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/tds/receivables", middleware.Chain(
		tdsHandler.ListReceivables,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/tds/receivables", middleware.Chain(
		tdsHandler.CreateReceivable,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/tds/receivables/{id}", middleware.Chain(
		tdsHandler.UpdateReceivable,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/tds/receivables/{id}", middleware.Chain(
		tdsHandler.DeleteReceivable,
		middleware.Authenticate(db),
	))

	mux.HandleFunc("GET /api/vendor-payments", middleware.Chain(
		vendorPaymentHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/vendor-payments", middleware.Chain(
		vendorPaymentHandler.Create,
		middleware.Authenticate(db),
	))

	// ==================== VENDOR CREDITS ====================
	mux.HandleFunc("GET /api/vendor-credits", middleware.Chain(
		vendorCreditHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/vendor-credits", middleware.Chain(
		vendorCreditHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/vendor-credits/{id}/apply", middleware.Chain(
		vendorCreditHandler.Apply,
		middleware.Authenticate(db),
	))

	// ==================== CART HOLDS ====================
	mux.HandleFunc("GET /api/cart-holds", middleware.Chain(
		cartHoldHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/cart-holds", middleware.Chain(
		cartHoldHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("DELETE /api/cart-holds/{id}", middleware.Chain(
		cartHoldHandler.Delete,
		middleware.Authenticate(db),
	))

	// ==================== FILE UPLOADS ====================
	if _, err := os.Stat(cfg.UploadDir); !os.IsNotExist(err) {
		mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir))))
	}

	// ==================== APPLY MIDDLEWARE ====================
	var handler http.Handler = mux

	// Apply middleware in reverse order (applied bottom-to-top)
	handler = middleware.ActivityLog(db)(handler)
	handler = middleware.Logging()(handler)
	handler = middleware.Security()(handler)
	handler = middleware.CORS(cfg.FrontendUrl)(handler)
	handler = middleware.Recovery()(handler)

	return handler
}

// handleNotImplemented returns a 501 Not Implemented response
func handleNotImplemented(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)

	response := map[string]interface{}{
		"success": false,
		"message": "Endpoint not yet implemented",
		"path":    r.URL.Path,
		"method":  r.Method,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		slog.Error("[Router] Failed to encode response", "error", err)
	}
}
