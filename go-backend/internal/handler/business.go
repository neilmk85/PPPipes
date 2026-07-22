package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// BusinessHandler handles CRUD for all business-page models.
type BusinessHandler struct {
	db              *gorm.DB
	uploadsDir      string
	maxFileSize     int64
	pipePurchaseSvc *service.PipePurchaseService
}

func NewBusinessHandler(db *gorm.DB, uploadsDir string, maxFileSize int64, svc *service.PipePurchaseService) *BusinessHandler {
	return &BusinessHandler{db: db, uploadsDir: uploadsDir, maxFileSize: maxFileSize, pipePurchaseSvc: svc}
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func parseID(r *http.Request) (uint, error) {
	v, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	return uint(v), err
}

func applyDateRange(q *gorm.DB, r *http.Request) *gorm.DB {
	if f := r.URL.Query().Get("from"); f != "" {
		q = q.Where("date >= ?", f)
	}
	if t := r.URL.Query().Get("to"); t != "" {
		q = q.Where("date <= ?", t)
	}
	return q
}

// ─── Cement Bags ──────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListCementBags(w http.ResponseWriter, r *http.Request) {
	var rows []models.CementBag
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch cement bags")
		return
	}
	util.SendSuccess(w, "Cement bags retrieved", rows)
}

func (h *BusinessHandler) CreateCementBag(w http.ResponseWriter, r *http.Request) {
	var row models.CementBag
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create cement bag entry")
		return
	}
	util.SendSuccess(w, "Cement bag entry created", row)
}

func (h *BusinessHandler) UpdateCementBag(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.CementBag
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteCementBag(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.CementBag{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListVehicles(w http.ResponseWriter, r *http.Request) {
	var rows []models.Vehicle
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch vehicles")
		return
	}
	util.SendSuccess(w, "Vehicles retrieved", rows)
}

func (h *BusinessHandler) CreateVehicle(w http.ResponseWriter, r *http.Request) {
	var row models.Vehicle
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create vehicle entry")
		return
	}
	util.SendSuccess(w, "Vehicle entry created", row)
}

func (h *BusinessHandler) UpdateVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.Vehicle
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.Vehicle{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListMaintenance(w http.ResponseWriter, r *http.Request) {
	var rows []models.Maintenance
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch maintenance")
		return
	}
	util.SendSuccess(w, "Maintenance entries retrieved", rows)
}

func (h *BusinessHandler) CreateMaintenance(w http.ResponseWriter, r *http.Request) {
	var row models.Maintenance
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create maintenance entry")
		return
	}
	util.SendSuccess(w, "Maintenance entry created", row)
}

func (h *BusinessHandler) UpdateMaintenance(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.Maintenance
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteMaintenance(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.Maintenance{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Silo Fills ───────────────────────────────────────────────────────────────
// SiloFill records cement filled into a specific silo (1, 2, or 3) in MT.
// Silo 1 & 2 → Spinning; Silo 3 → Coating.

func (h *BusinessHandler) ListSiloFills(w http.ResponseWriter, r *http.Request) {
	var rows []models.SiloFill
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if siloNo := r.URL.Query().Get("silo"); siloNo != "" {
		q = q.Where("silo_number = ?", siloNo)
	}
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch silo fills")
		return
	}
	util.SendSuccess(w, "Silo fills retrieved", rows)
}

func (h *BusinessHandler) CreateSiloFill(w http.ResponseWriter, r *http.Request) {
	var row models.SiloFill
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if row.SiloNumber < 1 || row.SiloNumber > 3 {
		util.SendError(w, http.StatusBadRequest, "siloNumber must be 1, 2 or 3")
		return
	}
	if row.QuantityMT.IsZero() || row.QuantityMT.IsNegative() {
		util.SendError(w, http.StatusBadRequest, "quantityMt must be positive")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create silo fill")
		return
	}
	util.SendSuccess(w, "Silo fill created", row)
}

func (h *BusinessHandler) DeleteSiloFill(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.SiloFill{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete silo fill")
		return
	}
	util.SendSuccess(w, "Silo fill deleted", nil)
}

// ResetSilo3 POST /api/business/silo-3-reset
// Creates a reset record; GetSiloSummary will only count fills/consumption after this point.
func (h *BusinessHandler) ResetSilo3(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Notes string `json:"notes"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	reset := models.SiloReset{SiloNumber: 3, Notes: body.Notes}
	if err := h.db.Create(&reset).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to reset silo 3")
		return
	}
	util.SendSuccess(w, "Silo 3 reset to zero", reset)
}

// GetSiloSummary returns per-silo totals (filled MT, consumed MT from production, balance MT).
// Consumption is auto-derived from material_consumptions:
//   - Silo 1+2 (Spinning): cement consumed in SPINNING stage entries
//   - Silo 3 (Coating):    cement consumed in COATING stage entries
//
// Silo 3 respects the latest reset: only fills and coating consumption recorded
// after the reset timestamp are counted.
func (h *BusinessHandler) GetSiloSummary(w http.ResponseWriter, r *http.Request) {
	// 0. Check for latest Silo 3 reset
	var latestReset models.SiloReset
	var silo3ResetAt *time.Time
	if err := h.db.Where("silo_number = 3").Order("created_at DESC").First(&latestReset).Error; err == nil {
		t := latestReset.CreatedAt
		silo3ResetAt = &t
	}

	// 1. Filled per silo (Silo 3 filtered by reset time if applicable)
	type FillRow struct {
		SiloNumber int     `json:"siloNumber"`
		TotalMT    float64 `json:"totalMt"`
	}
	var fills []FillRow
	h.db.Model(&models.SiloFill{}).
		Select("silo_number, COALESCE(SUM(quantity_mt), 0) as total_mt").
		Group("silo_number").
		Scan(&fills)

	filledMT := map[int]float64{1: 0, 2: 0, 3: 0}
	for _, f := range fills {
		filledMT[f.SiloNumber] = f.TotalMT
	}

	// Recalculate Silo 3 fills post-reset
	if silo3ResetAt != nil {
		var silo3Total float64
		h.db.Model(&models.SiloFill{}).
			Select("COALESCE(SUM(quantity_mt), 0)").
			Where("silo_number = 3 AND created_at > ?", silo3ResetAt).
			Scan(&silo3Total)
		filledMT[3] = silo3Total
	}

	// 2. Cement consumed by stage — quantities may be in kg or MT; normalise to MT
	cementConsumedMT := func(stageType string, afterTime *time.Time) float64 {
		var total float64
		query := `
			SELECT COALESCE(SUM(
				CASE
					WHEN UPPER(mc.uom) = 'MT' THEN mc.consumed_qty
					ELSE mc.consumed_qty / 1000
				END
			), 0)
			FROM material_consumptions mc
			JOIN production_entries pe ON mc.production_entry_id = pe.id
			JOIN products p            ON mc.material_product_id  = p.id
			WHERE pe.stage_type = ?
			  AND LOWER(p.name) LIKE '%cement%'`
		if afterTime != nil {
			query += " AND pe.created_at > ?"
			h.db.Raw(query, stageType, afterTime).Scan(&total)
		} else {
			h.db.Raw(query, stageType).Scan(&total)
		}
		return total
	}

	spinningConsumed := cementConsumedMT("SPINNING", nil)
	coatingConsumed  := cementConsumedMT("COATING", silo3ResetAt)

	type SiloStat struct {
		SiloNumber  int     `json:"siloNumber"`
		Label       string  `json:"label"`
		Stage       string  `json:"stage"`
		TotalFilledMT   float64 `json:"totalFilledMt"`
		ConsumedMT      float64 `json:"consumedMt"`
		BalanceMT       float64 `json:"balanceMt"`
	}

	// Distribute spinning consumption across Silo 1+2 proportional to fills,
	// or split evenly if no fills yet.
	s1Filled := filledMT[1]
	s2Filled := filledMT[2]
	spinTotal := s1Filled + s2Filled
	var s1Consumed, s2Consumed float64
	if spinTotal > 0 {
		s1Consumed = spinningConsumed * (s1Filled / spinTotal)
		s2Consumed = spinningConsumed * (s2Filled / spinTotal)
	} else {
		s1Consumed = spinningConsumed / 2
		s2Consumed = spinningConsumed / 2
	}

	summary := []SiloStat{
		{
			SiloNumber: 1,
			Label:      "Silo 1",
			Stage:      "SPINNING",
			TotalFilledMT: s1Filled,
			ConsumedMT:    s1Consumed,
			BalanceMT:     s1Filled - s1Consumed,
		},
		{
			SiloNumber: 2,
			Label:      "Silo 2",
			Stage:      "SPINNING",
			TotalFilledMT: s2Filled,
			ConsumedMT:    s2Consumed,
			BalanceMT:     s2Filled - s2Consumed,
		},
		{
			SiloNumber: 3,
			Label:      "Silo 3",
			Stage:      "COATING",
			TotalFilledMT: filledMT[3],
			ConsumedMT:    coatingConsumed,
			BalanceMT:     filledMT[3] - coatingConsumed,
		},
	}

	type resp struct {
		Silos            []SiloStat `json:"silos"`
		SpinningConsumedMT float64  `json:"spinningConsumedMt"`
		CoatingConsumedMT  float64  `json:"coatingConsumedMt"`
	}
	util.SendSuccess(w, "Silo summary retrieved", resp{
		Silos:              summary,
		SpinningConsumedMT: spinningConsumed,
		CoatingConsumedMT:  coatingConsumed,
	})
}

// ─── Silo ─────────────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListSilos(w http.ResponseWriter, r *http.Request) {
	var rows []models.Silo
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch silo entries")
		return
	}
	util.SendSuccess(w, "Silo entries retrieved", rows)
}

func (h *BusinessHandler) CreateSilo(w http.ResponseWriter, r *http.Request) {
	var row models.Silo
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create silo entry")
		return
	}
	util.SendSuccess(w, "Silo entry created", row)
}

func (h *BusinessHandler) UpdateSilo(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.Silo
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteSilo(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.Silo{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Silo Extraction ──────────────────────────────────────────────────────────

func (h *BusinessHandler) ListSiloExtractions(w http.ResponseWriter, r *http.Request) {
	var rows []models.SiloExtraction
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch silo extractions")
		return
	}
	util.SendSuccess(w, "Silo extractions retrieved", rows)
}

func (h *BusinessHandler) CreateSiloExtraction(w http.ResponseWriter, r *http.Request) {
	var row models.SiloExtraction
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create silo extraction entry")
		return
	}
	util.SendSuccess(w, "Silo extraction entry created", row)
}

func (h *BusinessHandler) UpdateSiloExtraction(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.SiloExtraction
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteSiloExtraction(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.SiloExtraction{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Diesel Maintenance ───────────────────────────────────────────────────────

func (h *BusinessHandler) ListDieselMaintenance(w http.ResponseWriter, r *http.Request) {
	var rows []models.DieselMaintenance
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch diesel maintenance")
		return
	}
	util.SendSuccess(w, "Diesel maintenance entries retrieved", rows)
}

func (h *BusinessHandler) CreateDieselMaintenance(w http.ResponseWriter, r *http.Request) {
	var row models.DieselMaintenance
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create diesel maintenance entry")
		return
	}
	util.SendSuccess(w, "Diesel maintenance entry created", row)
}

func (h *BusinessHandler) UpdateDieselMaintenance(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.DieselMaintenance
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteDieselMaintenance(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.DieselMaintenance{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Store Room Material ──────────────────────────────────────────────────────

func (h *BusinessHandler) ListStoreRoomMaterials(w http.ResponseWriter, r *http.Request) {
	var rows []models.StoreRoomMaterial
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch store room materials")
		return
	}
	util.SendSuccess(w, "Store room materials retrieved", rows)
}

func (h *BusinessHandler) CreateStoreRoomMaterial(w http.ResponseWriter, r *http.Request) {
	var row models.StoreRoomMaterial
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create store room material entry")
		return
	}
	util.SendSuccess(w, "Store room material entry created", row)
}

func (h *BusinessHandler) UpdateStoreRoomMaterial(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.StoreRoomMaterial
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteStoreRoomMaterial(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.StoreRoomMaterial{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Extra Vehicles ───────────────────────────────────────────────────────────

func (h *BusinessHandler) ListExtraVehicles(w http.ResponseWriter, r *http.Request) {
	var rows []models.ExtraVehicle
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch extra vehicles")
		return
	}
	util.SendSuccess(w, "Extra vehicles retrieved", rows)
}

func (h *BusinessHandler) CreateExtraVehicle(w http.ResponseWriter, r *http.Request) {
	var row models.ExtraVehicle
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create extra vehicle entry")
		return
	}
	util.SendSuccess(w, "Extra vehicle entry created", row)
}

func (h *BusinessHandler) UpdateExtraVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.ExtraVehicle
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteExtraVehicle(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.ExtraVehicle{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Testing Lab ──────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListTestingLabs(w http.ResponseWriter, r *http.Request) {
	var rows []models.TestingLab
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch testing lab entries")
		return
	}
	util.SendSuccess(w, "Testing lab entries retrieved", rows)
}

func (h *BusinessHandler) CreateTestingLab(w http.ResponseWriter, r *http.Request) {
	var row models.TestingLab
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create testing lab entry")
		return
	}
	util.SendSuccess(w, "Testing lab entry created", row)
}

func (h *BusinessHandler) UpdateTestingLab(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.TestingLab
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteTestingLab(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.TestingLab{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Conversion ───────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListConversions(w http.ResponseWriter, r *http.Request) {
	var rows []models.BizConversion
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch conversions")
		return
	}
	util.SendSuccess(w, "Conversions retrieved", rows)
}

func (h *BusinessHandler) CreateConversion(w http.ResponseWriter, r *http.Request) {
	var row models.BizConversion
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create conversion entry")
		return
	}
	util.SendSuccess(w, "Conversion entry created", row)
}

func (h *BusinessHandler) UpdateConversion(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.BizConversion
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteConversion(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.BizConversion{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Cutting ──────────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListCuttings(w http.ResponseWriter, r *http.Request) {
	var rows []models.BizCutting
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch cuttings")
		return
	}
	util.SendSuccess(w, "Cuttings retrieved", rows)
}

func (h *BusinessHandler) CreateCutting(w http.ResponseWriter, r *http.Request) {
	var row models.BizCutting
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if row.FromSheet == "" || row.ToSheet == "" {
		util.SendError(w, http.StatusBadRequest, "From sheet and To sheet are required")
		return
	}
	if row.Quantity <= 0 {
		util.SendError(w, http.StatusBadRequest, "Quantity must be greater than 0")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create cutting entry")
		return
	}
	util.SendSuccess(w, "Cutting entry created", row)
}

func (h *BusinessHandler) UpdateCutting(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.BizCutting
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteCutting(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.BizCutting{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Discard ──────────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListDiscards(w http.ResponseWriter, r *http.Request) {
	var rows []models.Discard
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch discards")
		return
	}
	util.SendSuccess(w, "Discards retrieved", rows)
}

func (h *BusinessHandler) CreateDiscard(w http.ResponseWriter, r *http.Request) {
	var row models.Discard
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create discard entry")
		return
	}
	util.SendSuccess(w, "Discard entry created", row)
}

func (h *BusinessHandler) UpdateDiscard(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.Discard
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeleteDiscard(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.Discard{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── PDI ──────────────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListPDIs(w http.ResponseWriter, r *http.Request) {
	var rows []models.PDI
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch PDI entries")
		return
	}
	util.SendSuccess(w, "PDI entries retrieved", rows)
}

func (h *BusinessHandler) CreatePDI(w http.ResponseWriter, r *http.Request) {
	var row models.PDI
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create PDI entry")
		return
	}
	util.SendSuccess(w, "PDI entry created", row)
}

func (h *BusinessHandler) UpdatePDI(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.PDI
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update entry")
		return
	}
	util.SendSuccess(w, "Entry updated", row)
}

func (h *BusinessHandler) DeletePDI(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.PDI{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete entry")
		return
	}
	util.SendSuccess(w, "Entry deleted", nil)
}

// ─── Loading Records ──────────────────────────────────────────────────────────

func (h *BusinessHandler) ListLoadingRecords(w http.ResponseWriter, r *http.Request) {
	var rows []models.LoadingRecord
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if pipeName := r.URL.Query().Get("pipeName"); pipeName != "" {
		q = q.Where("pipe_name = ?", pipeName)
	}
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch loading records")
		return
	}
	util.SendSuccess(w, "Loading records retrieved", rows)
}

func (h *BusinessHandler) GetLoadingRecord(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.LoadingRecord
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Loading record not found")
		return
	}
	util.SendSuccess(w, "OK", row)
}

func (h *BusinessHandler) CreateLoadingRecord(w http.ResponseWriter, r *http.Request) {
	var row models.LoadingRecord
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if row.DeliveryChallanNo == "" {
		dcNo, err := util.GenerateDCNumber(h.db)
		if err == nil {
			row.DeliveryChallanNo = dcNo
		}
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create loading record")
		return
	}
	util.SendSuccess(w, "Loading record created", row)
}

func (h *BusinessHandler) PeekNextDCNumber(w http.ResponseWriter, r *http.Request) {
	next, err := util.PeekNextDCNumber(h.db)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to generate DC number")
		return
	}
	util.SendSuccess(w, "Next DC number", map[string]string{"nextNumber": next})
}

func (h *BusinessHandler) UpdateLoadingRecord(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.LoadingRecord
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update loading record")
		return
	}
	util.SendSuccess(w, "Loading record updated", row)
}

func (h *BusinessHandler) DeleteLoadingRecord(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.LoadingRecord{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete loading record")
		return
	}
	util.SendSuccess(w, "Loading record deleted", nil)
}

func (h *BusinessHandler) ConvertToInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}

	var rec models.LoadingRecord
	if err := h.db.First(&rec, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Loading record not found")
		return
	}
	if rec.InvoiceID != nil {
		util.SendError(w, http.StatusConflict, "Already converted to invoice")
		return
	}

	var req struct {
		OutletID  int     `json:"outletId"`
		UnitPrice float64 `json:"unitPrice"`
		TaxRate   float64 `json:"taxRate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Look up customer by name to get customer_id (optional)
	var customerID *int
	if rec.CustomerName != "" {
		var cust models.Customer
		if err := h.db.Where("name = ? AND outlet_id = ?", rec.CustomerName, req.OutletID).First(&cust).Error; err == nil {
			cid := int(cust.ID)
			customerID = &cid
		}
	}

	// Generate invoice number
	invoiceNum, err := util.GenerateInvoiceNumber(h.db)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to generate invoice number")
		return
	}

	issueDate, _ := time.Parse("2006-01-02", string(rec.Date))
	if issueDate.IsZero() {
		issueDate = time.Now()
	}

	hundred := decimal.NewFromInt(100)
	qtyDec := decimal.NewFromInt(int64(rec.Quantity))
	priceDec := decimal.NewFromFloat(req.UnitPrice)
	taxDec := decimal.NewFromFloat(req.TaxRate)

	lineTotal := qtyDec.Mul(priceDec)
	taxAmt := lineTotal.Mul(taxDec).Div(hundred)
	total := lineTotal.Add(taxAmt)

	invoice := models.Invoice{
		InvoiceNumber: invoiceNum,
		CustomerID:    customerID,
		OutletID:      req.OutletID,
		IssueDate:     issueDate,
		Status:        models.InvoiceStatusDraft,
		Subtotal:      lineTotal,
		TaxAmount:     taxAmt,
		TotalAmount:   total,
	}
	if rec.CustomerPONo != "" {
		invoice.PONumber = &rec.CustomerPONo
	}

	if err := h.db.Create(&invoice).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create invoice")
		return
	}

	item := models.InvoiceItem{
		InvoiceID:   invoice.ID,
		ProductName: rec.PipeName,
		Quantity:    qtyDec,
		UnitPrice:   priceDec,
		TaxRate:     taxDec,
		LineTotal:   lineTotal,
	}
	if err := h.db.Create(&item).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create invoice item")
		return
	}

	// Link invoice back to loading record
	invID := invoice.ID
	if err := h.db.Model(&rec).Updates(map[string]interface{}{
		"invoice_id":     invID,
		"invoice_number": invoiceNum,
	}).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to link invoice")
		return
	}
	rec.InvoiceID = &invID
	rec.InvoiceNumber = invoiceNum

	util.SendSuccess(w, "Invoice created", rec)
}

func (h *BusinessHandler) LinkInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}

	var rec models.LoadingRecord
	if err := h.db.First(&rec, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Loading record not found")
		return
	}

	var req struct {
		InvoiceID     int    `json:"invoiceId"`
		InvoiceNumber string `json:"invoiceNumber"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.db.Model(&rec).Updates(map[string]interface{}{
		"invoice_id":     req.InvoiceID,
		"invoice_number": req.InvoiceNumber,
	}).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to link invoice")
		return
	}
	rec.InvoiceID = &req.InvoiceID
	rec.InvoiceNumber = req.InvoiceNumber

	util.SendSuccess(w, "Invoice linked", rec)
}

// ─── Labour ───────────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListLabour(w http.ResponseWriter, r *http.Request) {
	var rows []models.Labour
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch labour entries")
		return
	}
	util.SendSuccess(w, "Labour entries retrieved", rows)
}

func (h *BusinessHandler) CreateLabour(w http.ResponseWriter, r *http.Request) {
	var row models.Labour
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create labour entry")
		return
	}
	util.SendSuccess(w, "Labour entry created", row)
}

func (h *BusinessHandler) UpdateLabour(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.Labour
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Labour entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update labour entry")
		return
	}
	util.SendSuccess(w, "Labour entry updated", row)
}

func (h *BusinessHandler) DeleteLabour(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.Labour{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete labour entry")
		return
	}
	util.SendSuccess(w, "Labour entry deleted", nil)
}

// ─── Business Rate Config ─────────────────────────────────────────────────────

// GetBusinessRateConfig returns the single config row (ID=1), creating defaults if absent.
func (h *BusinessHandler) GetBusinessRateConfig(w http.ResponseWriter, r *http.Request) {
	var cfg models.BusinessRateConfig
	res := h.db.First(&cfg, 1)
	if res.Error != nil {
		// No row yet — return empty defaults
		cfg = models.BusinessRateConfig{ID: 1}
	}
	util.SendSuccess(w, "Business rate config fetched", cfg)
}

// UpdateBusinessRateConfig upserts the single config row (ID always = 1).
func (h *BusinessHandler) UpdateBusinessRateConfig(w http.ResponseWriter, r *http.Request) {
	var input models.BusinessRateConfig
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Check whether the singleton row already exists
	var existing models.BusinessRateConfig
	result := h.db.First(&existing, 1)
	if result.Error != nil {
		// Row doesn't exist yet — create it
		input.ID = 1
		if err := h.db.Create(&input).Error; err != nil {
			util.SendError(w, http.StatusInternalServerError, "Failed to save rate config")
			return
		}
		util.SendSuccess(w, "Business rate config saved", input)
		return
	}

	// Row exists — update only the rate fields
	existing.SmallBedRate      = input.SmallBedRate
	existing.LargeBedRate      = input.LargeBedRate
	existing.LabourRatePerDay  = input.LabourRatePerDay
	existing.OTRatePerHour     = input.OTRatePerHour
	existing.FabricationRateKg = input.FabricationRateKg
	if err := h.db.Save(&existing).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to save rate config")
		return
	}
	util.SendSuccess(w, "Business rate config saved", existing)
}

// ─── Coating Contractor Rates ─────────────────────────────────────────────────

// GetCoatingRates returns all per-diameter coating contractor rates.
func (h *BusinessHandler) GetCoatingRates(w http.ResponseWriter, r *http.Request) {
	var rates []models.CoatingContractorRate
	h.db.Order("diameter_mm ASC").Find(&rates)
	util.SendSuccess(w, "Coating rates fetched", rates)
}

// UpsertCoatingRates bulk-upserts coating rates. Body: [{diameterMm, ratePerPipe}].
func (h *BusinessHandler) UpsertCoatingRates(w http.ResponseWriter, r *http.Request) {
	var input []models.CoatingContractorRate
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	for i := range input {
		var existing models.CoatingContractorRate
		res := h.db.Where("diameter_mm = ?", input[i].DiameterMm).First(&existing)
		if res.Error != nil {
			if err := h.db.Create(&input[i]).Error; err != nil {
				util.SendError(w, http.StatusInternalServerError, "Failed to save coating rate")
				return
			}
		} else {
			existing.RatePerPipe = input[i].RatePerPipe
			if err := h.db.Save(&existing).Error; err != nil {
				util.SendError(w, http.StatusInternalServerError, "Failed to save coating rate")
				return
			}
		}
	}
	var rates []models.CoatingContractorRate
	h.db.Order("diameter_mm ASC").Find(&rates)
	util.SendSuccess(w, "Coating rates saved", rates)
}

// ─── Spinning Bed Rates ───────────────────────────────────────────────────────

// GetSpinningRates returns all spinning bed rates ordered by bed_size, diameter_mm.
func (h *BusinessHandler) GetSpinningRates(w http.ResponseWriter, r *http.Request) {
	var rates []models.SpinningBedRate
	h.db.Order("bed_size ASC, diameter_mm ASC").Find(&rates)
	util.SendSuccess(w, "Spinning rates fetched", rates)
}

// UpsertSpinningRates bulk-upserts spinning rates. Body: [{bedSize, diameterMm, ratePerPipe}].
func (h *BusinessHandler) UpsertSpinningRates(w http.ResponseWriter, r *http.Request) {
	var input []models.SpinningBedRate
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	for i := range input {
		var existing models.SpinningBedRate
		res := h.db.Where("bed_size = ? AND diameter_mm = ?", input[i].BedSize, input[i].DiameterMm).First(&existing)
		if res.Error != nil {
			if err := h.db.Create(&input[i]).Error; err != nil {
				util.SendError(w, http.StatusInternalServerError, "Failed to save spinning rate")
				return
			}
		} else {
			existing.RatePerPipe = input[i].RatePerPipe
			if err := h.db.Save(&existing).Error; err != nil {
				util.SendError(w, http.StatusInternalServerError, "Failed to save spinning rate")
				return
			}
		}
	}
	var rates []models.SpinningBedRate
	h.db.Order("bed_size ASC, diameter_mm ASC").Find(&rates)
	util.SendSuccess(w, "Spinning rates saved", rates)
}

// ─── Process Contractor Assignments ──────────────────────────────────────────

// GetProcessContractors returns all process→contractor assignments with supplier info.
func (h *BusinessHandler) GetProcessContractors(w http.ResponseWriter, r *http.Request) {
	var assignments []models.ProcessContractorAssignment
	if err := h.db.Preload("Supplier").Find(&assignments).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch process contractors")
		return
	}
	util.SendSuccess(w, "Process contractors retrieved", assignments)
}

// UpsertProcessContractor saves a process→contractor mapping (one per processType).
// Body: { processType: string, supplierId: int }
func (h *BusinessHandler) UpsertProcessContractor(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProcessType string `json:"processType"`
		SupplierID  int    `json:"supplierId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.ProcessType == "" || body.SupplierID == 0 {
		util.SendError(w, http.StatusBadRequest, "processType and supplierId are required")
		return
	}

	var a models.ProcessContractorAssignment
	err := h.db.Where("process_type = ?", body.ProcessType).First(&a).Error
	if err != nil {
		a = models.ProcessContractorAssignment{ProcessType: body.ProcessType, SupplierID: body.SupplierID}
		if err := h.db.Create(&a).Error; err != nil {
			util.SendError(w, http.StatusInternalServerError, "Failed to create assignment")
			return
		}
	} else {
		if err := h.db.Model(&a).Update("supplier_id", body.SupplierID).Error; err != nil {
			util.SendError(w, http.StatusInternalServerError, "Failed to update assignment")
			return
		}
	}

	h.db.Preload("Supplier").First(&a, a.ID)
	util.SendSuccess(w, "Process contractor saved", a)
}

// DeleteProcessContractor removes a specific process→contractor assignment by ID.
func (h *BusinessHandler) DeleteProcessContractor(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	if err := h.db.Delete(&models.ProcessContractorAssignment{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete assignment")
		return
	}
	util.SendSuccess(w, "Process contractor removed", nil)
}

// ─── Challan Photo ────────────────────────────────────────────────────────────

// UploadChallanPhoto POST /api/business/loading-records/{id}/challan-photo
func (h *BusinessHandler) UploadChallanPhoto(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}

	var rec models.LoadingRecord
	if err := h.db.First(&rec, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Loading record not found")
		return
	}

	if err := r.ParseMultipartForm(h.maxFileSize); err != nil {
		util.SendError(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "No file uploaded (field name: photo)")
		return
	}
	defer file.Close()

	// Delete old photo file if it exists
	if rec.ChallanPhotoURL != nil && *rec.ChallanPhotoURL != "" {
		oldFile := filepath.Join(h.uploadsDir, strings.TrimPrefix(*rec.ChallanPhotoURL, "/uploads/"))
		os.Remove(oldFile) // best-effort
	}

	// Persist new file
	if err := os.MkdirAll(h.uploadsDir, os.ModePerm); err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create upload directory")
		return
	}
	filename := fmt.Sprintf("challan_%d_%s", id, header.Filename)
	destPath := filepath.Join(h.uploadsDir, filename)

	out, err := os.Create(destPath)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	defer out.Close()
	if _, err := io.Copy(out, file); err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to write file")
		return
	}

	photoURL := "/uploads/" + filename
	if err := h.db.Model(&rec).Update("challan_photo_url", photoURL).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update record")
		return
	}
	rec.ChallanPhotoURL = &photoURL
	util.SendSuccess(w, "Challan photo uploaded", rec)
}

// DeleteChallanPhoto DELETE /api/business/loading-records/{id}/challan-photo
func (h *BusinessHandler) DeleteChallanPhoto(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}

	var rec models.LoadingRecord
	if err := h.db.First(&rec, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Loading record not found")
		return
	}

	if rec.ChallanPhotoURL != nil && *rec.ChallanPhotoURL != "" {
		oldFile := filepath.Join(h.uploadsDir, strings.TrimPrefix(*rec.ChallanPhotoURL, "/uploads/"))
		os.Remove(oldFile)
	}

	if err := h.db.Model(&rec).Update("challan_photo_url", nil).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to clear photo")
		return
	}
	rec.ChallanPhotoURL = nil
	util.SendSuccess(w, "Challan photo removed", rec)
}

// ─── Third-Party Pipe Purchases ───────────────────────────────────────────────

func (h *BusinessHandler) ListPipePurchases(w http.ResponseWriter, r *http.Request) {
	outletID, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil || outletID == 0 {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	records, err := h.pipePurchaseSvc.List(outletID, from, to)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch pipe purchases")
		return
	}
	util.SendSuccess(w, "Pipe purchases fetched", records)
}

func (h *BusinessHandler) CreatePipePurchase(w http.ResponseWriter, r *http.Request) {
	var req models.ThirdPartyPipePurchase
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.OutletID == 0 {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}
	if req.PipeName == "" {
		util.SendError(w, http.StatusBadRequest, "pipeName is required")
		return
	}
	if req.Quantity <= 0 {
		util.SendError(w, http.StatusBadRequest, "quantity must be greater than zero")
		return
	}
	record, err := h.pipePurchaseSvc.Create(req)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create pipe purchase")
		return
	}
	util.SendSuccess(w, "Pipe purchase recorded and inventory updated", record)
}

func (h *BusinessHandler) UpdatePipePurchase(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var req models.ThirdPartyPipePurchase
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	record, err := h.pipePurchaseSvc.Update(id, req)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update pipe purchase")
		return
	}
	util.SendSuccess(w, "Pipe purchase updated", record)
}

func (h *BusinessHandler) DeletePipePurchase(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.pipePurchaseSvc.Delete(id); err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete pipe purchase")
		return
	}
	util.SendSuccess(w, "Pipe purchase deleted and inventory reversed", nil)
}

// ─── Extra Fab ────────────────────────────────────────────────────────────────

func (h *BusinessHandler) ListExtraFab(w http.ResponseWriter, r *http.Request) {
	var rows []models.BizExtraFab
	q := applyDateRange(h.db.Order("date DESC, id DESC"), r)
	if err := q.Find(&rows).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to fetch extra fab entries")
		return
	}
	util.SendSuccess(w, "Extra fab entries retrieved", rows)
}

func (h *BusinessHandler) CreateExtraFab(w http.ResponseWriter, r *http.Request) {
	var row models.BizExtraFab
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.db.Create(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to create extra fab entry")
		return
	}
	util.SendSuccess(w, "Extra fab entry created", row)
}

func (h *BusinessHandler) UpdateExtraFab(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var row models.BizExtraFab
	if err := h.db.First(&row, id).Error; err != nil {
		util.SendError(w, http.StatusNotFound, "Entry not found")
		return
	}
	if err := json.NewDecoder(r.Body).Decode(&row); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	row.ID = id
	if err := h.db.Save(&row).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to update extra fab entry")
		return
	}
	util.SendSuccess(w, "Extra fab entry updated", row)
}

func (h *BusinessHandler) DeleteExtraFab(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.db.Delete(&models.BizExtraFab{}, id).Error; err != nil {
		util.SendError(w, http.StatusInternalServerError, "Failed to delete extra fab entry")
		return
	}
	util.SendSuccess(w, "Extra fab entry deleted", nil)
}
