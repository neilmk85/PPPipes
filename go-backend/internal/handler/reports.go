package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ReportHandler struct {
	service *service.ReportService
}

func NewReportHandler(rs *service.ReportService) *ReportHandler {
	return &ReportHandler{service: rs}
}

func parseReportParams(r *http.Request) (int, time.Time, time.Time, error) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		return 0, time.Time{}, time.Time{}, err
	}

	from, err := time.Parse("2006-01-02", r.URL.Query().Get("from"))
	if err != nil {
		return 0, time.Time{}, time.Time{}, err
	}

	toStr := r.URL.Query().Get("to")
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		return 0, time.Time{}, time.Time{}, err
	}
	// Set to end of day
	to = to.Add(time.Hour*23 + time.Minute*59 + time.Second*59)

	return outletId, from, to, nil
}

// ─── Sales Reports ────────────────────────────────────────────────────────

func (rh *ReportHandler) SalesSummary(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := rh.service.SalesSummary(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sales summary retrieved", result)
}

func (rh *ReportHandler) TopProducts(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	limit := 10
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	result, err := rh.service.TopProducts(outletId, from, to, limit)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Top products retrieved", result)
}

func (rh *ReportHandler) PaymentMethods(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := rh.service.PaymentMethods(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Payment methods retrieved", result)
}

func (rh *ReportHandler) DailyTrend(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := rh.service.DailyTrend(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Daily trend retrieved", result)
}

func (rh *ReportHandler) SalesByCategory(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := rh.service.SalesByCategory(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sales by category retrieved", result)
}

func (rh *ReportHandler) SalesByProduct(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	page, size := util.ParsePagination(r)

	result, err := rh.service.SalesByProduct(outletId, from, to, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sales by product retrieved", result)
}

func (rh *ReportHandler) SalesByCustomer(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	page, size := util.ParsePagination(r)

	result, err := rh.service.SalesByCustomer(outletId, from, to, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sales by customer retrieved", result)
}

func (rh *ReportHandler) ExportSalesCSV(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	csv, err := rh.service.ExportSalesCSV(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=sales_"+r.URL.Query().Get("from")+"_"+r.URL.Query().Get("to")+".csv")
	w.Header().Set("Content-Type", "text/csv")
	w.Write([]byte(csv))
}

// ─── Purchase Reports ─────────────────────────────────────────────────────

func (rh *ReportHandler) PurchaseSummary(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := rh.service.PurchaseSummary(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Purchase summary retrieved", result)
}

func (rh *ReportHandler) PurchaseBySupplier(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := rh.service.PurchaseBySupplier(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Purchase by supplier retrieved", result)
}

func (rh *ReportHandler) OutstandingPOs(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	result, err := rh.service.OutstandingPOs(outletId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Outstanding POs retrieved", result)
}

func (rh *ReportHandler) SaleReturns(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	page, size := util.ParsePagination(r)

	result, err := rh.service.SaleReturns(outletId, from, to, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sale returns retrieved", result)
}

func (rh *ReportHandler) PurchaseReturns(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	page, size := util.ParsePagination(r)

	result, err := rh.service.PurchaseReturns(outletId, from, to, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Purchase returns retrieved", result)
}

func (rh *ReportHandler) OutstandingReceivable(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	result, err := rh.service.OutstandingReceivable(outletId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Outstanding receivable retrieved", result)
}

func (rh *ReportHandler) ExportPurchaseCSV(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	csv, err := rh.service.ExportPurchaseCSV(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=purchases_"+r.URL.Query().Get("from")+"_"+r.URL.Query().Get("to")+".csv")
	w.Header().Set("Content-Type", "text/csv")
	w.Write([]byte(csv))
}

// ─── Payment Method Report ────────────────────────────────────────────────

func (rh *ReportHandler) PaymentMethodReport(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := rh.service.PaymentMethodReport(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Payment method report retrieved", result)
}

func (rh *ReportHandler) ExportPaymentCSV(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	csv, err := rh.service.ExportPaymentCSV(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=payments_"+r.URL.Query().Get("from")+"_"+r.URL.Query().Get("to")+".csv")
	w.Header().Set("Content-Type", "text/csv")
	w.Write([]byte(csv))
}

// ─── Debtors & Creditors Ledger ───────────────────────────────────────────

func (rh *ReportHandler) DebtorsLedger(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	result, err := rh.service.DebtorsLedger(outletId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Debtors ledger retrieved", result)
}

func (rh *ReportHandler) CreditorsLedger(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	result, err := rh.service.CreditorsLedger(outletId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Creditors ledger retrieved", result)
}

func (rh *ReportHandler) ExportDebtorsCSV(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	csv, err := rh.service.ExportDebtorsCSV(outletId)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=debtors_ledger.csv")
	w.Header().Set("Content-Type", "text/csv")
	w.Write([]byte(csv))
}

func (rh *ReportHandler) ExportCreditorsCSV(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	csv, err := rh.service.ExportCreditorsCSV(outletId)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=creditors_ledger.csv")
	w.Header().Set("Content-Type", "text/csv")
	w.Write([]byte(csv))
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

func (rh *ReportHandler) GetLedger(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}
	result, err := rh.service.LedgerSummary(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	// Append TDS Payable account
	tdsPayable, _ := rh.service.LedgerTDSPayable(outletId, from, to)
	if tdsPayable.IsPositive() {
		zero := tdsPayable.Sub(tdsPayable)
		result.Accounts = append(result.Accounts, service.LedgerAccount{
			ID: "tds-payable", Name: "TDS Payable", AccountType: "gl",
			OpeningBalance: zero, Debit: zero, Credit: tdsPayable, ClosingBalance: tdsPayable.Neg(),
		})
	}
	util.SendSuccess(w, "Ledger summary retrieved", result)
}

func (rh *ReportHandler) GetLedgerDetail(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}
	partyType := r.URL.Query().Get("partyType")
	partyId, err := strconv.Atoi(r.URL.Query().Get("partyId"))
	if err != nil || (partyType != "customer" && partyType != "supplier") {
		util.SendError(w, http.StatusBadRequest, "Invalid partyType or partyId")
		return
	}
	result, err := rh.service.LedgerDetail(outletId, partyType, partyId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Ledger detail retrieved", result)
}

func (rh *ReportHandler) GetLedgerDetailExcel(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseReportParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}
	partyType := r.URL.Query().Get("partyType")
	partyId, err := strconv.Atoi(r.URL.Query().Get("partyId"))
	if err != nil || (partyType != "customer" && partyType != "supplier") {
		util.SendError(w, http.StatusBadRequest, "Invalid partyType or partyId")
		return
	}
	data, err := rh.service.LedgerDetailExcel(outletId, partyType, partyId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	filename := "ledger_" + r.URL.Query().Get("from") + "_" + r.URL.Query().Get("to") + ".xlsx"
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Write(data)
}
