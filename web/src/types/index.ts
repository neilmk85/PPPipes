export interface User {
  id: number
  name: string
  email: string
  phone?: string
  roles: string[]
  outletId?: number
  outletName?: string
  active: boolean
}

export interface Outlet {
  id: number
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  phone?: string
  gstin?: string
  active: boolean
  receiptHeader?: string
  receiptFooter?: string
  printReceiptByDefault?: boolean
  showTaxBreakdown?: boolean
  showBarcodeOnReceipt?: boolean
}

export interface Category {
  id: number
  name: string
  description?: string
  imageUrl?: string
  parentId?: number
  active: boolean
}

export interface TaxGroup {
  id: number
  name: string
  totalRate: number
  cgstRate?: number
  sgstRate?: number
  hsnCode?: string
  inclusive: boolean
  active: boolean
}

export interface ProductVariant {
  id: number
  productId: number
  name: string
  sku?: string
  barcode?: string
  attribute1Name?: string
  attribute1Value?: string
  attribute2Name?: string
  attribute2Value?: string
  priceAdjustment: number
  costPrice?: number
  imageUrl?: string
  active: boolean
}

export interface Product {
  id: number
  name: string
  description?: string
  sku?: string
  barcode?: string
  category?: Category
  taxGroup?: TaxGroup
  costPrice?: number
  sellingPrice: number
  mrp?: number
  minSellingPrice?: number
  unitOfMeasure: string
  productType: 'PHYSICAL' | 'SERVICE' | 'DIGITAL' | 'COMBO'
  itemType: 'RAW_MATERIAL' | 'FINISHED_PIPE' | 'GENERAL' | 'STORE_MATERIAL'
  trackInventory: boolean
  reorderLevel: number
  imageUrl?: string
  active: boolean
  featured: boolean
  purchasable: boolean
  variants?: ProductVariant[]
}

export interface PriceListItem {
  id: number
  priceListId: number
  productId: number
  variantId?: number
  product: { id: number; name: string; sku?: string; sellingPrice: number }
  variant?: { id: number; name: string; priceAdjustment: number }
  sellingPrice?: number
  discountPercent?: number
}

export interface PriceList {
  id: number
  name: string
  description?: string
  active: boolean
  priority: number
  startDate?: string
  endDate?: string
  segments: { segment: string }[]
  customers: { customerId: number; customer: { id: number; name: string; phone?: string } }[]
  items: PriceListItem[]
}

export interface Inventory {
  id: number
  product: Product
  outlet: Outlet
  quantityOnHand: number
  quantityReserved: number
  reorderLevel: number
}

export interface Customer {
  id: number
  name: string
  phone?: string
  phone2?: string
  email?: string
  address?: string
  city?: string
  state?: string
  gstin?: string
  segment: 'REGULAR' | 'SILVER' | 'GOLD' | 'VIP' | 'WHOLESALE'
  totalSpent: number
  creditLimit: number
  outstandingDue: number
  discountPercent: number
  active: boolean
  blacklisted: boolean
}

export interface CartItem {
  productId: number
  variantId?: number
  productName: string
  sku?: string
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  lineTotal: number
  imageUrl?: string
}

export interface Order {
  id: number
  orderNumber: string
  outlet: Outlet
  customer?: Customer
  status: string
  orderType: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  changeAmount: number
  couponCode?: string
  items: OrderItem[]
  payments: Payment[]
  createdAt: string
}

export interface OrderItem {
  id: number
  productName: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
}

export interface Payment {
  id: number
  paymentMethod: string
  amount: number
  referenceNumber?: string
  status: string
}

export interface Discount {
  id: number
  name: string
  description?: string
  discountType: string
  applyOn: 'PRODUCT' | 'CATEGORY' | 'CART' | 'CUSTOMER'
  valueType: 'PERCENTAGE' | 'FLAT' | 'BUY_X_GET_Y'
  value: number
  minOrderAmount?: number
  startDate?: string
  endDate?: string
  active: boolean
  stackable?: boolean
  priority?: number
  products?: { id: number; name: string; sku?: string }[]
  categories?: { id: number; name: string }[]
}

export interface Coupon {
  id: number
  code: string
  description?: string
  valueType: 'PERCENTAGE' | 'FLAT'
  value: number
  minOrderAmount: number
  maxDiscountAmount?: number
  startDate?: string
  expiryDate?: string
  timesUsed: number
  usageLimit?: number
  usagePerCustomer?: number
  active: boolean
}

export interface CreditNote {
  id: number
  creditNoteNumber: string
  customer: Customer
  totalAmount: number
  usedAmount: number
  remainingAmount: number
  expiryDate?: string
  status: 'ACTIVE' | 'FULLY_USED' | 'EXPIRED' | 'CANCELLED'
  reason?: string
}

export interface Shift {
  id: number
  outlet: Outlet
  cashier: User
  openedAt: string
  closedAt?: string
  openingCash: number
  closingCash?: number
  expectedCash?: number
  cashVariance?: number
  totalSales: number
  totalOrders: number
  status: 'OPEN' | 'CLOSED'
}

export interface StockTransfer {
  id: number
  transferNumber: string
  fromOutlet: Outlet
  toOutlet: Outlet
  status: string
  items: StockTransferItem[]
  createdAt: string
}

export interface StockTransferItem {
  id: number
  product: Product
  requestedQuantity: number
  shippedQuantity: number
  receivedQuantity: number
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
  errors?: Record<string, string>
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

// ── PCCP Production ────────────────────────────────────────────────────────────

export const PIPE_DIAMETERS = [350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700]
export const PRESSURE_CLASSES = ['4kg', '5.5kg', '7kg', '8.5kg', '10kg', '11.5kg', '13kg', '14.5kg']

export const PROD_STAGES = [
  { key: 'FABRICATION',         label: 'Fabrication' },
  { key: 'FABRICATION_TESTING', label: 'Fab Testing' },
  { key: 'MOULDING',            label: 'Moulding' },
  { key: 'SPINNING',            label: 'Spinning' },
  { key: 'DEMOULDING',          label: 'Demoulding' },
  { key: 'CURING_1',            label: 'Curing 1' },
  { key: 'WINDING',             label: 'Winding' },
  { key: 'COATING',             label: 'Coating' },
  { key: 'CURING_2',            label: 'Curing 2' },
  { key: 'FINAL_TESTING',       label: 'Final Testing' },
] as const

export const MATERIAL_STAGES = ['FABRICATION', 'SPINNING', 'WINDING', 'COATING']

export const BED_TYPES = [
  { key: 'SMALL_BED', label: 'Small Bed' },
  { key: 'LARGE_BED', label: 'Large Bed' },
] as const

export const MACHINE_TYPES = [
  { key: 'FABRICATION', label: 'Fabrication' },
  { key: 'SPINNING',    label: 'Spinning' },
  { key: 'WINDING',     label: 'Winding' },
  { key: 'COATING',     label: 'Coating' },
  { key: 'CURING',      label: 'Curing' },
  { key: 'OTHER',       label: 'Other' },
] as const

export const MACHINE_STATUSES = [
  { key: 'ACTIVE',      label: 'Active',      color: 'green' },
  { key: 'IDLE',        label: 'Idle',         color: 'yellow' },
  { key: 'MAINTENANCE', label: 'Maintenance',  color: 'orange' },
  { key: 'RETIRED',     label: 'Retired',      color: 'gray' },
] as const

export type ProdStageKey = typeof PROD_STAGES[number]['key']

export interface PipeConfigMaterial {
  id: number
  pipeConfigId: number
  stageType: ProdStageKey
  materialProductId: number
  quantityPerPipe: number | string
  uom: string
  scrapPercent: number | string
  notes?: string
  materialProduct?: Product
}

export interface PipeConfig {
  id: number
  name: string
  diameterMm: number
  pressureClass: string
  description?: string
  lengthM: number
  active: boolean
  createdAt: string
  updatedAt: string
  materials?: PipeConfigMaterial[]
}

export interface ProductionOrder {
  id: number
  poNumber: string
  salesOrderId?: number
  pipeConfigId: number
  outletId: number
  plannedQty: number
  status: 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  notes?: string
  createdAt: string
  pipeConfig?: PipeConfig
  outlet?: Outlet
}

export interface StageProgress {
  stageType: ProdStageKey
  pipesProcessed: number
  pipesCompleted: number
  pipesRejected: number
  entryCount: number
}

export interface ProductionProgress {
  productionOrderId: number
  plannedQty: number
  stages: StageProgress[]
}

export interface MaterialConsumption {
  id: number
  productionEntryId: number
  pipeConfigMaterialId?: number
  materialProductId: number
  outletId: number
  consumedQty: number | string
  uom: string
  unitCost: number | string
  totalCost: number | string
  createdAt: string
  materialProduct?: Product
}

export interface ProductionEntry {
  id: number
  productionOrderId: number
  pipeConfigId: number
  stageType: ProdStageKey
  pipesProcessed: number
  pipesCompleted: number
  pipesRejected: number
  entryDate: string
  notes?: string
  bedType?: 'SMALL_BED' | 'LARGE_BED'
  machineId?: number
  shiftName?: 'A' | 'B' | 'C'
  createdAt: string
  pipeConfig?: PipeConfig
  productionOrder?: ProductionOrder
  consumptions?: MaterialConsumption[]
}

export interface PriorStageInfo {
  stageType: ProdStageKey
  pipesCompleted: number
  lastEntryDate?: string
}

export interface CostSheetLine {
  id: number
  costSheetId: number
  costType: 'MATERIAL' | 'LABOR' | 'MACHINE' | 'OVERHEAD'
  description: string
  amount: number | string
}

export interface CostSheet {
  id: number
  productionOrderId: number
  totalMaterialCost: number | string
  totalLaborCost: number | string
  totalMachineCost: number | string
  totalOverheadCost: number | string
  totalCost: number | string
  outputQty: number
  costPerPipe: number | string
  lastComputedAt?: string
  lines?: CostSheetLine[]
}

export interface ProductionMachine {
  id: number
  machineCode: string
  name: string
  machineType: string
  outletId: number
  status: 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'RETIRED'
  capacity: number
  hourlyRate: number | string
  description?: string
  active: boolean
}

export interface ProductionShiftTemplate {
  id: number
  outletId: number
  shiftName: 'A' | 'B' | 'C'
  startTime: string
  endTime: string
  active: boolean
}

export interface OverheadConfig {
  id: number
  outletId: number
  name: string
  description?: string
  ratePerPipe: number | string
  active: boolean
}

export interface ProductionPlan {
  id: number
  planDate: string
  outletId: number
  status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED'
  notes?: string
  createdAt: string
  entries?: ProductionPlanEntry[]
}

export interface ProductionPlanEntry {
  id: number
  planId: number
  productionOrderId: number
  machineId?: number
  shiftName: 'A' | 'B' | 'C'
  stageType: ProdStageKey
  plannedQty: number
  actualQty: number
  productionOrder?: ProductionOrder
  machine?: ProductionMachine
}

export interface YardZone {
  id: number
  outletId: number
  name: string
  zoneType: 'WIP' | 'CURING' | 'FINISHED_GOODS' | 'DISPATCHED'
  capacity: number
  description?: string
  active: boolean
}

export interface YardLocation {
  id: number
  zoneId: number
  productionOrderId: number
  pipeConfigId: number
  quantity: number
  status: 'WIP' | 'CURING' | 'READY' | 'DISPATCHED' | 'SCRAPPED'
  enteredAt: string
  exitedAt?: string
  zone?: YardZone
  pipeConfig?: PipeConfig
}

export interface YardMovement {
  id: number
  productionOrderId: number
  pipeConfigId: number
  fromZoneId?: number
  toZoneId: number
  quantity: number
  movedAt: string
  salesOrderId?: number
  dispatchNote?: string
  fromZone?: YardZone
  toZone?: YardZone
}
