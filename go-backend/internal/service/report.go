package service

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/shopspring/decimal"
	excelize "github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

type ReportService struct {
	db *gorm.DB
}

func NewReportService(db *gorm.DB) *ReportService {
	return &ReportService{db: db}
}

// ─── Sales Reports ────────────────────────────────────────────────────────

type SalesSummaryResponse struct {
	TotalRevenue     decimal.Decimal `json:"totalRevenue"`
	TotalDiscount    decimal.Decimal `json:"totalDiscount"`
	TotalTax         decimal.Decimal `json:"totalTax"`
	GrossProfit      decimal.Decimal `json:"grossProfit"`
	TotalOrders      int             `json:"totalOrders"`
	AvgOrderValue    decimal.Decimal `json:"avgOrderValue"`
	CancelledOrders  int             `json:"cancelledOrders"`
	ReturnedOrders   int             `json:"returnedOrders"`
}

func (rs *ReportService) SalesSummary(outletId int, from, to time.Time) (SalesSummaryResponse, error) {
	var res SalesSummaryResponse

	activeStatuses := []string{"DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"}
	var invoices []models.Invoice
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND issue_date >= ? AND issue_date <= ?",
		outletId, activeStatuses, from.Format("2006-01-02"), to.Format("2006-01-02")).
		Find(&invoices).Error; err != nil {
		return res, err
	}

	totalRevenue := decimal.Zero
	totalDiscount := decimal.Zero
	totalTax := decimal.Zero
	cancelledCount := 0

	for _, inv := range invoices {
		totalRevenue = totalRevenue.Add(inv.TotalAmount)
		totalDiscount = totalDiscount.Add(inv.DiscountAmount).Add(inv.BillDiscountAmt)
		totalTax = totalTax.Add(inv.TaxAmount)
	}

	var cancelledInvoices []models.Invoice
	rs.db.Where("outlet_id = ? AND status = ? AND issue_date >= ? AND issue_date <= ?",
		outletId, "CANCELLED", from.Format("2006-01-02"), to.Format("2006-01-02")).
		Find(&cancelledInvoices)
	cancelledCount = len(cancelledInvoices)

	res.TotalRevenue = totalRevenue
	res.TotalDiscount = totalDiscount
	res.TotalTax = totalTax
	res.GrossProfit = totalRevenue.Sub(totalDiscount)
	res.TotalOrders = len(invoices)
	res.CancelledOrders = cancelledCount
	res.ReturnedOrders = 0

	if res.TotalOrders > 0 {
		res.AvgOrderValue = totalRevenue.Div(decimal.NewFromInt(int64(res.TotalOrders))).Round(2)
	}

	return res, nil
}

type TopProduct struct {
	ProductID     int             `json:"productId"`
	ProductName   string          `json:"productName"`
	TotalQuantity decimal.Decimal `json:"totalQuantity"`
	TotalRevenue  decimal.Decimal `json:"totalRevenue"`
}

func (rs *ReportService) TopProducts(outletId int, from, to time.Time, limit int) ([]TopProduct, error) {
	activeStatuses := []string{"DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"}
	var invoices []models.Invoice
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND issue_date >= ? AND issue_date <= ?",
		outletId, activeStatuses, from.Format("2006-01-02"), to.Format("2006-01-02")).
		Preload("Items").Find(&invoices).Error; err != nil {
		return nil, err
	}

	productMap := make(map[string]*TopProduct)
	for _, inv := range invoices {
		for _, item := range inv.Items {
			key := item.ProductName
			if key == "" {
				key = "Unknown"
			}
			if _, exists := productMap[key]; !exists {
				pid := 0
				if item.ProductID != nil {
					pid = *item.ProductID
				}
				productMap[key] = &TopProduct{
					ProductID:     pid,
					ProductName:   key,
					TotalQuantity: decimal.Zero,
					TotalRevenue:  decimal.Zero,
				}
			}
			productMap[key].TotalQuantity = productMap[key].TotalQuantity.Add(item.Quantity)
			productMap[key].TotalRevenue = productMap[key].TotalRevenue.Add(item.LineTotal)
		}
	}

	result := make([]TopProduct, 0, len(productMap))
	for _, p := range productMap {
		result = append(result, *p)
	}

	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalRevenue.GreaterThan(result[i].TotalRevenue) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}

	return result, nil
}

type PaymentMethodBreakdown struct {
	Method string          `json:"method"`
	Amount decimal.Decimal `json:"amount"`
}

func (rs *ReportService) PaymentMethods(outletId int, from, to time.Time) ([]PaymentMethodBreakdown, error) {
	// B2B invoices use credit terms; no per-invoice payment method tracking.
	return []PaymentMethodBreakdown{}, nil
}

type DailySalesTrend struct {
	Date    string          `json:"date"`
	Revenue decimal.Decimal `json:"revenue"`
}

func (rs *ReportService) DailyTrend(outletId int, from, to time.Time) ([]DailySalesTrend, error) {
	activeStatuses := []string{"DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"}
	var invoices []models.Invoice
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND issue_date >= ? AND issue_date <= ?",
		outletId, activeStatuses, from.Format("2006-01-02"), to.Format("2006-01-02")).
		Find(&invoices).Error; err != nil {
		return nil, err
	}

	dailySales := make(map[string]decimal.Decimal)
	for _, inv := range invoices {
		date := inv.IssueDate.Format("2006-01-02")
		dailySales[date] = dailySales[date].Add(inv.TotalAmount)
	}

	result := make([]DailySalesTrend, 0, len(dailySales))
	for date, revenue := range dailySales {
		result = append(result, DailySalesTrend{date, revenue})
	}

	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Date < result[i].Date {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

type CategorySalesReport struct {
	Category       string          `json:"category"`
	TotalQuantity  decimal.Decimal `json:"totalQuantity"`
	TotalRevenue   decimal.Decimal `json:"totalRevenue"`
	TotalDiscount  decimal.Decimal `json:"totalDiscount"`
}

func (rs *ReportService) SalesByCategory(outletId int, from, to time.Time) ([]CategorySalesReport, error) {
	activeStatuses := []string{"DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"}
	var invoices []models.Invoice
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND issue_date >= ? AND issue_date <= ?",
		outletId, activeStatuses, from.Format("2006-01-02"), to.Format("2006-01-02")).
		Preload("Items.Product.Category").Find(&invoices).Error; err != nil {
		return nil, err
	}

	catMap := make(map[string]*CategorySalesReport)
	for _, inv := range invoices {
		for _, item := range inv.Items {
			catName := "Uncategorised"
			if item.Product != nil && item.Product.Category != nil {
				catName = item.Product.Category.Name
			}

			if _, exists := catMap[catName]; !exists {
				catMap[catName] = &CategorySalesReport{
					Category:      catName,
					TotalQuantity: decimal.Zero,
					TotalRevenue:  decimal.Zero,
					TotalDiscount: decimal.Zero,
				}
			}
			gross := item.UnitPrice.Mul(item.Quantity)
			discount := gross.Mul(item.DiscountPercent).Div(decimal.NewFromInt(100))
			catMap[catName].TotalQuantity = catMap[catName].TotalQuantity.Add(item.Quantity)
			catMap[catName].TotalRevenue = catMap[catName].TotalRevenue.Add(item.LineTotal)
			catMap[catName].TotalDiscount = catMap[catName].TotalDiscount.Add(discount)
		}
	}

	result := make([]CategorySalesReport, 0, len(catMap))
	for _, cat := range catMap {
		result = append(result, *cat)
	}

	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalRevenue.GreaterThan(result[i].TotalRevenue) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

type ProductSalesReport struct {
	ProductID    int             `json:"productId"`
	ProductName  string          `json:"productName"`
	SKU          string          `json:"sku"`
	Category     string          `json:"category"`
	TotalQuantity decimal.Decimal `json:"totalQuantity"`
	TotalRevenue decimal.Decimal `json:"totalRevenue"`
	TotalDiscount decimal.Decimal `json:"totalDiscount"`
	TotalCost    decimal.Decimal `json:"totalCost"`
	TotalTax     decimal.Decimal `json:"totalTax"`
}

func (rs *ReportService) SalesByProduct(outletId int, from, to time.Time, page, size int) ([]ProductSalesReport, error) {
	activeStatuses := []string{"DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"}
	var invoices []models.Invoice
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND issue_date >= ? AND issue_date <= ?",
		outletId, activeStatuses, from.Format("2006-01-02"), to.Format("2006-01-02")).
		Preload("Items.Product.Category").Find(&invoices).Error; err != nil {
		return nil, err
	}

	prodMap := make(map[string]*ProductSalesReport)
	for _, inv := range invoices {
		for _, item := range inv.Items {
			key := item.ProductName
			if key == "" {
				key = "Unknown"
			}
			if _, exists := prodMap[key]; !exists {
				catName := "Uncategorised"
				if item.Product != nil && item.Product.Category != nil {
					catName = item.Product.Category.Name
				}
				pid := 0
				if item.ProductID != nil {
					pid = *item.ProductID
				}
				prodMap[key] = &ProductSalesReport{
					ProductID:     pid,
					ProductName:   key,
					SKU:           derefStr(item.ProductSKU),
					Category:      catName,
					TotalQuantity: decimal.Zero,
					TotalRevenue:  decimal.Zero,
					TotalDiscount: decimal.Zero,
					TotalCost:     decimal.Zero,
					TotalTax:      decimal.Zero,
				}
			}
			gross := item.UnitPrice.Mul(item.Quantity)
			discount := gross.Mul(item.DiscountPercent).Div(decimal.NewFromInt(100))
			tax := item.LineTotal.Mul(item.TaxRate).Div(decimal.NewFromInt(100))
			prodMap[key].TotalQuantity = prodMap[key].TotalQuantity.Add(item.Quantity)
			prodMap[key].TotalRevenue = prodMap[key].TotalRevenue.Add(item.LineTotal)
			prodMap[key].TotalDiscount = prodMap[key].TotalDiscount.Add(discount)
			prodMap[key].TotalTax = prodMap[key].TotalTax.Add(tax)
		}
	}

	result := make([]ProductSalesReport, 0, len(prodMap))
	for _, prod := range prodMap {
		result = append(result, *prod)
	}

	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalRevenue.GreaterThan(result[i].TotalRevenue) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

type CustomerSalesReport struct {
	CustomerID    int             `json:"customerId"`
	CustomerName  string          `json:"customerName"`
	Phone         string          `json:"phone"`
	OrderCount    int             `json:"orderCount"`
	TotalSpend    float64         `json:"totalSpend"`
	TotalDiscount float64         `json:"totalDiscount"`
	AvgOrderValue float64         `json:"avgOrderValue"`
}

func (rs *ReportService) SalesByCustomer(outletId int, from, to time.Time, page, size int) ([]CustomerSalesReport, error) {
	activeStatuses := []string{"DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"}
	var invoices []models.Invoice
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND issue_date >= ? AND issue_date <= ?",
		outletId, activeStatuses, from.Format("2006-01-02"), to.Format("2006-01-02")).
		Preload("Customer").Find(&invoices).Error; err != nil {
		return nil, err
	}

	custMap := make(map[int]*CustomerSalesReport)
	for _, inv := range invoices {
		if inv.CustomerID == nil || inv.Customer == nil {
			continue
		}

		key := *inv.CustomerID
		if _, exists := custMap[key]; !exists {
			phone := ""
			if inv.Customer.Phone != nil {
				phone = *inv.Customer.Phone
			}
			custMap[key] = &CustomerSalesReport{
				CustomerID:    key,
				CustomerName:  inv.Customer.Name,
				Phone:         phone,
				OrderCount:    0,
				TotalSpend:    0,
				TotalDiscount: 0,
				AvgOrderValue: 0,
			}
		}
		custMap[key].OrderCount++
		custMap[key].TotalSpend += inv.TotalAmount.InexactFloat64()
		custMap[key].TotalDiscount += inv.DiscountAmount.Add(inv.BillDiscountAmt).InexactFloat64()
	}

	result := make([]CustomerSalesReport, 0, len(custMap))
	for _, cust := range custMap {
		if cust.OrderCount > 0 {
			cust.AvgOrderValue = cust.TotalSpend / float64(cust.OrderCount)
		}
		result = append(result, *cust)
	}

	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalSpend > result[i].TotalSpend {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

func (rs *ReportService) ExportSalesCSV(outletId int, from, to time.Time) (string, error) {
	activeStatuses := []string{"DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"}
	var invoices []models.Invoice
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND issue_date >= ? AND issue_date <= ?",
		outletId, activeStatuses, from.Format("2006-01-02"), to.Format("2006-01-02")).
		Preload("Items").
		Preload("Customer").Find(&invoices).Error; err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Date,Invoice Number,Customer,Status,Items,Subtotal,Discount,Tax,Total,Paid\n")

	for _, inv := range invoices {
		customer := ""
		if inv.Customer != nil {
			customer = inv.Customer.Name
		}

		sb.WriteString(fmt.Sprintf("%s,%s,\"%s\",%s,%d,%s,%s,%s,%s,%s\n",
			inv.IssueDate.Format("2006-01-02"),
			inv.InvoiceNumber,
			customer,
			string(inv.Status),
			len(inv.Items),
			inv.Subtotal.String(),
			inv.DiscountAmount.Add(inv.BillDiscountAmt).String(),
			inv.TaxAmount.String(),
			inv.TotalAmount.String(),
			inv.PaidAmount.String(),
		))
	}

	return sb.String(), nil
}

// ─── Purchase Reports ─────────────────────────────────────────────────────

type PurchaseSummaryResponse struct {
	TotalOrders      int             `json:"totalOrders"`
	TotalValue       decimal.Decimal `json:"totalValue"`
	Received         int             `json:"received"`
	Pending          int             `json:"pending"`
	Cancelled        int             `json:"cancelled"`
	UniqueSuppliers  int             `json:"uniqueSuppliers"`
	AvgPOValue       decimal.Decimal `json:"avgPoValue"`
	Outstanding      decimal.Decimal `json:"outstanding"`
}

func (rs *ReportService) PurchaseSummary(outletId int, from, to time.Time) (PurchaseSummaryResponse, error) {
	var res PurchaseSummaryResponse
	var pos []models.PurchaseOrder

	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Find(&pos).Error; err != nil {
		return res, err
	}

	res.TotalOrders = len(pos)
	suppliers := make(map[int]bool)
	totalValue := decimal.Zero
	outstanding := decimal.Zero

	for _, po := range pos {
		suppliers[po.SupplierID] = true
		totalValue = totalValue.Add(po.TotalAmount)

		switch po.Status {
		case "RECEIVED":
			res.Received++
		case "SENT", "DRAFT":
			res.Pending++
		case "CANCELLED":
			res.Cancelled++
		}

		if po.Status != "RECEIVED" && po.Status != "CANCELLED" {
			outstanding = outstanding.Add(po.TotalAmount)
		}
	}

	res.UniqueSuppliers = len(suppliers)
	res.TotalValue = totalValue
	res.Outstanding = outstanding

	if res.TotalOrders > 0 {
		res.AvgPOValue = totalValue.Div(decimal.NewFromInt(int64(res.TotalOrders))).Round(2)
	}

	return res, nil
}

type SupplierPurchaseReport struct {
	SupplierName string          `json:"supplierName"`
	Phone        string          `json:"phone"`
	OrderCount   int             `json:"orderCount"`
	Received     int             `json:"received"`
	Pending      int             `json:"pending"`
	TotalValue   decimal.Decimal `json:"totalValue"`
	AvgPOValue   decimal.Decimal `json:"avgPoValue"`
	Outstanding  decimal.Decimal `json:"outstanding"`
}

func (rs *ReportService) PurchaseBySupplier(outletId int, from, to time.Time) ([]SupplierPurchaseReport, error) {
	var pos []models.PurchaseOrder
	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Preload("Supplier").Find(&pos).Error; err != nil {
		return nil, err
	}

	supplierMap := make(map[int]*SupplierPurchaseReport)
	for _, po := range pos {
		key := po.SupplierID
		if _, exists := supplierMap[key]; !exists {
			phone := ""
			if po.Supplier != nil && po.Supplier.Phone != nil {
				phone = *po.Supplier.Phone
			}
			supplierMap[key] = &SupplierPurchaseReport{
				SupplierName: po.Supplier.Name,
				Phone:        phone,
				OrderCount:   0,
				Received:     0,
				Pending:      0,
				TotalValue:   decimal.Zero,
				Outstanding:  decimal.Zero,
			}
		}
		supplierMap[key].OrderCount++
		supplierMap[key].TotalValue = supplierMap[key].TotalValue.Add(po.TotalAmount)

		if po.Status == "RECEIVED" {
			supplierMap[key].Received++
		} else if po.Status != "CANCELLED" {
			supplierMap[key].Pending++
		}
	}

	result := make([]SupplierPurchaseReport, 0, len(supplierMap))
	for _, sup := range supplierMap {
		if sup.OrderCount > 0 {
			sup.AvgPOValue = sup.TotalValue.Div(decimal.NewFromInt(int64(sup.OrderCount))).Round(2)
		}
		result = append(result, *sup)
	}

	// Sort by value descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalValue.GreaterThan(result[i].TotalValue) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

type OutstandingPOReport struct {
	PONumber    string          `json:"poNumber"`
	SupplierName string         `json:"supplierName"`
	SupplierPhone string        `json:"supplierPhone"`
	Status      string          `json:"status"`
	ItemCount   int             `json:"itemCount"`
	OrderDate   string          `json:"orderDate"`
	ExpectedDate *string        `json:"expectedDate"`
	TotalAmount decimal.Decimal `json:"totalAmount"`
}

func (rs *ReportService) OutstandingPOs(outletId int) ([]OutstandingPOReport, error) {
	var pos []models.PurchaseOrder
	statuses := []string{"DRAFT", "SENT", "PARTIAL"}
	if err := rs.db.Where("outlet_id = ? AND status IN ?", outletId, statuses).
		Preload("Supplier").
		Preload("Items").
		Order("created_at DESC").Find(&pos).Error; err != nil {
		return nil, err
	}

	result := make([]OutstandingPOReport, 0, len(pos))
	for _, po := range pos {
		phone := ""
		if po.Supplier != nil && po.Supplier.Phone != nil {
			phone = *po.Supplier.Phone
		}

		expectedDate := (*string)(nil)
		if po.ExpectedDate != nil {
			ed := po.ExpectedDate.Format("2006-01-02")
			expectedDate = &ed
		}

		result = append(result, OutstandingPOReport{
			PONumber:     po.PONumber,
			SupplierName: po.Supplier.Name,
			SupplierPhone: phone,
			Status:       string(po.Status),
			ItemCount:    len(po.Items),
			OrderDate:    po.CreatedAt.Format("2006-01-02"),
			ExpectedDate: expectedDate,
			TotalAmount:  po.TotalAmount,
		})
	}

	return result, nil
}

type SaleReturnReport struct {
	OrderNumber      string          `json:"orderNumber"`
	Date             string          `json:"date"`
	Customer         string          `json:"customer"`
	CustomerPhone    string          `json:"customerPhone"`
	Status           string          `json:"status"`
	ItemCount        int             `json:"itemCount"`
	OriginalAmount   decimal.Decimal `json:"originalAmount"`
	RefundAmount     decimal.Decimal `json:"refundAmount"`
	Notes            string          `json:"notes"`
	RefundMethod     string          `json:"refundMethod"`
}

func (rs *ReportService) SaleReturns(outletId int, from, to time.Time, page, size int) ([]SaleReturnReport, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND order_type = ? AND created_at >= ? AND created_at <= ?",
		outletId, "RETURN", from, to).
		Preload("Items.Product").
		Preload("Customer").
		Preload("Payments").
		Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, err
	}

	result := make([]SaleReturnReport, 0, len(orders))
	for _, o := range orders {
		customer := ""
		customerPhone := ""
		if o.Customer != nil {
			customer = o.Customer.Name
			if o.Customer.Phone != nil {
				customerPhone = *o.Customer.Phone
			}
		}

		refundMethod := ""
		if len(o.Payments) > 0 {
			refundMethod = string(o.Payments[0].PaymentMethod)
		} else if o.Notes != nil {
			refundMethod = *o.Notes
		}

		result = append(result, SaleReturnReport{
			OrderNumber:    o.OrderNumber,
			Date:           o.CreatedAt.Format("2006-01-02"),
			Customer:       customer,
			CustomerPhone:  customerPhone,
			Status:         string(o.Status),
			ItemCount:      len(o.Items),
			OriginalAmount: o.Subtotal,
			RefundAmount:   o.TotalAmount,
			Notes:          derefStr(o.Notes),
			RefundMethod:   refundMethod,
		})
	}

	return result, nil
}

type PurchaseReturnReport struct {
	ID            int    `json:"id"`
	ReferenceNo   string `json:"referenceNo"`
	PONumber      string `json:"poNumber"`
	SupplierName  string `json:"supplierName"`
	Date          string `json:"date"`
	Status        string `json:"status"`
	ItemCount     int    `json:"itemCount"`
	TotalAmount   decimal.Decimal `json:"totalAmount"`
}

func (rs *ReportService) PurchaseReturns(outletId int, from, to time.Time, page, size int) ([]PurchaseReturnReport, error) {
	var returns []models.PurchaseReturn
	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Preload("Items.Product").
		Preload("PurchaseOrder.Supplier").
		Find(&returns).Error; err != nil {
		return nil, err
	}

	result := make([]PurchaseReturnReport, 0, len(returns))
	for _, ret := range returns {
		poNumber := ""
		supplierName := ""
		if ret.PurchaseOrder != nil {
			poNumber = ret.PurchaseOrder.PONumber
			supplierName = ret.PurchaseOrder.Supplier.Name
		}

		result = append(result, PurchaseReturnReport{
			ID:          ret.ID,
			ReferenceNo: ret.ReturnNumber,
			PONumber:    poNumber,
			SupplierName: supplierName,
			Date:        ret.CreatedAt.Format("2006-01-02"),
			Status:      string(ret.Status),
			ItemCount:   len(ret.Items),
			TotalAmount: ret.TotalAmount,
		})
	}

	return result, nil
}

type OutstandingReceivable struct {
	ID                int             `json:"id"`
	Name              string          `json:"name"`
	Phone             *string         `json:"phone"`
	Email             *string         `json:"email"`
	OutstandingDue    decimal.Decimal `json:"outstandingDue"`
}

func (rs *ReportService) OutstandingReceivable(outletId int) ([]OutstandingReceivable, error) {
	type orRow struct {
		ID             int
		Name           string
		Phone          *string
		Email          *string
		OutstandingDue decimal.Decimal
	}
	var rows []orRow
	if err := rs.db.Raw(`
		SELECT c.id, c.name, c.phone, c.email,
		       SUM(i.total_amount - i.paid_amount) AS outstanding_due
		FROM customers c
		JOIN invoices i ON i.customer_id = c.id
		WHERE i.outlet_id = ? AND i.status IN ('SENT', 'PARTIAL', 'OVERDUE')
		GROUP BY c.id, c.name, c.phone, c.email
		HAVING SUM(i.total_amount - i.paid_amount) > 0
		ORDER BY outstanding_due DESC
	`, outletId).Scan(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]OutstandingReceivable, 0, len(rows))
	for _, r := range rows {
		result = append(result, OutstandingReceivable{
			ID:             r.ID,
			Name:           r.Name,
			Phone:          r.Phone,
			Email:          r.Email,
			OutstandingDue: r.OutstandingDue,
		})
	}

	return result, nil
}

func (rs *ReportService) ExportPurchaseCSV(outletId int, from, to time.Time) (string, error) {
	var pos []models.PurchaseOrder
	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Preload("Supplier").Find(&pos).Error; err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Date,PO Number,Supplier,Status,Total Amount\n")

	for _, po := range pos {
		sb.WriteString(fmt.Sprintf("%s,%s,\"%s\",%s,%s\n",
			po.CreatedAt.Format("2006-01-02"),
			po.PONumber,
			po.Supplier.Name,
			po.Status,
			po.TotalAmount.String(),
		))
	}

	return sb.String(), nil
}

// ─── Payment Method Report ────────────────────────────────────────────────

type PaymentSummary struct {
	Method     string          `json:"method"`
	TotalAmount decimal.Decimal `json:"totalAmount"`
	TxCount    int             `json:"txCount"`
	AvgAmount  decimal.Decimal `json:"avgAmount"`
	Share      decimal.Decimal `json:"share"`
}

type PaymentDailyTrend struct {
	Date string                 `json:"date"`
	Data map[string]interface{} `json:"data"`
}

type PaymentTransaction struct {
	ID            int    `json:"id"`
	OrderID       int    `json:"orderId"`
	OrderNumber   string `json:"orderNumber"`
	CustomerName  string `json:"customerName"`
	Method        string `json:"method"`
	Amount        decimal.Decimal `json:"amount"`
	Reference     string `json:"reference"`
	Date          string `json:"date"`
	Time          string `json:"time"`
}

type PaymentMethodReport struct {
	Summary    []PaymentSummary      `json:"summary"`
	DailyTrend []map[string]interface{} `json:"dailyTrend"`
	AllMethods []string              `json:"allMethods"`
	GrandTotal decimal.Decimal       `json:"grandTotal"`
	Transactions []PaymentTransaction `json:"transactions"`
}

func (rs *ReportService) PaymentMethodReport(outletId int, from, to time.Time) (PaymentMethodReport, error) {
	var payments []models.Payment
	if err := rs.db.Joins("JOIN orders ON orders.id = payments.order_id").
		Where("payments.status = ? AND orders.outlet_id = ? AND payments.created_at >= ? AND payments.created_at <= ?",
			"COMPLETED", outletId, from, to).
		Preload("Order.Customer").
		Order("payments.created_at ASC").Find(&payments).Error; err != nil {
		return PaymentMethodReport{}, err
	}

	methodMap := make(map[string]*PaymentSummary)
	dailyMap := make(map[string]map[string]decimal.Decimal)

	for _, p := range payments {
		method := string(p.PaymentMethod)
		if _, exists := methodMap[method]; !exists {
			methodMap[method] = &PaymentSummary{
				Method:      method,
				TotalAmount: decimal.Zero,
				TxCount:     0,
				AvgAmount:   decimal.Zero,
				Share:       decimal.Zero,
			}
		}
		methodMap[method].TotalAmount = methodMap[method].TotalAmount.Add(p.Amount)
		methodMap[method].TxCount++

		date := p.CreatedAt.Format("2006-01-02")
		if _, exists := dailyMap[date]; !exists {
			dailyMap[date] = make(map[string]decimal.Decimal)
		}
		dailyMap[date][method] = dailyMap[date][method].Add(p.Amount)
	}

	grandTotal := decimal.Zero
	for _, m := range methodMap {
		grandTotal = grandTotal.Add(m.TotalAmount)
	}

	summary := make([]PaymentSummary, 0, len(methodMap))
	allMethods := make([]string, 0, len(methodMap))
	for method, m := range methodMap {
		if m.TxCount > 0 {
			m.AvgAmount = m.TotalAmount.Div(decimal.NewFromInt(int64(m.TxCount))).Round(2)
		}
		if grandTotal.GreaterThan(decimal.Zero) {
			m.Share = m.TotalAmount.Div(grandTotal).Mul(decimal.NewFromInt(100)).Round(1)
		}
		summary = append(summary, *m)
		allMethods = append(allMethods, method)
	}

	// Sort summary by total amount descending
	for i := 0; i < len(summary)-1; i++ {
		for j := i + 1; j < len(summary); j++ {
			if summary[j].TotalAmount.GreaterThan(summary[i].TotalAmount) {
				summary[i], summary[j] = summary[j], summary[i]
			}
		}
	}

	dailyTrend := make([]map[string]interface{}, 0, len(dailyMap))
	for date := range dailyMap {
		row := make(map[string]interface{})
		row["date"] = date
		for _, m := range allMethods {
			row[m] = dailyMap[date][m].String()
		}
		dailyTrend = append(dailyTrend, row)
	}

	// Sort daily trend by date
	for i := 0; i < len(dailyTrend)-1; i++ {
		for j := i + 1; j < len(dailyTrend); j++ {
			if dailyTrend[j]["date"].(string) < dailyTrend[i]["date"].(string) {
				dailyTrend[i], dailyTrend[j] = dailyTrend[j], dailyTrend[i]
			}
		}
	}

	transactions := make([]PaymentTransaction, 0, len(payments))
	for i := len(payments) - 1; i >= 0; i-- {
		p := payments[i]
		customerName := ""
		orderNumber := ""
		if p.Order != nil {
			orderNumber = p.Order.OrderNumber
			if p.Order.Customer != nil {
				customerName = p.Order.Customer.Name
			}
		}
		reference := ""
		if p.ReferenceNumber != nil {
			reference = *p.ReferenceNumber
		}

		transactions = append(transactions, PaymentTransaction{
			ID:           p.ID,
			OrderID:      p.OrderID,
			OrderNumber:  orderNumber,
			CustomerName: customerName,
			Method:       string(p.PaymentMethod),
			Amount:       p.Amount,
			Reference:    reference,
			Date:         p.CreatedAt.Format("2006-01-02"),
			Time:         p.CreatedAt.Format("15:04"),
		})
	}

	return PaymentMethodReport{
		Summary:      summary,
		DailyTrend:   dailyTrend,
		AllMethods:   allMethods,
		GrandTotal:   grandTotal,
		Transactions: transactions,
	}, nil
}

func (rs *ReportService) ExportPaymentCSV(outletId int, from, to time.Time) (string, error) {
	report, err := rs.PaymentMethodReport(outletId, from, to)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Date,Time,Order #,Customer,Method,Amount,Reference\n")

	for _, t := range report.Transactions {
		sb.WriteString(fmt.Sprintf("%s,%s,%s,\"%s\",%s,%s,\"%s\"\n",
			t.Date,
			t.Time,
			t.OrderNumber,
			t.CustomerName,
			t.Method,
			t.Amount.String(),
			t.Reference,
		))
	}

	return sb.String(), nil
}

// ─── Debtors & Creditors Ledger ───────────────────────────────────────────

type InvoiceDetail struct {
	InvoiceNumber string          `json:"invoiceNumber"`
	IssueDate     string          `json:"issueDate"`
	DueDate       *string         `json:"dueDate"`
	TotalAmount   decimal.Decimal `json:"totalAmount"`
	PaidAmount    decimal.Decimal `json:"paidAmount"`
	Outstanding   decimal.Decimal `json:"outstanding"`
	Status        string          `json:"status"`
	DaysOverdue   int             `json:"daysOverdue"`
}

type DebtorLedgerRow struct {
	CustomerID   int             `json:"customerId"`
	Name         string          `json:"name"`
	Phone        string          `json:"phone"`
	GSTIN        string          `json:"gstin"`
	TotalInvoiced decimal.Decimal `json:"totalInvoiced"`
	TotalPaid    decimal.Decimal `json:"totalPaid"`
	Outstanding  decimal.Decimal `json:"outstanding"`
	Current      decimal.Decimal `json:"current"`
	Days1_30     decimal.Decimal `json:"days1_30"`
	Days31_60    decimal.Decimal `json:"days31_60"`
	Days61_90    decimal.Decimal `json:"days61_90"`
	Days90Plus   decimal.Decimal `json:"days90plus"`
	Invoices     []InvoiceDetail `json:"invoices"`
}

func (rs *ReportService) DebtorsLedger(outletId int) ([]DebtorLedgerRow, error) {
	var invoices []models.Invoice
	statuses := []string{"DRAFT", "SENT", "PARTIAL", "OVERDUE"}
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND customer_id IS NOT NULL", outletId, statuses).
		Preload("Customer").
		Order("issue_date ASC").Find(&invoices).Error; err != nil {
		return nil, err
	}

	partyMap := make(map[int]*DebtorLedgerRow)
	now := time.Now()

	for _, inv := range invoices {
		if inv.Customer == nil {
			continue
		}

		outstanding := inv.TotalAmount.Sub(inv.PaidAmount)
		if outstanding.LessThanOrEqual(decimal.Zero) {
			continue
		}

		cid := *inv.CustomerID
		if _, exists := partyMap[cid]; !exists {
			gstin := ""
			if inv.Customer.GSTIN != nil {
				gstin = *inv.Customer.GSTIN
			}
			phone := ""
			if inv.Customer.Phone != nil {
				phone = *inv.Customer.Phone
			}
			partyMap[cid] = &DebtorLedgerRow{
				CustomerID:   cid,
				Name:         inv.Customer.Name,
				Phone:        phone,
				GSTIN:        gstin,
				TotalInvoiced: decimal.Zero,
				TotalPaid:    decimal.Zero,
				Outstanding: decimal.Zero,
				Current:     decimal.Zero,
				Days1_30:    decimal.Zero,
				Days31_60:   decimal.Zero,
				Days61_90:   decimal.Zero,
				Days90Plus:  decimal.Zero,
				Invoices:    make([]InvoiceDetail, 0),
			}
		}

		// Calculate age buckets
		ref := inv.DueDate
		if ref == nil {
			tmp := inv.IssueDate.AddDate(0, 0, 30)
			ref = &tmp
		}
		days := int(now.Sub(*ref).Hours() / 24)

		if days <= 0 {
			partyMap[cid].Current = partyMap[cid].Current.Add(outstanding)
		} else if days <= 30 {
			partyMap[cid].Days1_30 = partyMap[cid].Days1_30.Add(outstanding)
		} else if days <= 60 {
			partyMap[cid].Days31_60 = partyMap[cid].Days31_60.Add(outstanding)
		} else if days <= 90 {
			partyMap[cid].Days61_90 = partyMap[cid].Days61_90.Add(outstanding)
		} else {
			partyMap[cid].Days90Plus = partyMap[cid].Days90Plus.Add(outstanding)
		}

		partyMap[cid].TotalInvoiced = partyMap[cid].TotalInvoiced.Add(inv.TotalAmount)
		partyMap[cid].TotalPaid = partyMap[cid].TotalPaid.Add(inv.PaidAmount)
		partyMap[cid].Outstanding = partyMap[cid].Outstanding.Add(outstanding)

		dueDate := (*string)(nil)
		if inv.DueDate != nil {
			dd := inv.DueDate.Format("2006-01-02")
			dueDate = &dd
		}
		daysOverdue := 0
		if days > 0 {
			daysOverdue = days
		}

		partyMap[cid].Invoices = append(partyMap[cid].Invoices, InvoiceDetail{
			InvoiceNumber: inv.InvoiceNumber,
			IssueDate:     inv.IssueDate.Format("2006-01-02"),
			DueDate:       dueDate,
			TotalAmount:   inv.TotalAmount,
			PaidAmount:    inv.PaidAmount,
			Outstanding:   outstanding,
			Status:        string(inv.Status),
			DaysOverdue:   daysOverdue,
		})
	}

	// Subtract unapplied credit notes from each customer's outstanding balance
	type cnSummary struct {
		CustomerID     int             `gorm:"column:customer_id"`
		TotalRemaining decimal.Decimal `gorm:"column:total_remaining"`
	}
	var creditNotes []cnSummary
	rs.db.Raw(`
		SELECT customer_id, SUM(remaining_amount) AS total_remaining
		FROM credit_notes
		WHERE outlet_id = ? AND status IN ('ACTIVE', 'PARTIAL')
		GROUP BY customer_id
	`, outletId).Scan(&creditNotes)

	for _, cn := range creditNotes {
		if party, ok := partyMap[cn.CustomerID]; ok {
			reduction := cn.TotalRemaining
			party.Outstanding = party.Outstanding.Sub(reduction)
			if party.Outstanding.LessThan(decimal.Zero) {
				party.Outstanding = decimal.Zero
			}
			// Reduce Current bucket first, then oldest buckets
			if party.Current.GreaterThan(decimal.Zero) {
				take := decimal.Min(reduction, party.Current)
				party.Current = party.Current.Sub(take)
				reduction = reduction.Sub(take)
			}
			if reduction.GreaterThan(decimal.Zero) && party.Days1_30.GreaterThan(decimal.Zero) {
				take := decimal.Min(reduction, party.Days1_30)
				party.Days1_30 = party.Days1_30.Sub(take)
				reduction = reduction.Sub(take)
			}
		}
	}

	// Subtract sale returns linked to a customer
	type srSummary struct {
		CustomerID  int             `gorm:"column:customer_id"`
		ReturnTotal decimal.Decimal `gorm:"column:return_total"`
	}
	var saleReturns []srSummary
	rs.db.Raw(`
		SELECT customer_id, SUM(total_amount) AS return_total
		FROM sale_returns
		WHERE outlet_id = ? AND customer_id IS NOT NULL
		GROUP BY customer_id
	`, outletId).Scan(&saleReturns)

	for _, sr := range saleReturns {
		if party, ok := partyMap[sr.CustomerID]; ok {
			reduction := sr.ReturnTotal
			party.Outstanding = party.Outstanding.Sub(reduction)
			if party.Outstanding.LessThan(decimal.Zero) {
				party.Outstanding = decimal.Zero
			}
			if party.Current.GreaterThan(decimal.Zero) {
				take := decimal.Min(reduction, party.Current)
				party.Current = party.Current.Sub(take)
				reduction = reduction.Sub(take)
			}
			if reduction.GreaterThan(decimal.Zero) && party.Days1_30.GreaterThan(decimal.Zero) {
				take := decimal.Min(reduction, party.Days1_30)
				party.Days1_30 = party.Days1_30.Sub(take)
			}
		}
	}

	result := make([]DebtorLedgerRow, 0, len(partyMap))
	for _, party := range partyMap {
		if party.Outstanding.GreaterThan(decimal.Zero) {
			result = append(result, *party)
		}
	}

	// Sort by outstanding descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Outstanding.GreaterThan(result[i].Outstanding) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

func (rs *ReportService) ExportDebtorsCSV(outletId int) (string, error) {
	rows, err := rs.DebtorsLedger(outletId)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Party Name,GSTIN,Phone,Total Invoiced,Total Paid,Outstanding,Current (0 days),1-30 Days,31-60 Days,61-90 Days,90+ Days\n")

	for _, r := range rows {
		sb.WriteString(fmt.Sprintf("\"%s\",\"%s\",\"%s\",%s,%s,%s,%s,%s,%s,%s,%s\n",
			r.Name,
			r.GSTIN,
			r.Phone,
			r.TotalInvoiced.String(),
			r.TotalPaid.String(),
			r.Outstanding.String(),
			r.Current.String(),
			r.Days1_30.String(),
			r.Days31_60.String(),
			r.Days61_90.String(),
			r.Days90Plus.String(),
		))
	}

	return sb.String(), nil
}

type BillDetail struct {
	BillNumber string          `json:"billNumber"`
	BillDate   string          `json:"billDate"`
	DueDate    *string         `json:"dueDate"`
	TotalAmount decimal.Decimal `json:"totalAmount"`
	PaidAmount decimal.Decimal `json:"paidAmount"`
	Outstanding decimal.Decimal `json:"outstanding"`
	Status     string          `json:"status"`
	DaysOverdue int             `json:"daysOverdue"`
}

type CreditorLedgerRow struct {
	SupplierID   int             `json:"supplierId"`
	Name         string          `json:"name"`
	Phone        string          `json:"phone"`
	GSTIN        string          `json:"gstin"`
	TotalBilled  decimal.Decimal `json:"totalBilled"`
	TotalPaid    decimal.Decimal `json:"totalPaid"`
	Outstanding  decimal.Decimal `json:"outstanding"`
	Current      decimal.Decimal `json:"current"`
	Days1_30     decimal.Decimal `json:"days1_30"`
	Days31_60    decimal.Decimal `json:"days31_60"`
	Days61_90    decimal.Decimal `json:"days61_90"`
	Days90Plus   decimal.Decimal `json:"days90plus"`
	Bills        []BillDetail    `json:"bills"`
}

func (rs *ReportService) CreditorsLedger(outletId int) ([]CreditorLedgerRow, error) {
	var bills []models.PurchaseBill
	statuses := []string{"UNPAID", "PARTIAL"}
	if err := rs.db.Where("outlet_id = ? AND status IN ?", outletId, statuses).
		Preload("Supplier").
		Order("bill_date ASC").Find(&bills).Error; err != nil {
		return nil, err
	}

	partyMap := make(map[int]*CreditorLedgerRow)
	now := time.Now()

	for _, bill := range bills {
		outstanding := bill.TotalAmount.Sub(bill.PaidAmount)
		if outstanding.LessThanOrEqual(decimal.Zero) {
			continue
		}

		sid := bill.SupplierID
		if _, exists := partyMap[sid]; !exists {
			gstin := ""
			if bill.Supplier.GSTIN != nil {
				gstin = *bill.Supplier.GSTIN
			}
			phone := ""
			if bill.Supplier.Phone != nil {
				phone = *bill.Supplier.Phone
			}
			partyMap[sid] = &CreditorLedgerRow{
				SupplierID:  sid,
				Name:        bill.Supplier.Name,
				Phone:       phone,
				GSTIN:       gstin,
				TotalBilled: decimal.Zero,
				TotalPaid:   decimal.Zero,
				Outstanding: decimal.Zero,
				Current:     decimal.Zero,
				Days1_30:    decimal.Zero,
				Days31_60:   decimal.Zero,
				Days61_90:   decimal.Zero,
				Days90Plus:  decimal.Zero,
				Bills:       make([]BillDetail, 0),
			}
		}

		// Calculate age buckets
		ref := bill.DueDate
		if ref == nil {
			tmp := bill.BillDate.AddDate(0, 0, 30)
			ref = &tmp
		}
		days := int(now.Sub(*ref).Hours() / 24)

		if days <= 0 {
			partyMap[sid].Current = partyMap[sid].Current.Add(outstanding)
		} else if days <= 30 {
			partyMap[sid].Days1_30 = partyMap[sid].Days1_30.Add(outstanding)
		} else if days <= 60 {
			partyMap[sid].Days31_60 = partyMap[sid].Days31_60.Add(outstanding)
		} else if days <= 90 {
			partyMap[sid].Days61_90 = partyMap[sid].Days61_90.Add(outstanding)
		} else {
			partyMap[sid].Days90Plus = partyMap[sid].Days90Plus.Add(outstanding)
		}

		partyMap[sid].TotalBilled = partyMap[sid].TotalBilled.Add(bill.TotalAmount)
		partyMap[sid].TotalPaid = partyMap[sid].TotalPaid.Add(bill.PaidAmount)
		partyMap[sid].Outstanding = partyMap[sid].Outstanding.Add(outstanding)

		dueDate := (*string)(nil)
		if bill.DueDate != nil {
			dd := bill.DueDate.Format("2006-01-02")
			dueDate = &dd
		}
		daysOverdue := 0
		if days > 0 {
			daysOverdue = days
		}

		partyMap[sid].Bills = append(partyMap[sid].Bills, BillDetail{
			BillNumber:  bill.BillNumber,
			BillDate:    bill.BillDate.Format("2006-01-02"),
			DueDate:     dueDate,
			TotalAmount: bill.TotalAmount,
			PaidAmount:  bill.PaidAmount,
			Outstanding: outstanding,
			Status:      string(bill.Status),
			DaysOverdue: daysOverdue,
		})
	}

	// Subtract unapplied vendor credits from each supplier's outstanding
	type vcSummary struct {
		SupplierID     int             `gorm:"column:supplier_id"`
		TotalRemaining decimal.Decimal `gorm:"column:total_remaining"`
	}
	var vendorCredits []vcSummary
	rs.db.Raw(`
		SELECT supplier_id, SUM(remaining_amount) AS total_remaining
		FROM vendor_credits
		WHERE outlet_id = ? AND status IN ('OPEN', 'PARTIAL')
		GROUP BY supplier_id
	`, outletId).Scan(&vendorCredits)

	for _, vc := range vendorCredits {
		if party, ok := partyMap[vc.SupplierID]; ok {
			reduction := vc.TotalRemaining
			party.Outstanding = party.Outstanding.Sub(reduction)
			if party.Outstanding.LessThan(decimal.Zero) {
				party.Outstanding = decimal.Zero
			}
			if party.Current.GreaterThan(decimal.Zero) {
				take := decimal.Min(reduction, party.Current)
				party.Current = party.Current.Sub(take)
				reduction = reduction.Sub(take)
			}
			if reduction.GreaterThan(decimal.Zero) && party.Days1_30.GreaterThan(decimal.Zero) {
				take := decimal.Min(reduction, party.Days1_30)
				party.Days1_30 = party.Days1_30.Sub(take)
			}
		}
	}

	// Subtract purchase return totals (via purchase_orders JOIN) per supplier
	type prSummary struct {
		SupplierID  int             `gorm:"column:supplier_id"`
		ReturnTotal decimal.Decimal `gorm:"column:return_total"`
	}
	var purchaseReturns []prSummary
	rs.db.Raw(`
		SELECT po.supplier_id, SUM(pr.total_amount) AS return_total
		FROM purchase_returns pr
		JOIN purchase_orders po ON po.id = pr.purchase_order_id
		WHERE pr.outlet_id = ?
		GROUP BY po.supplier_id
	`, outletId).Scan(&purchaseReturns)

	for _, pr := range purchaseReturns {
		if party, ok := partyMap[pr.SupplierID]; ok {
			reduction := pr.ReturnTotal
			party.Outstanding = party.Outstanding.Sub(reduction)
			if party.Outstanding.LessThan(decimal.Zero) {
				party.Outstanding = decimal.Zero
			}
			if party.Current.GreaterThan(decimal.Zero) {
				take := decimal.Min(reduction, party.Current)
				party.Current = party.Current.Sub(take)
				reduction = reduction.Sub(take)
			}
			if reduction.GreaterThan(decimal.Zero) && party.Days1_30.GreaterThan(decimal.Zero) {
				take := decimal.Min(reduction, party.Days1_30)
				party.Days1_30 = party.Days1_30.Sub(take)
			}
		}
	}

	result := make([]CreditorLedgerRow, 0, len(partyMap))
	for _, party := range partyMap {
		if party.Outstanding.GreaterThan(decimal.Zero) {
			result = append(result, *party)
		}
	}

	// Sort by outstanding descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Outstanding.GreaterThan(result[i].Outstanding) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

func (rs *ReportService) ExportCreditorsCSV(outletId int) (string, error) {
	rows, err := rs.CreditorsLedger(outletId)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Party Name,GSTIN,Phone,Total Billed,Total Paid,Outstanding,Current (0 days),1-30 Days,31-60 Days,61-90 Days,90+ Days\n")

	for _, r := range rows {
		sb.WriteString(fmt.Sprintf("\"%s\",\"%s\",\"%s\",%s,%s,%s,%s,%s,%s,%s,%s\n",
			r.Name,
			r.GSTIN,
			r.Phone,
			r.TotalBilled.String(),
			r.TotalPaid.String(),
			r.Outstanding.String(),
			r.Current.String(),
			r.Days1_30.String(),
			r.Days31_60.String(),
			r.Days61_90.String(),
			r.Days90Plus.String(),
		))
	}

	return sb.String(), nil
}


// ─── Ledger / Trial Balance ───────────────────────────────────────────────────

type LedgerAccount struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	AccountType    string          `json:"accountType"` // "gl" | "customer" | "supplier"
	PartyID        *int            `json:"partyId,omitempty"`
	OpeningBalance decimal.Decimal `json:"openingBalance"`
	Debit          decimal.Decimal `json:"debit"`
	Credit         decimal.Decimal `json:"credit"`
	ClosingBalance decimal.Decimal `json:"closingBalance"`
}

type LedgerSummaryResponse struct {
	Accounts []LedgerAccount `json:"accounts"`
}

func (rs *ReportService) LedgerSummary(outletId int, from, to time.Time) (LedgerSummaryResponse, error) {
	var res LedgerSummaryResponse
	zero := decimal.Zero

	// ── 1. Purchase accounts grouped by GST rate ──────────────────────────
	type rateRow struct {
		Rate   float64
		Amount decimal.Decimal
		GST    decimal.Decimal
	}
	var purchaseRows []rateRow
	if err := rs.db.Raw(`
		SELECT ROUND(pbi.tax_rate) as rate,
		       SUM(pbi.line_total) as amount,
		       SUM(pbi.line_total * pbi.tax_rate / 100) as gst
		FROM purchase_bill_items pbi
		JOIN purchase_bills pb ON pbi.bill_id = pb.id
		WHERE pb.outlet_id = ? AND pb.bill_date >= ? AND pb.bill_date <= ?
		  AND pb.status NOT IN ('CANCELLED','DRAFT')
		GROUP BY ROUND(pbi.tax_rate)
		ORDER BY rate`, outletId, from, to).Scan(&purchaseRows).Error; err != nil {
		return res, err
	}

	inputGST := map[int]decimal.Decimal{}
	for _, r := range purchaseRows {
		rate := int(r.Rate)
		name := fmt.Sprintf("Purchase %d%%", rate)
		id := fmt.Sprintf("purchase-%d", rate)
		closing := r.Amount
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: id, Name: name, AccountType: "gl",
			OpeningBalance: zero, Debit: r.Amount, Credit: zero, ClosingBalance: closing,
		})
		inputGST[rate] = inputGST[rate].Add(r.GST)
	}

	// ── 2. Sales accounts grouped by GST rate ─────────────────────────────
	var salesRows []rateRow
	if err := rs.db.Raw(`
		SELECT ROUND(ii.tax_rate) as rate,
		       SUM(ii.line_total) as amount,
		       SUM(ii.line_total * ii.tax_rate / 100) as gst
		FROM invoice_items ii
		JOIN invoices i ON ii.invoice_id = i.id
		WHERE i.outlet_id = ? AND i.issue_date >= ? AND i.issue_date <= ?
		  AND i.status NOT IN ('CANCELLED','DRAFT')
		GROUP BY ROUND(ii.tax_rate)
		ORDER BY rate`, outletId, from, to).Scan(&salesRows).Error; err != nil {
		return res, err
	}

	outputGST := map[int]decimal.Decimal{}
	for _, r := range salesRows {
		rate := int(r.Rate)
		name := fmt.Sprintf("Sale %d%%", rate)
		id := fmt.Sprintf("sale-%d", rate)
		closing := r.Amount.Neg()
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: id, Name: name, AccountType: "gl",
			OpeningBalance: zero, Debit: zero, Credit: r.Amount, ClosingBalance: closing,
		})
		outputGST[rate] = outputGST[rate].Add(r.GST)
	}

	// ── 3. GST accounts (all unique rates) ───────────────────────────────
	allRates := map[int]bool{}
	for k := range inputGST { allRates[k] = true }
	for k := range outputGST { allRates[k] = true }
	for rate := range allRates {
		inp := inputGST[rate]
		out := outputGST[rate]
		closing := inp.Sub(out)
		name := fmt.Sprintf("GST %d%%", rate)
		id := fmt.Sprintf("gst-%d", rate)
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: id, Name: name, AccountType: "gl",
			OpeningBalance: zero, Debit: inp, Credit: out, ClosingBalance: closing,
		})
	}

	// ── 4. Customer accounts (Sundry Debtors) ────────────────────────────
	// Debit  = total invoiced; Credit = actual receipts (sales_order_payments)
	type partyRow struct {
		ID     int
		Name   string
		Debit  decimal.Decimal
		Credit decimal.Decimal
	}
	var custRows []partyRow
	if err := rs.db.Raw(`
		SELECT c.id, c.name,
		       COALESCE(inv.total,0)  AS debit,
		       COALESCE(sop.total,0)  AS credit
		FROM customers c
		LEFT JOIN (
		    SELECT customer_id, SUM(total_amount) AS total
		    FROM invoices
		    WHERE outlet_id = ? AND issue_date >= ? AND issue_date <= ?
		      AND status NOT IN ('CANCELLED','DRAFT')
		    GROUP BY customer_id
		) inv ON inv.customer_id = c.id
		LEFT JOIN (
		    SELECT customer_id, SUM(amount) AS total
		    FROM sales_order_payments
		    WHERE outlet_id = ? AND payment_date >= ? AND payment_date <= ?
		    GROUP BY customer_id
		) sop ON sop.customer_id = c.id
		WHERE inv.total IS NOT NULL OR sop.total IS NOT NULL
		ORDER BY c.name`, outletId, from, to, outletId, from, to).Scan(&custRows).Error; err != nil {
		return res, err
	}
	for _, r := range custRows {
		closing := r.Debit.Sub(r.Credit)
		pid := r.ID
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: fmt.Sprintf("customer-%d", r.ID), Name: strings.ToUpper(r.Name),
			AccountType: "customer", PartyID: &pid,
			OpeningBalance: zero, Debit: r.Debit, Credit: r.Credit, ClosingBalance: closing,
		})
	}

	// ── 5. Supplier accounts (Sundry Creditors) ───────────────────────────
	var suppRows []partyRow
	if err := rs.db.Raw(`
		SELECT s.id, s.name,
		       COALESCE(SUM(pb.paid_amount),0)   as debit,
		       COALESCE(SUM(pb.total_amount),0)  as credit
		FROM suppliers s
		JOIN purchase_bills pb ON pb.supplier_id = s.id
		WHERE pb.outlet_id = ? AND pb.bill_date >= ? AND pb.bill_date <= ?
		  AND pb.status NOT IN ('CANCELLED','DRAFT')
		GROUP BY s.id, s.name
		ORDER BY s.name`, outletId, from, to).Scan(&suppRows).Error; err != nil {
		return res, err
	}
	for _, r := range suppRows {
		closing := r.Debit.Sub(r.Credit)
		pid := r.ID
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: fmt.Sprintf("supplier-%d", r.ID), Name: strings.ToUpper(r.Name),
			AccountType: "supplier", PartyID: &pid,
			OpeningBalance: zero, Debit: r.Debit, Credit: r.Credit, ClosingBalance: closing,
		})
	}

	// ── 6. Expense accounts grouped by category ──────────────────────────
	type expenseRow struct {
		CategoryID   int
		CategoryName string
		Amount       decimal.Decimal
	}
	var expRows []expenseRow
	if err := rs.db.Raw(`
		SELECT ec.id as category_id, ec.name as category_name,
		       SUM(e.total_amount) as amount
		FROM expenses e
		JOIN expense_categories ec ON e.expense_category_id = ec.id
		WHERE e.outlet_id = ? AND e.expense_date >= ? AND e.expense_date <= ?
		  AND e.status NOT IN ('REJECTED')
		GROUP BY ec.id, ec.name
		ORDER BY ec.name`, outletId, from, to).Scan(&expRows).Error; err == nil {
		for _, r := range expRows {
			res.Accounts = append(res.Accounts, LedgerAccount{
				ID:   fmt.Sprintf("expense-%d", r.CategoryID),
				Name: "Expense — " + r.CategoryName,
				AccountType:    "gl",
				OpeningBalance: zero,
				Debit:          r.Amount,
				Credit:         zero,
				ClosingBalance: r.Amount,
			})
		}
	}

	return res, nil
}

// ─── Ledger Detail (single party) ─────────────────────────────────────────────

type LedgerEntry struct {
	Date            string          `json:"date"`
	Particulars     string          `json:"particulars"`
	VoucherType     string          `json:"voucherType"`
	VoucherNo       string          `json:"voucherNo"`
	VoucherID       int             `json:"voucherId,omitempty"`
	Debit           decimal.Decimal `json:"debit"`
	Credit          decimal.Decimal `json:"credit"`
	Balance         decimal.Decimal `json:"balance"`
	PaymentMethod   string          `json:"paymentMethod,omitempty"`
	ReferenceNumber string          `json:"referenceNumber,omitempty"`
	Notes           string          `json:"notes,omitempty"`
}

type LedgerDetailResponse struct {
	PartyName      string          `json:"partyName"`
	PartyType      string          `json:"partyType"`
	OpeningBalance decimal.Decimal `json:"openingBalance"`
	ClosingBalance decimal.Decimal `json:"closingBalance"`
	Entries        []LedgerEntry   `json:"entries"`
}

func (rs *ReportService) LedgerDetail(outletId int, partyType string, partyId int, from, to time.Time) (LedgerDetailResponse, error) {
	var res LedgerDetailResponse
	zero := decimal.Zero
	running := zero

	if partyType == "customer" {
		var name string
		rs.db.Raw("SELECT name FROM customers WHERE id = ?", partyId).Scan(&name)
		res.PartyName = strings.ToUpper(name)
		res.PartyType = "customer"

		// All transactions merged and sorted by date (Tally-style)
		type txn struct {
			Date            time.Time
			Particulars     string
			VoucherType     string
			VoucherNo       string
			VoucherID       int
			Debit           decimal.Decimal
			Credit          decimal.Decimal
			PaymentMethod   string
			ReferenceNumber string
			Notes           string
		}
		var all []txn

		// Invoices → Dr (customer owes us)
		type invRow struct {
			ID          int
			IssueDate   time.Time
			InvoiceNo   string
			TotalAmount decimal.Decimal
		}
		var invs []invRow
		rs.db.Raw(`
			SELECT id, issue_date, invoice_number as invoice_no, total_amount
			FROM invoices
			WHERE outlet_id = ? AND customer_id = ? AND issue_date >= ? AND issue_date <= ?
			  AND status NOT IN ('CANCELLED','DRAFT')
			ORDER BY issue_date`, outletId, partyId, from, to).Scan(&invs)
		for _, inv := range invs {
			all = append(all, txn{
				Date: inv.IssueDate, Particulars: "Sales Invoice",
				VoucherType: "Invoice", VoucherNo: inv.InvoiceNo,
				VoucherID: inv.ID,
				Debit: inv.TotalAmount, Credit: zero,
			})
		}

		// Receipts from sales_order_payments → Cr (customer paid us)
		type rcptRow struct {
			ID              int
			PaymentDate     time.Time
			Amount          decimal.Decimal
			PaymentMethod   string
			ReferenceNumber string
			Notes           string
		}
		var rcpts []rcptRow
		rs.db.Raw(`
			SELECT id, payment_date, amount, payment_method,
			       COALESCE(reference_number,'') as reference_number,
			       COALESCE(notes,'') as notes
			FROM sales_order_payments
			WHERE outlet_id = ? AND customer_id = ? AND payment_date >= ? AND payment_date <= ?
			ORDER BY payment_date`, outletId, partyId, from, to).Scan(&rcpts)
		for _, r := range rcpts {
			voucherNo := r.ReferenceNumber
			if voucherNo == "" {
				voucherNo = r.PaymentMethod
			}
			all = append(all, txn{
				Date: r.PaymentDate, Particulars: "Receipt",
				VoucherType: "Receipt", VoucherNo: voucherNo,
				VoucherID: r.ID, PaymentMethod: r.PaymentMethod,
				ReferenceNumber: r.ReferenceNumber, Notes: r.Notes,
				Debit: zero, Credit: r.Amount,
			})
		}

		// Sort by date ascending; receipts before invoices on same day (advance first)
		sort.SliceStable(all, func(i, j int) bool {
			if all[i].Date.Equal(all[j].Date) {
				return all[i].VoucherType == "Receipt"
			}
			return all[i].Date.Before(all[j].Date)
		})

		for _, t := range all {
			running = running.Add(t.Debit).Sub(t.Credit)
			res.Entries = append(res.Entries, LedgerEntry{
				Date: t.Date.Format("02 Jan 2006"), Particulars: t.Particulars,
				VoucherType: t.VoucherType, VoucherNo: t.VoucherNo,
				VoucherID: t.VoucherID, PaymentMethod: t.PaymentMethod,
				ReferenceNumber: t.ReferenceNumber, Notes: t.Notes,
				Debit: t.Debit, Credit: t.Credit, Balance: running,
			})
		}

	} else if partyType == "supplier" {
		var name string
		rs.db.Raw("SELECT name FROM suppliers WHERE id = ?", partyId).Scan(&name)
		res.PartyName = strings.ToUpper(name)
		res.PartyType = "supplier"

		type billRow struct {
			BillDate    time.Time
			BillNumber  string
			TotalAmount decimal.Decimal
			PaidAmount  decimal.Decimal
		}
		var bills []billRow
		rs.db.Raw(`
			SELECT bill_date, bill_number, total_amount, paid_amount
			FROM purchase_bills
			WHERE outlet_id = ? AND supplier_id = ? AND bill_date >= ? AND bill_date <= ?
			  AND status NOT IN ('CANCELLED','DRAFT')
			ORDER BY bill_date`, outletId, partyId, from, to).Scan(&bills)

		for _, b := range bills {
			running = running.Sub(b.TotalAmount)
			res.Entries = append(res.Entries, LedgerEntry{
				Date: b.BillDate.Format("02 Jan 2006"), Particulars: "Purchase Bill",
				VoucherType: "Purchase", VoucherNo: b.BillNumber,
				Debit: zero, Credit: b.TotalAmount, Balance: running,
			})
			if b.PaidAmount.GreaterThan(zero) {
				running = running.Add(b.PaidAmount)
				res.Entries = append(res.Entries, LedgerEntry{
					Date: b.BillDate.Format("02 Jan 2006"), Particulars: "Payment Made",
					VoucherType: "Payment", VoucherNo: b.BillNumber,
					Debit: b.PaidAmount, Credit: zero, Balance: running,
				})
			}
		}
	}

	res.OpeningBalance = zero
	res.ClosingBalance = running
	return res, nil
}

// LedgerDetailExcel returns an Excel workbook for a party's ledger detail in the given period.
func (rs *ReportService) LedgerDetailExcel(outletId int, partyType string, partyId int, from, to time.Time) ([]byte, error) {
	detail, err := rs.LedgerDetail(outletId, partyType, partyId, from, to)
	if err != nil {
		return nil, err
	}

	f := excelize.NewFile()
	sh := "Ledger"
	f.SetSheetName("Sheet1", sh)

	// Header styles
	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 14},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	boldStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
	})
	drStyle, _ := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#FFF2CC"}, Pattern: 1},
		NumFmt: 4,
	})
	crStyle, _ := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E2EFDA"}, Pattern: 1},
		NumFmt: 4,
	})
	numStyle, _ := f.NewStyle(&excelize.Style{NumFmt: 4})
	balDrStyle, _ := f.NewStyle(&excelize.Style{
		Font:   &excelize.Font{Color: "C00000"},
		NumFmt: 4,
	})
	balCrStyle, _ := f.NewStyle(&excelize.Style{
		Font:   &excelize.Font{Color: "375623"},
		NumFmt: 4,
	})

	// Title
	f.MergeCell(sh, "A1", "H1")
	f.SetCellValue(sh, "A1", detail.PartyName+" — Ledger")
	f.SetCellStyle(sh, "A1", "A1", titleStyle)
	f.MergeCell(sh, "A2", "H2")
	f.SetCellValue(sh, "A2", from.Format("02 Jan 2006")+" to "+to.Format("02 Jan 2006"))
	f.SetCellStyle(sh, "A2", "A2", titleStyle)

	// Opening balance row
	f.SetCellValue(sh, "A3", "Opening Balance")
	f.SetCellValue(sh, "H3", detail.OpeningBalance.InexactFloat64())
	f.SetCellStyle(sh, "H3", "H3", numStyle)

	// Column headers
	headers := []string{"Date", "Particulars", "Voucher Type", "Voucher No", "Reference", "Debit (Dr)", "Credit (Cr)", "Balance"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 5)
		f.SetCellValue(sh, cell, h)
		f.SetCellStyle(sh, cell, cell, boldStyle)
	}

	// Data rows
	row := 6
	for _, e := range detail.Entries {
		f.SetCellValue(sh, fmt.Sprintf("A%d", row), e.Date)
		f.SetCellValue(sh, fmt.Sprintf("B%d", row), e.Particulars)
		f.SetCellValue(sh, fmt.Sprintf("C%d", row), e.VoucherType)
		f.SetCellValue(sh, fmt.Sprintf("D%d", row), e.VoucherNo)
		ref := e.ReferenceNumber
		if ref == "" {
			ref = e.Notes
		}
		f.SetCellValue(sh, fmt.Sprintf("E%d", row), ref)
		dr := e.Debit.InexactFloat64()
		cr := e.Credit.InexactFloat64()
		bal := e.Balance.InexactFloat64()
		if dr > 0 {
			f.SetCellValue(sh, fmt.Sprintf("F%d", row), dr)
			f.SetCellStyle(sh, fmt.Sprintf("F%d", row), fmt.Sprintf("F%d", row), drStyle)
		}
		if cr > 0 {
			f.SetCellValue(sh, fmt.Sprintf("G%d", row), cr)
			f.SetCellStyle(sh, fmt.Sprintf("G%d", row), fmt.Sprintf("G%d", row), crStyle)
		}
		f.SetCellValue(sh, fmt.Sprintf("H%d", row), bal)
		if bal >= 0 {
			f.SetCellStyle(sh, fmt.Sprintf("H%d", row), fmt.Sprintf("H%d", row), balDrStyle)
		} else {
			f.SetCellStyle(sh, fmt.Sprintf("H%d", row), fmt.Sprintf("H%d", row), balCrStyle)
		}
		row++
	}

	// Closing balance footer
	f.SetCellValue(sh, fmt.Sprintf("A%d", row), "Closing Balance")
	f.SetCellValue(sh, fmt.Sprintf("H%d", row), detail.ClosingBalance.InexactFloat64())
	closStyle, _ := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}, NumFmt: 4})
	f.SetCellStyle(sh, fmt.Sprintf("A%d", row), fmt.Sprintf("H%d", row), closStyle)

	// Column widths
	f.SetColWidth(sh, "A", "A", 14)
	f.SetColWidth(sh, "B", "B", 22)
	f.SetColWidth(sh, "C", "C", 14)
	f.SetColWidth(sh, "D", "D", 18)
	f.SetColWidth(sh, "E", "E", 20)
	f.SetColWidth(sh, "F", "G", 14)
	f.SetColWidth(sh, "H", "H", 16)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// LedgerTDSPayable returns total TDS deducted in period (for the TDS Payable ledger account).
func (rs *ReportService) LedgerTDSPayable(outletId int, from, to time.Time) (decimal.Decimal, error) {
	var total decimal.Decimal
	err := rs.db.Raw(`
		SELECT COALESCE(SUM(tds_amount),0)
		FROM tds_deductions
		WHERE outlet_id = ? AND payment_date >= ? AND payment_date <= ?`, outletId, from, to).Scan(&total).Error
	return total, err
}
