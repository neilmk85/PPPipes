/**
 * Business-pages API service.
 * All endpoints live under /api/business/...
 * Responses follow the shape: { success, message, data, timestamp }
 */
import api from './api'

// ─── shared ───────────────────────────────────────────────────────────────────

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data
}

function buildParams(from?: string, to?: string) {
  const p: Record<string, string> = {}
  if (from) p.from = from
  if (to)   p.to   = to
  return p
}

// ─── Cement Bags ──────────────────────────────────────────────────────────────

export interface CementBagEntry {
  id: number
  date: string
  quantity: number
  notes: string
  createdAt: string
  updatedAt: string
}

export const cementBagsApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: CementBagEntry[] }>('/business/cement-bags', { params: buildParams(from, to) })
      .then(unwrap<CementBagEntry[]>),

  create: (data: Omit<CementBagEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: CementBagEntry }>('/business/cement-bags', data).then(unwrap<CementBagEntry>),

  update: (id: number, data: Omit<CementBagEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: CementBagEntry }>(`/business/cement-bags/${id}`, data).then(unwrap<CementBagEntry>),

  delete: (id: number) =>
    api.delete(`/business/cement-bags/${id}`),
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export interface VehicleEntry {
  id: number
  date: string
  craneEnabled: boolean
  craneDiesel:  string
  craneHours:   string
  jcbEnabled:   boolean
  jcbDiesel:    string
  jcbHours:     string
  notes:        string
  createdAt:    string
  updatedAt:    string
}

export const vehiclesApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: VehicleEntry[] }>('/business/vehicles', { params: buildParams(from, to) })
      .then(unwrap<VehicleEntry[]>),

  create: (data: Omit<VehicleEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: VehicleEntry }>('/business/vehicles', data).then(unwrap<VehicleEntry>),

  update: (id: number, data: Omit<VehicleEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: VehicleEntry }>(`/business/vehicles/${id}`, data).then(unwrap<VehicleEntry>),

  delete: (id: number) =>
    api.delete(`/business/vehicles/${id}`),
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export interface MaintenanceEntry {
  id:        number
  date:      string
  process:   string
  vendor:    string
  amount:    string
  notes:     string
  createdAt: string
  updatedAt: string
}

export const maintenanceApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: MaintenanceEntry[] }>('/business/maintenance', { params: buildParams(from, to) })
      .then(unwrap<MaintenanceEntry[]>),

  create: (data: Omit<MaintenanceEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: MaintenanceEntry }>('/business/maintenance', data).then(unwrap<MaintenanceEntry>),

  update: (id: number, data: Omit<MaintenanceEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: MaintenanceEntry }>(`/business/maintenance/${id}`, data).then(unwrap<MaintenanceEntry>),

  delete: (id: number) =>
    api.delete(`/business/maintenance/${id}`),
}

// ─── Silo Fills (new model) ───────────────────────────────────────────────────

export interface SiloFill {
  id:         number
  date:       string
  siloNumber: number   // 1, 2, or 3
  quantityMt: string   // decimal string from backend
  notes:      string
  createdAt:  string
  updatedAt:  string
}

export interface SiloStat {
  siloNumber:    number
  label:         string
  stage:         string
  totalFilledMt: number
  consumedMt:    number
  balanceMt:     number
}

export interface SiloSummary {
  silos:               SiloStat[]
  spinningConsumedMt:  number
  coatingConsumedMt:   number
}

export const siloFillsApi = {
  list: (params?: { from?: string; to?: string; silo?: number }) =>
    api.get<{ data: SiloFill[] }>('/business/silo-fills', { params })
      .then(unwrap<SiloFill[]>),

  create: (data: { date: string; siloNumber: number; quantityMt: number; notes?: string }) =>
    api.post<{ data: SiloFill }>('/business/silo-fills', data).then(unwrap<SiloFill>),

  delete: (id: number) =>
    api.delete(`/business/silo-fills/${id}`),

  summary: () =>
    api.get<{ data: SiloSummary }>('/business/silo-summary').then(unwrap<SiloSummary>),
}

// ─── Silo (legacy) ────────────────────────────────────────────────────────────

export interface SiloEntry {
  id:         number
  date:       string
  silo1Value: string
  silo1Unit:  string
  silo2Value: string
  silo2Unit:  string
  silo3Value: string
  silo3Unit:  string
  notes:      string
  createdAt:  string
  updatedAt:  string
}

export const silosApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: SiloEntry[] }>('/business/silos', { params: buildParams(from, to) })
      .then(unwrap<SiloEntry[]>),

  create: (data: Omit<SiloEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: SiloEntry }>('/business/silos', data).then(unwrap<SiloEntry>),

  update: (id: number, data: Omit<SiloEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: SiloEntry }>(`/business/silos/${id}`, data).then(unwrap<SiloEntry>),

  delete: (id: number) =>
    api.delete(`/business/silos/${id}`),
}

// ─── Silo Extraction ──────────────────────────────────────────────────────────

export interface SiloExtractionEntry {
  id:         number
  date:       string
  silo1Value: string
  silo1Unit:  string
  silo2Value: string
  silo2Unit:  string
  silo3Value: string
  silo3Unit:  string
  notes:      string
  createdAt:  string
  updatedAt:  string
}

export const siloExtractionsApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: SiloExtractionEntry[] }>('/business/silo-extractions', { params: buildParams(from, to) })
      .then(unwrap<SiloExtractionEntry[]>),

  create: (data: Omit<SiloExtractionEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: SiloExtractionEntry }>('/business/silo-extractions', data).then(unwrap<SiloExtractionEntry>),

  update: (id: number, data: Omit<SiloExtractionEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: SiloExtractionEntry }>(`/business/silo-extractions/${id}`, data).then(unwrap<SiloExtractionEntry>),

  delete: (id: number) =>
    api.delete(`/business/silo-extractions/${id}`),
}

// ─── Diesel Maintenance ───────────────────────────────────────────────────────

export interface DieselEntry {
  id:        number
  date:      string
  process:   string
  quantity:  string
  notes:     string
  createdAt: string
  updatedAt: string
}

export const dieselMaintenanceApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: DieselEntry[] }>('/business/diesel-maintenance', { params: buildParams(from, to) })
      .then(unwrap<DieselEntry[]>),

  create: (data: Omit<DieselEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: DieselEntry }>('/business/diesel-maintenance', data).then(unwrap<DieselEntry>),

  update: (id: number, data: Omit<DieselEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: DieselEntry }>(`/business/diesel-maintenance/${id}`, data).then(unwrap<DieselEntry>),

  delete: (id: number) =>
    api.delete(`/business/diesel-maintenance/${id}`),
}

// ─── Store Room Material ──────────────────────────────────────────────────────

export interface StoreEntry {
  id:        number
  date:      string
  itemName:  string
  itemType:  string
  quantity:  string
  uom:       string
  notes:     string
  createdAt: string
  updatedAt: string
}

export const storeRoomMaterialsApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: StoreEntry[] }>('/business/store-room-materials', { params: buildParams(from, to) })
      .then(unwrap<StoreEntry[]>),

  create: (data: Omit<StoreEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: StoreEntry }>('/business/store-room-materials', data).then(unwrap<StoreEntry>),

  update: (id: number, data: Omit<StoreEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: StoreEntry }>(`/business/store-room-materials/${id}`, data).then(unwrap<StoreEntry>),

  delete: (id: number) =>
    api.delete(`/business/store-room-materials/${id}`),
}

// ─── Extra Vehicles ───────────────────────────────────────────────────────────

export interface ExtraVehiclesEntry {
  id:        number
  date:      string
  vendor:    string
  vehicles:  string  // JSON string stored in backend; parse/stringify on client
  notes:     string
  createdAt: string
  updatedAt: string
}

export const extraVehiclesApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: ExtraVehiclesEntry[] }>('/business/extra-vehicles', { params: buildParams(from, to) })
      .then(unwrap<ExtraVehiclesEntry[]>),

  create: (data: Omit<ExtraVehiclesEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: ExtraVehiclesEntry }>('/business/extra-vehicles', data).then(unwrap<ExtraVehiclesEntry>),

  update: (id: number, data: Omit<ExtraVehiclesEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: ExtraVehiclesEntry }>(`/business/extra-vehicles/${id}`, data).then(unwrap<ExtraVehiclesEntry>),

  delete: (id: number) =>
    api.delete(`/business/extra-vehicles/${id}`),
}

// ─── Testing Lab ──────────────────────────────────────────────────────────────

export interface TestingLabEntry {
  id:        number
  date:      string
  csEnabled: boolean
  csDay7:    string
  csDay28:   string
  ppEnabled: boolean
  ppNotes:   string
  npEnabled: boolean
  npNotes:   string
  btEnabled: boolean
  btNotes:   string
  createdAt: string
  updatedAt: string
}

export const testingLabsApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: TestingLabEntry[] }>('/business/testing-labs', { params: buildParams(from, to) })
      .then(unwrap<TestingLabEntry[]>),

  create: (data: Omit<TestingLabEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: TestingLabEntry }>('/business/testing-labs', data).then(unwrap<TestingLabEntry>),

  update: (id: number, data: Omit<TestingLabEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: TestingLabEntry }>(`/business/testing-labs/${id}`, data).then(unwrap<TestingLabEntry>),

  delete: (id: number) =>
    api.delete(`/business/testing-labs/${id}`),
}

// ─── Conversion ───────────────────────────────────────────────────────────────

export interface ConversionEntry {
  id:        number
  date:      string
  fromPipe:  string
  toPipe:    string
  quantity:  string
  notes:     string
  createdAt: string
  updatedAt: string
}

export const conversionsApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: ConversionEntry[] }>('/business/conversions', { params: buildParams(from, to) })
      .then(unwrap<ConversionEntry[]>),

  create: (data: Omit<ConversionEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: ConversionEntry }>('/business/conversions', data).then(unwrap<ConversionEntry>),

  update: (id: number, data: Omit<ConversionEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: ConversionEntry }>(`/business/conversions/${id}`, data).then(unwrap<ConversionEntry>),

  delete: (id: number) =>
    api.delete(`/business/conversions/${id}`),
}

// ─── Discard ──────────────────────────────────────────────────────────────────

export interface DiscardEntry {
  id:        number
  date:      string
  process:   string
  pipeName:  string
  quantity:  string
  notes:     string
  createdAt: string
  updatedAt: string
}

export const discardsApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: DiscardEntry[] }>('/business/discards', { params: buildParams(from, to) })
      .then(unwrap<DiscardEntry[]>),

  create: (data: Omit<DiscardEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: DiscardEntry }>('/business/discards', data).then(unwrap<DiscardEntry>),

  update: (id: number, data: Omit<DiscardEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: DiscardEntry }>(`/business/discards/${id}`, data).then(unwrap<DiscardEntry>),

  delete: (id: number) =>
    api.delete(`/business/discards/${id}`),
}

// ─── PDI ──────────────────────────────────────────────────────────────────────

export interface PDIEntry {
  id:            number
  date:          string
  thirdParty:    string
  pipeName:      string
  quantity:      string
  finishing:     boolean
  colour:        boolean
  numbering:     boolean
  ghola:         boolean
  qualityCheck:  boolean
  diameterCheck: boolean
  notes:         string
  createdAt:     string
  updatedAt:     string
}

export const pdisApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: PDIEntry[] }>('/business/pdis', { params: buildParams(from, to) })
      .then(unwrap<PDIEntry[]>),

  create: (data: Omit<PDIEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: PDIEntry }>('/business/pdis', data).then(unwrap<PDIEntry>),

  update: (id: number, data: Omit<PDIEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: PDIEntry }>(`/business/pdis/${id}`, data).then(unwrap<PDIEntry>),

  delete: (id: number) =>
    api.delete(`/business/pdis/${id}`),
}

// ─── Labour ───────────────────────────────────────────────────────────────────

export interface LabourEntry {
  id:                   number
  date:                 string
  contractorName:       string
  labourCount:          number
  ratePerDay:           string   // optional — empty string if not set
  overtimeHours:        string   // optional decimal hours, empty if none
  overtimeLabourCount:  number   // how many labours did OT
  overtimeRatePerHour:  string   // optional ₹ per hour per labour
  notes:                string
  createdAt:            string
  updatedAt:            string
}

export const labourApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: LabourEntry[] }>('/business/labour', { params: buildParams(from, to) })
      .then(unwrap<LabourEntry[]>),

  create: (data: Omit<LabourEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: LabourEntry }>('/business/labour', data).then(unwrap<LabourEntry>),

  update: (id: number, data: Omit<LabourEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: LabourEntry }>(`/business/labour/${id}`, data).then(unwrap<LabourEntry>),

  delete: (id: number) =>
    api.delete(`/business/labour/${id}`),
}

// ─── Business Rate Config ─────────────────────────────────────────────────────

export interface BusinessRateConfig {
  id:                number
  smallBedRate:      string   // ₹ per pipe (small bed)
  largeBedRate:      string   // ₹ per pipe (large bed)
  extraLargeBedRate: string   // ₹ per pipe (extra large bed)
  labourRatePerDay:  string   // ₹ per labour per day
  otRatePerHour:     string   // ₹ per labour per OT hour
  fabricationRateKg: string   // ₹ per kg
  coatingRate:       string   // ₹ per pipe (coating)
  winding2Rate:      string   // ₹ per pipe (winding 2)
  coating2Rate:      string   // ₹ per pipe (coating 2)
  createdAt:         string
  updatedAt:         string
}

// ─── Coating Contractor Rates ─────────────────────────────────────────────────

export interface CoatingContractorRate {
  id:          number
  diameterMm:  number
  ratePerPipe: string
  createdAt:   string
  updatedAt:   string
}

export const coatingRatesApi = {
  list: () =>
    api.get<{ data: CoatingContractorRate[] }>('/business/coating-rates')
      .then(unwrap<CoatingContractorRate[]>),

  upsert: (rates: { diameterMm: number; ratePerPipe: string }[]) =>
    api.put<{ data: CoatingContractorRate[] }>('/business/coating-rates', rates)
      .then(unwrap<CoatingContractorRate[]>),
}

// ─── Process Contractor Assignments ──────────────────────────────────────────

export interface ProcessContractorAssignment {
  id:          number
  processType: 'FABRICATION' | 'SPINNING' | 'COATING'
  supplierId:  number
  supplier?: {
    id:   number
    name: string
    phone?: string
    vendorType?: string
  }
  createdAt: string
  updatedAt: string
}

export const processContractorApi = {
  list: () =>
    api.get<{ data: ProcessContractorAssignment[] }>('/business/process-contractors')
      .then(unwrap<ProcessContractorAssignment[]>),

  upsert: (processType: string, supplierId: number) =>
    api.put<{ data: ProcessContractorAssignment }>('/business/process-contractors', { processType, supplierId })
      .then(unwrap<ProcessContractorAssignment>),

  remove: (id: number) =>
    api.delete(`/business/process-contractors/${id}`),
}

// ─── Spinning Bed Rates ───────────────────────────────────────────────────────

export interface SpinningBedRate {
  id:          number
  bedSize:     'SMALL_BED' | 'LARGE_BED' | 'EXTRA_LARGE_BED'
  diameterMm:  number
  ratePerPipe: string
  createdAt:   string
  updatedAt:   string
}

export const spinningRatesApi = {
  list: () =>
    api.get<{ data: SpinningBedRate[] }>('/business/spinning-rates')
      .then(unwrap<SpinningBedRate[]>),

  upsert: (rates: { bedSize: string; diameterMm: number; ratePerPipe: string }[]) =>
    api.put<{ data: SpinningBedRate[] }>('/business/spinning-rates', rates)
      .then(unwrap<SpinningBedRate[]>),
}

// ─── Business Rate Config ─────────────────────────────────────────────────────

export const businessRateConfigApi = {
  get: () =>
    api.get<{ data: BusinessRateConfig }>('/business/rate-config')
      .then(unwrap<BusinessRateConfig>),

  update: (data: Omit<BusinessRateConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: BusinessRateConfig }>('/business/rate-config', data)
      .then(unwrap<BusinessRateConfig>),
}

// ─── Third-Party Pipe Purchases ───────────────────────────────────────────────

export interface PipePurchaseEntry {
  id: number
  outletId: number
  supplierId: number | null
  vendorName: string
  invoiceNumber: string
  purchaseDate: string
  pipeConfigId: number | null
  pipeName: string
  quantity: number
  unitRate: string
  totalAmount: string
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
  supplier?: { id: number; name: string } | null
}

export const pipePurchasesApi = {
  list: (outletId: number, from?: string, to?: string) =>
    api.get<{ data: PipePurchaseEntry[] }>('/business/pipe-purchases', {
      params: { outletId, ...buildParams(from, to) },
    }).then(unwrap<PipePurchaseEntry[]>),

  create: (data: Omit<PipePurchaseEntry, 'id' | 'createdAt' | 'updatedAt' | 'supplier'>) =>
    api.post<{ data: PipePurchaseEntry }>('/business/pipe-purchases', data)
      .then(unwrap<PipePurchaseEntry>),

  update: (id: number, data: Partial<PipePurchaseEntry>) =>
    api.put<{ data: PipePurchaseEntry }>(`/business/pipe-purchases/${id}`, data)
      .then(unwrap<PipePurchaseEntry>),

  delete: (id: number) =>
    api.delete(`/business/pipe-purchases/${id}`),
}
// ─── Cuttings ─────────────────────────────────────────────────────────────────

export interface CuttingEntry {
  id: number
  date: string
  fromSheet: string
  toSheet: string
  quantity: number
  notes: string
  createdAt: string
  updatedAt: string
}

export const cuttingsApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: CuttingEntry[] }>('/business/cuttings', { params: buildParams(from, to) })
      .then(unwrap<CuttingEntry[]>),

  create: (data: Omit<CuttingEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: CuttingEntry }>('/business/cuttings', data)
      .then(unwrap<CuttingEntry>),

  update: (id: number, data: Omit<CuttingEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: CuttingEntry }>(`/business/cuttings/${id}`, data)
      .then(unwrap<CuttingEntry>),

  delete: (id: number) =>
    api.delete(`/business/cuttings/${id}`),
}

// ─── Extra Fabrication Charges ────────────────────────────────────────────────

export interface ExtraFabEntry {
  id:              number
  date:            string
  vendorName:      string
  particular:      string
  rate:            string
  quantity:        string
  taxPercent:      string
  lineTotal:       string
  notes:           string
  invoiceNo:       string
  vehicleNo:       string
  invoiceData:     string
  subTotal:        string
  discountPercent: string
  billPrice:       string
  taxable:         string
  gstInclusive:    boolean
  roundingOff:     string
  finalBill:       string
  createdAt:       string
  updatedAt:       string
}

export const extraFabApi = {
  list: (from?: string, to?: string) =>
    api.get<{ data: ExtraFabEntry[] }>('/business/extra-fab', { params: buildParams(from, to) })
      .then(unwrap<ExtraFabEntry[]>),

  create: (data: Omit<ExtraFabEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<{ data: ExtraFabEntry }>('/business/extra-fab', data).then(unwrap<ExtraFabEntry>),

  update: (id: number, data: Omit<ExtraFabEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<{ data: ExtraFabEntry }>(`/business/extra-fab/${id}`, data).then(unwrap<ExtraFabEntry>),

  delete: (id: number) =>
    api.delete(`/business/extra-fab/${id}`),
}
