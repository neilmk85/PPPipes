package service

import (
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type StockStatementService struct {
	db *gorm.DB
}

func NewStockStatementService(db *gorm.DB) *StockStatementService {
	return &StockStatementService{db: db}
}

type StockStatementRow struct {
	ProductID     uint            `json:"productId"`
	ProductName   string          `json:"productName"`
	UOM           string          `json:"uom"`
	OpeningQty    decimal.Decimal `json:"openingQty"`
	OpeningAmount decimal.Decimal `json:"openingAmount"`
	InwardQty     decimal.Decimal `json:"inwardQty"`
	InwardAmount  decimal.Decimal `json:"inwardAmount"`
	OutwardQty    decimal.Decimal `json:"outwardQty"`
	OutwardAmount decimal.Decimal `json:"outwardAmount"`
	ClosingQty    decimal.Decimal `json:"closingQty"`
	ClosingAmount decimal.Decimal `json:"closingAmount"`
}

type StockLedgerRow struct {
	Date           string          `json:"date"`
	Code           string          `json:"code"`
	TxType         string          `json:"txType"` // "INWARD" | "OUTWARD"
	InwardQty      decimal.Decimal `json:"inwardQty"`
	OutwardQty     decimal.Decimal `json:"outwardQty"`
	ClosingBalance decimal.Decimal `json:"closingBalance"`
}

type movRow struct {
	ProductID uint
	Qty       decimal.Decimal
	Amount    decimal.Decimal
}

func (s *StockStatementService) GetStatement(fromDate, toDate string) ([]StockStatementRow, error) {
	// ── inward before period (purchase bills) ────────────────────────────────
	var preIn []movRow
	s.db.Raw(`
		SELECT pbi.product_id, SUM(pbi.quantity) AS qty, SUM(pbi.line_total) AS amount
		FROM purchase_bill_items pbi
		JOIN purchase_bills pb ON pb.id = pbi.bill_id
		WHERE pb.bill_date < ?
		GROUP BY pbi.product_id
	`, fromDate).Scan(&preIn)

	// ── outward before period (material consumptions) ────────────────────────
	var preOut []movRow
	s.db.Raw(`
		SELECT mc.material_product_id AS product_id, SUM(mc.consumed_qty) AS qty, SUM(mc.total_cost) AS amount
		FROM material_consumptions mc
		JOIN production_entries pe ON pe.id = mc.production_entry_id
		WHERE pe.entry_date < ?
		GROUP BY mc.material_product_id
	`, fromDate).Scan(&preOut)

	// ── stock adjustments before period ─────────────────────────────────────
	var preAdj []movRow
	s.db.Raw(`
		SELECT product_id, SUM(adjustment_quantity) AS qty, 0 AS amount
		FROM stock_adjustments
		WHERE DATE(created_at) < ?
		GROUP BY product_id
	`, fromDate).Scan(&preAdj)

	// ── inward in period ─────────────────────────────────────────────────────
	var inRows []movRow
	s.db.Raw(`
		SELECT pbi.product_id, SUM(pbi.quantity) AS qty, SUM(pbi.line_total) AS amount
		FROM purchase_bill_items pbi
		JOIN purchase_bills pb ON pb.id = pbi.bill_id
		WHERE pb.bill_date BETWEEN ? AND ?
		GROUP BY pbi.product_id
	`, fromDate, toDate).Scan(&inRows)

	// ── outward in period ────────────────────────────────────────────────────
	var outRows []movRow
	s.db.Raw(`
		SELECT mc.material_product_id AS product_id, SUM(mc.consumed_qty) AS qty, SUM(mc.total_cost) AS amount
		FROM material_consumptions mc
		JOIN production_entries pe ON pe.id = mc.production_entry_id
		WHERE pe.entry_date BETWEEN ? AND ?
		GROUP BY mc.material_product_id
	`, fromDate, toDate).Scan(&outRows)

	// ── all products that appear in any movement ─────────────────────────────
	type prodRow struct {
		ProductID uint
		Name      string
		UOM       string
	}
	var products []prodRow
	s.db.Raw(`
		SELECT DISTINCT p.id AS product_id, p.name, COALESCE(p.unit_of_measure, 'kg') AS uom
		FROM products p
		WHERE p.id IN (
			SELECT product_id FROM purchase_bill_items
			UNION
			SELECT material_product_id FROM material_consumptions
			UNION
			SELECT product_id FROM stock_adjustments
		)
		ORDER BY p.name
	`).Scan(&products)

	// ── aggregate into maps ──────────────────────────────────────────────────
	preInQty  := map[uint]decimal.Decimal{}
	preInAmt  := map[uint]decimal.Decimal{}
	preOutQty := map[uint]decimal.Decimal{}
	preAdjQty := map[uint]decimal.Decimal{}
	inQty     := map[uint]decimal.Decimal{}
	inAmt     := map[uint]decimal.Decimal{}
	outQty    := map[uint]decimal.Decimal{}
	outAmt    := map[uint]decimal.Decimal{}

	for _, r := range preIn  { preInQty[r.ProductID] = preInQty[r.ProductID].Add(r.Qty); preInAmt[r.ProductID] = preInAmt[r.ProductID].Add(r.Amount) }
	for _, r := range preOut { preOutQty[r.ProductID] = preOutQty[r.ProductID].Add(r.Qty) }
	for _, r := range preAdj { preAdjQty[r.ProductID] = preAdjQty[r.ProductID].Add(r.Qty) }
	for _, r := range inRows  { inQty[r.ProductID] = inQty[r.ProductID].Add(r.Qty); inAmt[r.ProductID] = inAmt[r.ProductID].Add(r.Amount) }
	for _, r := range outRows { outQty[r.ProductID] = outQty[r.ProductID].Add(r.Qty); outAmt[r.ProductID] = outAmt[r.ProductID].Add(r.Amount) }

	// ── build result ─────────────────────────────────────────────────────────
	rows := make([]StockStatementRow, 0, len(products))
	for _, p := range products {
		openQty := preInQty[p.ProductID].Add(preAdjQty[p.ProductID]).Sub(preOutQty[p.ProductID])
		iQty    := inQty[p.ProductID]
		iAmt    := inAmt[p.ProductID]
		oQty    := outQty[p.ProductID]
		oAmt    := outAmt[p.ProductID]
		closeQty := openQty.Add(iQty).Sub(oQty)

		// avg cost from opening inward amount
		var openAmt decimal.Decimal
		if preInQty[p.ProductID].IsPositive() {
			openAmt = preInAmt[p.ProductID]
		}
		closeAmt := openAmt.Add(iAmt).Sub(oAmt)

		rows = append(rows, StockStatementRow{
			ProductID:     p.ProductID,
			ProductName:   p.Name,
			UOM:           p.UOM,
			OpeningQty:    openQty,
			OpeningAmount: openAmt,
			InwardQty:     iQty,
			InwardAmount:  iAmt,
			OutwardQty:    oQty,
			OutwardAmount: oAmt,
			ClosingQty:    closeQty,
			ClosingAmount: closeAmt,
		})
	}
	return rows, nil
}

func (s *StockStatementService) GetLedger(productID uint, fromDate, toDate string) (decimal.Decimal, []StockLedgerRow, error) {
	// ── opening balance before period ────────────────────────────────────────
	type sumRow struct{ Qty decimal.Decimal }
	var openIn, openOut, openAdj sumRow

	s.db.Raw(`SELECT COALESCE(SUM(pbi.quantity),0) AS qty FROM purchase_bill_items pbi
		JOIN purchase_bills pb ON pb.id = pbi.bill_id
		WHERE pbi.product_id = ? AND pb.bill_date < ?`, productID, fromDate).Scan(&openIn)

	s.db.Raw(`SELECT COALESCE(SUM(mc.consumed_qty),0) AS qty FROM material_consumptions mc
		JOIN production_entries pe ON pe.id = mc.production_entry_id
		WHERE mc.material_product_id = ? AND pe.entry_date < ?`, productID, fromDate).Scan(&openOut)

	s.db.Raw(`SELECT COALESCE(SUM(adjustment_quantity),0) AS qty FROM stock_adjustments
		WHERE product_id = ? AND DATE(created_at) < ?`, productID, fromDate).Scan(&openAdj)

	opening := openIn.Qty.Add(openAdj.Qty).Sub(openOut.Qty)

	// ── transactions in period ───────────────────────────────────────────────
	type txRow struct {
		TxDate string
		Code   string
		TxType string
		Qty    decimal.Decimal
	}
	var txns []txRow

	s.db.Raw(`
		SELECT pb.bill_date AS tx_date, pb.bill_number AS code, 'INWARD' AS tx_type, pbi.quantity AS qty
		FROM purchase_bill_items pbi
		JOIN purchase_bills pb ON pb.id = pbi.bill_id
		WHERE pbi.product_id = ? AND pb.bill_date BETWEEN ? AND ?
		UNION ALL
		SELECT pe.entry_date AS tx_date, po.po_number AS code, 'OUTWARD' AS tx_type, mc.consumed_qty AS qty
		FROM material_consumptions mc
		JOIN production_entries pe ON pe.id = mc.production_entry_id
		JOIN production_orders po  ON po.id = pe.production_order_id
		WHERE mc.material_product_id = ? AND pe.entry_date BETWEEN ? AND ?
		ORDER BY tx_date ASC, tx_type ASC
	`, productID, fromDate, toDate, productID, fromDate, toDate).Scan(&txns)

	ledger := make([]StockLedgerRow, 0, len(txns))
	balance := opening
	for _, t := range txns {
		var inQty, outQty decimal.Decimal
		if t.TxType == "INWARD" {
			inQty = t.Qty
			balance = balance.Add(t.Qty)
		} else {
			outQty = t.Qty
			balance = balance.Sub(t.Qty)
		}
		ledger = append(ledger, StockLedgerRow{
			Date:           t.TxDate,
			Code:           t.Code,
			TxType:         t.TxType,
			InwardQty:      inQty,
			OutwardQty:     outQty,
			ClosingBalance: balance,
		})
	}
	return opening, ledger, nil
}
