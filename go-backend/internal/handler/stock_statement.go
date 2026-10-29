package handler

import (
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type StockStatementHandler struct {
	svc *service.StockStatementService
}

func NewStockStatementHandler(svc *service.StockStatementService) *StockStatementHandler {
	return &StockStatementHandler{svc: svc}
}

// GET /api/reports/stock-statement?fromDate=&toDate=
func (h *StockStatementHandler) GetStatement(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("fromDate")
	to   := r.URL.Query().Get("toDate")
	if from == "" || to == "" {
		util.SendError(w, 400, "fromDate and toDate are required")
		return
	}
	rows, err := h.svc.GetStatement(from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "stock statement", rows)
}

// GET /api/reports/stock-ledger?productId=&fromDate=&toDate=
func (h *StockStatementHandler) GetLedger(w http.ResponseWriter, r *http.Request) {
	productID, err := strconv.ParseUint(r.URL.Query().Get("productId"), 10, 64)
	if err != nil || productID == 0 {
		util.SendError(w, 400, "valid productId required")
		return
	}
	from := r.URL.Query().Get("fromDate")
	to   := r.URL.Query().Get("toDate")
	if from == "" || to == "" {
		util.SendError(w, 400, "fromDate and toDate are required")
		return
	}
	opening, rows, err := h.svc.GetLedger(uint(productID), from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "stock ledger", map[string]any{
		"opening": opening,
		"rows":    rows,
	})
}
