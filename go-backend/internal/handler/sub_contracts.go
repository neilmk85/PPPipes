package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type SubContractHandler struct {
	svc *service.SubContractService
}

func NewSubContractHandler(svc *service.SubContractService) *SubContractHandler {
	return &SubContractHandler{svc: svc}
}

type subContractItemReq struct {
	Description string  `json:"description"`
	Unit        string  `json:"unit"`
	Qty         float64 `json:"qty"`
	Rate        float64 `json:"rate"`
	Amount      float64 `json:"amount"`
	SortOrder   int     `json:"sortOrder"`
}

type subContractRequest struct {
	SiteProjectID      int                  `json:"siteProjectId"`
	AgreementNumber    string               `json:"agreementNumber"`
	AgreementDate      string               `json:"agreementDate"`
	MainContractorName string               `json:"mainContractorName"`
	ProjectName        string               `json:"projectName"`
	Location           *string              `json:"location"`
	ScopeDescription   *string              `json:"scopeDescription"`
	StartDate          *string              `json:"startDate"`
	EndDate            *string              `json:"endDate"`
	ContractValue      float64              `json:"contractValue"`
	Status             string               `json:"status"`
	Notes              *string              `json:"notes"`
	Items              []subContractItemReq `json:"items"`
}

func (h *SubContractHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	projectID, _ := strconv.Atoi(r.URL.Query().Get("siteProjectId"))
	status := r.URL.Query().Get("status")
	list, err := h.svc.GetAll(projectID, status)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Sub-contracts retrieved", list)
}

func (h *SubContractHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.PathValue("id"))
	sc, err := h.svc.GetByID(id)
	if err != nil {
		util.SendError(w, http.StatusNotFound, "Sub-contract not found")
		return
	}
	util.SendSuccess(w, "Sub-contract retrieved", sc)
}

func (h *SubContractHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req subContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	sc := h.reqToModel(0, req)
	if err := h.svc.Create(sc); err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(util.SuccessResponse("Sub-contract created", sc))
}

func (h *SubContractHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.PathValue("id"))
	var req subContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	sc := h.reqToModel(id, req)
	if err := h.svc.Update(id, sc); err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Sub-contract updated", sc)
}

func (h *SubContractHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.PathValue("id"))
	var body struct {
		Status string `json:"status"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if err := h.svc.UpdateStatus(id, body.Status); err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Status updated", nil)
}

func (h *SubContractHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.PathValue("id"))
	if err := h.svc.Delete(id); err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Sub-contract deleted", nil)
}

func (h *SubContractHandler) reqToModel(id int, req subContractRequest) *models.SubContract {
	items := make([]models.SubContractItem, len(req.Items))
	for i, it := range req.Items {
		items[i] = models.SubContractItem{
			Description: it.Description,
			Unit:        it.Unit,
			Qty:         decimal.NewFromFloat(it.Qty),
			Rate:        decimal.NewFromFloat(it.Rate),
			Amount:      decimal.NewFromFloat(it.Amount),
			SortOrder:   it.SortOrder,
		}
	}
	return &models.SubContract{
		ID:                 id,
		SiteProjectID:      req.SiteProjectID,
		AgreementNumber:    req.AgreementNumber,
		AgreementDate:      req.AgreementDate,
		MainContractorName: req.MainContractorName,
		ProjectName:        req.ProjectName,
		Location:           req.Location,
		ScopeDescription:   req.ScopeDescription,
		StartDate:          req.StartDate,
		EndDate:            req.EndDate,
		ContractValue:      decimal.NewFromFloat(req.ContractValue),
		Status:             req.Status,
		Notes:              req.Notes,
		Items:              items,
	}
}
