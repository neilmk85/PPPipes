# PP Pipes Products — New Requirements

---

## Tech Stack — Site Project (Water Supply Pipeline)

The Site project is integrated directly into the PP Pipes Products web app (`/web`). It shares the same stack — no separate project or install needed.

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | React 18 + TypeScript | Same as POS web app |
| **Build Tool** | Vite 5 | Port 3000, proxy → Go backend :8082 |
| **Styling** | Tailwind CSS 3 | Custom colors: primary, success, warning, danger |
| **Routing** | React Router DOM v6 | Pages live under `src/pages/site/` |
| **Server State** | TanStack React Query v5 | `staleTime: 0`, retry: 1 |
| **HTTP Client** | Axios | Via shared `src/services/api.ts` |
| **Forms** | React Hook Form + Zod | Validation schemas co-located with forms |
| **State Management** | Zustand | Auth store: `src/store/authStore.ts` |
| **UI Components** | Radix UI | Dialog, Dropdown, Select, Tabs, Tooltip, Popover |
| **Icons** | Lucide React | |
| **Charts** | Recharts | For dashboards / reports |
| **PDF Export** | jsPDF + jsPDF-AutoTable | Work bills, reports |
| **Excel Export** | xlsx | |
| **Notifications** | react-hot-toast | Top-right position |
| **Printing** | react-to-print | |
| **Date Utils** | date-fns | |
| **Class Utils** | clsx + tailwind-merge + class-variance-authority | |

### Integration Points
- **Sidebar entry:** `AppLayout.tsx` line 146 — `/site` with `Building2` icon, `highlight: true`
- **Routes:** `App.tsx` — `/site`, `/site/contractors`, `/site/work-orders`, `/site/work-bills`
- **Pages:** `src/pages/site/` — `SitePage`, `ContractorsPage`, `WorkOrdersPage`, `WorkBillsPage`
- **Backend:** Go backend at `:8082`, same as all other modules

---

## REQ-001 · Sales Order: Meters Field & Pipe Qty Auto-Calculation
**Page:** `/sales-orders/new`
**Status:** Implemented

- Under Order Items, when a pipe config is selected, show a **Meters** input field alongside Qty.
- `1 pipe = 5.25 meters`
- Entering meters auto-calculates qty: `qty = Math.ceil(meters / 5.25)`
- Qty can still be manually overridden via `−`/`+` controls.
- Meters field only applies to pipe items; product rows show `—`.
- **Discount column removed** from the Order Items table.

---

## REQ-002 · Transport Report
**Page:** `/reports/transport`
**Status:** Implemented

- Renamed tabs: "By Vendor" → **Transporter**, "By Customer" → **Customer**.
- Card header gradient lightened; hero page header kept dark (`from-violet-700 via-violet-600 to-blue-600`).
- **Transporter tab restructured** with a 3-level hierarchy per transporter card:
  - Truck-wise summary strip (truck no., total trips, total pipes).
  - Site-by-site breakdown below — each site shown as its own section.
  - Per-site trip table: Truck No, Pipe Name, Qty, Destination, Date.
- Site sub-header badge shows **"Total trips = N"** (not "N trips").
- Table headings in **black**, truck number badge in black (`bg-gray-100 text-gray-900`).
- Increased table heading font size.

---

## REQ-003 · TDS Outward (Tax Deducted at Source on Vendor Payments)
**Pages:** `/reports/tds` → "TDS Outward" tab, `/settings` → TDS Sections tab
**Status:** Implemented

- **TDS Sections master** — configurable via Settings → TDS Sections tab:
  - Fields: Section Code (194C, 194J, etc.), Description, Rate (%), Threshold Limit (₹).
  - "Add Defaults" button seeds common sections (194C / 194J / 194I / 194H) in one click.
  - Full CRUD: add, edit, delete sections.

- **TDS deduction on vendor payments:**
  - Vendor payment form accepts `tdsSectionId` and `tdsAmount`.
  - TDS amount and section stored on `vendor_payments` table.
  - A `tds_deductions` record is created per payment that has TDS, storing: supplier, section, base amount, rate, TDS amount, financial year, deposit status.

- **TDS Payable in Ledger** (`/reports/ledger`):
  - A "TDS Payable" GL account auto-appears in the ledger when any TDS has been deducted in the selected period.

- **TDS Outward Report** (`/reports/tds` → TDS Outward tab):
  - Date range filter with presets.
  - Summary cards: Total Base Amount, Total TDS Deducted, Sections count, Parties count.
  - **By Section view**: section code, description, rate, transaction count, base amount, TDS deducted, deposited, pending.
  - **By Party view**: vendor name, PAN, section, transaction count, base amount, TDS deducted, deposited, pending.
  - Pending amounts highlighted in red.

---

## REQ-005 · TDS Inward (TDS Deducted by Customers on Our Invoices)
**Page:** `/reports/tds` → "TDS Inward" tab
**Status:** Implemented

When a large customer (Tata Projects, NHAI, etc.) pays us, they deduct TDS from the invoice amount and deposit it on our behalf to the government. We need to track these so we can claim the credit in our ITR via Form 26AS.

- **Model:** `tds_receivables` table — stores each instance where a customer deducted TDS on our invoice:
  - Customer name, Invoice number, TDS Section, Payment date, Base amount, TDS rate, TDS amount.
  - Financial year (auto-computed from payment date).
  - Status: `PENDING` (deducted but not yet reflected in 26AS) → `RECEIVED` (confirmed in Form 26AS/Form 16A).
  - Received date — date when credit was confirmed in 26AS.

- **TDS Inward UI** (`/reports/tds` → TDS Inward tab):
  - **Summary cards**: Total Base, Total TDS Inward, Received in 26AS, Pending (not yet reflected).
  - **Add Entry** form: Customer Name, Invoice No., TDS Section (from shared master), Payment Date, Base Amount, TDS Rate (auto-fills from section), TDS Amount (auto-computed).
  - **Receivables table**: lists all entries with date, customer, invoice, section badge, base, TDS, status badge (Pending/Received), notes, and inline actions.
    - "Mark as Received" (✓) button for PENDING entries — sets status to RECEIVED and records today as received date.
    - Delete button with confirmation.
  - **By Customer Summary**: grouped table showing total base, TDS, received, pending per customer+section.

- **Backend:** Routes: `GET/POST /api/tds/receivables`, `PUT /api/tds/receivables/{id}`, `DELETE /api/tds/receivables/{id}`, `GET /api/reports/tds-inward`.
  - Report endpoint groups by section and customer, returns totals for received vs pending.
  - Shared TDS Sections master with TDS Outward.

---

## REQ-006 · Third-Party Pipe Purchase
**Page:** `/business/pipe-purchases`
**Status:** Implemented

Pipes are sometimes purchased directly from external vendors instead of being manufactured in-house. These purchases must be tracked separately and credited to finished-goods inventory, but must **not** affect raw material consumption or contractor payments.

### Critical Business Rules
> ⚠️ **DO NOT reduce raw material (cement, steel, aggregate) inventory** when recording a third-party pipe purchase. These pipes arrive ready-made — no production process is involved.
>
> ⚠️ **DO NOT create contractor payment records** for third-party pipe purchases. Contractor payments are tied exclusively to the manufacturing process (spinning, coating, etc.). Third-party purchases are vendor invoices, not contractor work.
>
> ✅ **Only credit `inventory.quantity_on_hand`** for the matching `FINISHED_PIPE` product. The pipe enters the same finished-goods pool as manufactured pipes and can be dispatched and invoiced normally.

### Data Captured Per Purchase
- **Vendor** — free-text name (with optional link to the vendor master)
- **Pipe Type** — free-text name snapshot (with optional link to pipe config master)
- **Invoice Number** — vendor invoice reference
- **Purchase Date**
- **Quantity** (pieces)
- **Unit Rate** (₹) — auto-computes Total Amount = qty × rate
- **Outlet** — inventory is outlet-scoped (`UNIQUE(product_id, outlet_id)`)
- **Notes**

### Inventory Behaviour
- **On create:** `inventory.quantity_on_hand += quantity` for the FINISHED_PIPE product matching the pipe name.
  - If the FINISHED_PIPE product doesn't exist yet, it is created automatically (same logic as `creditFinishedGoodsInventory` in production).
- **On delete:** `inventory.quantity_on_hand -= quantity` (reversal). The record is removed and the inventory credit is unwound.
- **On update qty:** delta applied — credit if increased, debit if decreased.
- **On update pipe name:** old pipe's inventory is fully reversed; new pipe's inventory is fully credited.

### Purchase Log (separate tracking)
All third-party pipe purchases are stored in `biz_third_party_pipe_purchases` and displayed in a dedicated log that clearly shows:
- Which pipe was purchased
- How many pieces
- From which vendor
- On which date
- Invoice number and amount paid

### UI
- **Page:** `/business/pipe-purchases` — nav: "Pipe Purchases" (Package icon, highlighted)
- **Summary cards:** Total Purchases, Total Qty (pcs), Total Value (₹), Pipe Types count, Vendors count
- **Purchase Log table:** Date | Vendor | Invoice No. | Pipe Type | Qty | Unit Rate | Total Amount | Notes | Delete
- **Purchases by Vendor panel:** Groups purchases by vendor → shows each pipe type, qty, and amount per vendor
- **Date range filter** with presets (Today / Last 7d / Last 30d / This Month)
- **Delete with confirmation** — toast confirms "Purchase deleted and inventory reversed"

### Backend
- **Table:** `biz_third_party_pipe_purchases`
- **Routes:** `GET/POST /api/business/pipe-purchases`, `PUT/DELETE /api/business/pipe-purchases/{id}`
- **Service:** `PipePurchaseService` with `creditInventory` / `debitInventory` helpers (replicates production's `creditFinishedGoodsInventory` logic without touching material consumption or contractor tables)

---

## REQ-004: Production Order — On Hold Status
**Page:** `/production/orders`, `/production/orders/{id}`
**Status:** Implemented

- **ON_HOLD status** added to production order lifecycle between IN_PROGRESS and COMPLETED.
- **Status flow:** DRAFT → PLANNED → IN_PROGRESS → ON_HOLD → IN_PROGRESS (resume) or CANCELLED.
  - PLANNED → IN_PROGRESS is automatic when the first production entry is added.
  - DRAFT → PLANNED requires manual Approve action.

- **Hold captures:**
  - `holdReason` — mandatory text describing why the order is paused (e.g. client delay, material shortage).
  - `holdAt` — timestamp when the order was put on hold.
  - `holdQtyProduced` — snapshot of pipes that had passed final testing at the time of hold.

- **Production Orders list** (`/production/orders`):
  - ON_HOLD filter button in the status strip.
  - "On Hold" count in the summary stats bar (orange, highlighted when > 0).
  - ON_HOLD rows highlighted in orange with hold reason and "X / Y pipes completed" shown inline.
  - **Hold** button on IN_PROGRESS rows → opens modal to capture reason + shows live progress snapshot.
  - **Resume** button on ON_HOLD rows → returns order to IN_PROGRESS, clears hold data.

- **Production Order detail** (`/production/orders/{id}`):
  - Orange hold info banner showing reason, qty snapshot, and hold date.
  - **Hold** / **Resume** buttons in the page header.
  - Same hold modal with reason textarea and progress snapshot.

- **Backend:** `hold_reason`, `hold_at`, `hold_qty_produced` columns on `production_orders` table (auto-migrated). Resuming from hold clears all three fields.

---

## REQ-007 · 6.5m Pipe Config Support
**Status:** Implemented

Two pipe lengths are now supported alongside each other: the original **5.25m** and the new **6.5m**. The 6.5m quantities are the 5.25m values × 1.24 (sourced from `pccp_formulas_6.5m_scaled_2dp.xlsx`).

### Files Changed
| File | Change |
|---|---|
| `go-backend/internal/database/seed_pipe_configs.go` | **New file** — seeds 230 pipe configs per length (460 total) in two clearly labelled sections: 5.25m and 6.5m. Idempotent (uses FirstOrCreate). |
| `go-backend/internal/database/seed.go` | Added step 7 call to `SeedPipeConfigs(db)` so seed runs on every backend startup. |

### Pipe Configs Page (`/production/pipe-configs`)
| File | Change |
|---|---|
| `web/src/pages/production/PipeConfigsPage.tsx` | Added `filterLen` state and a **Length filter dropdown** (All / 5.25m / 6.5m). Configs are grouped into two colour-coded sections: blue header for 5.25m, violet header for 6.5m. |

### Production Entry Dropdown (`/production/entry`)
| File | Change |
|---|---|
| `web/src/pages/production/ProductionEntryPage.tsx` | Pipe search dropdown now shows the pipe length alongside diameter and pressure class — e.g. `350mm · 10kg · 5.25m` or `350mm · 4kg · 6.5m`. |
| `go-backend/internal/service/production_order.go` | `OrderSummary` struct already included `LengthM float64` and the `GetSummaries` query already selected `COALESCE(pc.length_m, 5.25) AS length_m` — no backend change needed. |

### Mobile — Order List & Bed Lock
| File | Change |
|---|---|
| `mobile/lib/screens/business/business_detail_screen.dart` | Each order card in the DEMOULDING entry list now shows a pipe length badge — blue `5.25m` or violet `6.5m` — so operators know which length they're selecting. |
| `mobile/lib/screens/business/business_detail_screen.dart` | When an order with a 6.5m pipe config is selected in DEMOULDING, bed type is auto-set to `LARGE_BED` and the selector is locked (dimmed, non-interactive) with an orange "6.5m pipe — Large Bed required" label. Lock releases when all 6.5m orders are deselected. |

---

## REQ-008 · Extra Large Bed Type
**Status:** Implemented

A third bed size — **Extra Large** — added alongside Small Bed and Large Bed for production demoulding and spinning entries.

### Backend
| File | Change |
|---|---|
| `go-backend/internal/models/production_enums.go` | Added `BedExtraLarge BedType = "EXTRA_LARGE_BED"` constant. |
| `go-backend/internal/service/production_entry.go` | Updated bed type validation in both DEMOULDING (required) and SPINNING (optional) blocks to accept `"EXTRA_LARGE_BED"`. Error message updated to `"bedType must be SMALL_BED, LARGE_BED or EXTRA_LARGE_BED"`. |

### Web — Types & Services
| File | Change |
|---|---|
| `web/src/types/index.ts` | `BED_TYPES` constant: added `{ key: 'EXTRA_LARGE_BED', label: 'Extra Large Bed' }`. `ProductionEntry.bedType` union extended to include `'EXTRA_LARGE_BED'`. |
| `web/src/services/businessApi.ts` | `SpinningBedRate.bedSize` union extended to include `'EXTRA_LARGE_BED'`. |

### Web — Pages
| File | Change |
|---|---|
| `web/src/pages/production/ProductionEntryPage.tsx` | Bed type selector uses `BED_TYPES.map()` — Extra Large button appears automatically on DEMOULDING (required) and SPINNING (optional) entry forms. |
| `web/src/pages/production/SpinningReportPage.tsx` | `BED_LABEL` map updated; "Extra Large Bed" stat added to summary strip; green badge for `EXTRA_LARGE_BED` rows. |
| `web/src/pages/production/ProductionReportsPage.tsx` | `BED_LABEL` map updated; green badge for `EXTRA_LARGE_BED` rows. |
| `web/src/pages/business/BusinessSettingsPage.tsx` | Spinning Rates table: added "Extra Large Bed (₹/pipe)" column with input cells per diameter row. State, load, and save logic all include `EXTRA_LARGE_BED`. |

### Mobile
| File | Change |
|---|---|
| `mobile/lib/screens/business/business_detail_screen.dart` | Third bed type button `_bedTypeBtn('EXTRA_LARGE_BED', 'Extra Large')` added to the bed selector row in the DEMOULDING entry form. State variable `_bedType` and `_bedTypeLocked` added; `_recalcBedLock()` auto-selects and locks `LARGE_BED` when a 6.5m pipe order is selected (see REQ-007 mobile section). |

---

## REQ-009 · Fabrication Stage — Remove Spurious "Previous Stage" Banner
**Page:** `/production/entry`
**Status:** Implemented

On the Process Entry page, selecting the **Fabrication** stage (Step 1) previously showed a misleading blue info banner: *"Previous stage (Fabrication): N pipes completed"* — referencing the stage itself as its own prior stage.

### Root Cause
The backend `GetPriorStageCompleted` endpoint returned the order's `PlannedQty` labelled as a Fabrication completion when `stage index == 0`, instead of returning nothing.

### Files Changed
| File | Change |
|---|---|
| `go-backend/internal/service/production_entry.go` | `GetPriorStageCompleted`: when `idx == 0` (Fabrication is the first stage), now returns `nil, nil` instead of a self-referencing entry. The frontend already conditionally renders `{priorStageData && ...}` so the banner is suppressed automatically. |

---

## REQ-011 · UI Improvements — Payments Pages & Customer Ledger
**Status:** Implemented

### Shared DateRangePicker Component
- Extracted a reusable `DateRangePicker` component at `web/src/components/DateRangePicker.tsx`.
- Presets: Today, Yesterday, This Week, Last Week, This Month, Last Month, This Quarter, This Year. Plus custom date range with an Apply button.
- Styled for dark hero backgrounds (glass `bg-white/10` button, white text).
- Replaced inline duplicate implementations in `DirectPurchasePage.tsx` and `SalesOrdersPage.tsx` with the shared import.

### Purchases → Payments Page (`/purchases/payments`)
- **Full-width flush hero header** — no top margin, no rounded corners, edge-to-edge.
- **Stat chips** in hero header (plain text, no background card): Total Paid, TDS (if any), Net Outflow, Vendors.
- **Date range filter** in hero header via shared `DateRangePicker`; chips reflect the filtered data.
- **Search bar** and **Record Payment** button moved into hero header (row 2 below stats).
- Summary cards below the header removed (all stats moved into header).

### Sales → Receipts Page (`/sales/payments-received`)
- Tab order changed: **Transactions** tab is now first, **Summary** second.

### Customer Detail Page (`/customers/:id`)
- Clicking a customer row on `/customers` navigates to `/customers/:id` (detail view).
  - Row style: `cursor-pointer hover:bg-violet-50/40`.
  - Edit pencil and toggle buttons use `e.stopPropagation()` to avoid triggering row navigation.
- **New page:** `web/src/pages/customers/CustomerDetailPage.tsx`.
- **Hero header:** customer name, city, phone, GSTIN; stat chips: Total Billed, Total Paid, Outstanding (red when > 0), Credit Notes; Edit button navigates to `/customers/:id/edit`.
- **Ledger tab** (default): chronological table merging invoices, receipts, and credit notes with Debit / Credit / Running Balance columns. Balance shown as "Dr" or "Cr".
- **Invoices tab:** invoice number, date, due date, total, paid, status badge.
- **Receipts tab:** date, reference, method, amount, notes; tfoot totals row.
- **Sales Orders tab:** SO number, date, status badge, value; rows are clickable → navigates to SO detail.

### Backend Changes
- **`GET /api/invoices`** — added optional `customerId` filter; returns only that customer's invoices when provided.
- **`GET /api/sales-order-payments`** — added optional `customerId` filter; matches payments directly on `customer_id` or via `sales_order_id IN (SELECT id FROM sales_orders WHERE customer_id = ?)`.

### Route Added
- `App.tsx`: `<Route path="/customers/:id" />` registered before `/customers/:id/edit`.

---

## REQ-010 · Convert SO to Production Order — Role Permission Gate
**Page:** `/sales-orders/:id`
**Status:** Implemented

The "Convert to PO" buttons on the Sales Order detail page were previously visible to all authenticated users (relying on backend 403 as the only enforcement). A named permission `CONVERT_SO_TO_PO` has been introduced so admins can control exactly who can trigger SO-to-Production-Order conversion, including the ability to grant this to custom roles.

### Permission Behaviour
- **SUPER_ADMIN:** always has the permission (bypasses all checks)
- **ADMIN / MANAGER (built-in roles):** receive `CONVERT_SO_TO_PO` automatically on login — no config required
- **Custom roles:** admin must explicitly enable `CONVERT_SO_TO_PO` in the role's permission list (Staff → Roles → edit role)
- **CASHIER / INVENTORY_MANAGER / ACCOUNTANT:** do not receive the permission; Convert buttons are hidden

### Files Changed

**Backend**

| File | Change |
|---|---|
| `go-backend/internal/middleware/auth.go` | `AuthUser` struct gets `Permissions []string`. `Authenticate` middleware queries `custom_roles` by role name and loads the JSON permissions array into context. New `RequireRoleOrPermission(permKey, roles...)` middleware passes if user has one of the listed roles **or** holds the named permission key. |
| `go-backend/internal/service/auth.go` | `AuthResponse` gets `Permissions []string`. `buildAuthResponse` populates it: custom-role users receive their role's explicit permission keys; built-in ADMIN/MANAGER receive `["CONVERT_SO_TO_PO"]`; SUPER_ADMIN receives empty (bypassed client-side). |
| `go-backend/internal/router/router.go` | Both convert routes (`POST /api/sales-orders/{id}/convert-all` and `POST /api/sales-orders/items/{itemId}/convert`) switched from `RequireRole` to `RequireRoleOrPermission("CONVERT_SO_TO_PO", "SUPER_ADMIN", "ADMIN", "MANAGER")`. |

**Frontend**

| File | Change |
|---|---|
| `web/src/types/index.ts` | `User` interface: added `permissions?: string[]` |
| `web/src/store/authStore.ts` | Added `hasPermission(key: string): boolean` — SUPER_ADMIN always returns true; everyone else checks `user.permissions.includes(key)` |
| `web/src/pages/auth/LoginPage.tsx` | Maps `auth.permissions` from login response into the stored `User` object |
| `web/src/pages/staff/StaffPage.tsx` | `CONVERT_SO_TO_PO` added to `PERMISSION_GROUPS` under "Sales & Orders" — visible and toggleable in the custom role editor |
| `web/src/pages/orders/SalesOrderDetailPage.tsx` | `canConvertSO = hasPermission('CONVERT_SO_TO_PO')` gates the "Convert All" header button and each row's "Convert to PO" button. Users without the permission see a "No permission" placeholder instead of the button. |

---

## REQ-012 · Direct Purchase (Mobile App)
**Page:** Mobile → Purchases → Direct Purchases
**Status:** Implemented

Direct purchases are purchases made without a formal PO — cash buys, petty-cash vendor payments, walk-in supplier invoices. These must be tracked separately from standard Purchase Orders so finance can distinguish PO-backed procurement from ad-hoc spend.

- **Left drawer** — Purchases is now a collapsible dropdown with two sub-items: **PO** (`/purchases`) and **Direct Purchases** (`/purchases/direct`).
- **Direct Purchases screen** (`/purchases/direct`) — teal color scheme; lists all direct purchase records fetched via `GET /purchase-orders?isDirect=true`.
- **Cards** show PO number, status badge, vendor name, date, total amount, and inline line items.
- **Tapping a card** opens an edit bottom sheet pre-filled with the existing record.
- **FAB** opens a create bottom sheet (blank form).
- **Bottom sheet fields**: Vendor Name, optional date, line items (name, qty, rate, UOM), grand total auto-calculated.
- **API**: `getDirectPurchases()` passes `isDirect: 'true'` (String, not bool). `getPurchaseOrders()` passes `isDirect: 'false'` to exclude direct purchases from the PO screen. `updateDirectPurchase(id, data)` calls `PUT /purchase-orders/direct/:id`.
- **Back button**: uses `context.canPop() ? context.pop() : context.go('/purchases')` because drawer navigation uses `context.go()` which replaces the stack.

---

## REQ-016 · Loading Entries → Invoice Conversion (Accountant Flow)
**Page:** `/business/loading-invoice`
**Status:** Implemented

Loading entries created by the factory operator are now visible to the Accountant and Admin so they can generate invoices directly from them — without switching between screens or re-entering data.

### Permission: `CONVERT_LOADING_TO_INVOICE`
- **SUPER_ADMIN / ADMIN / MANAGER / ACCOUNTANT** — receive this permission automatically on login; no manual config required.
- **Custom roles** — admin must explicitly enable `CONVERT_LOADING_TO_INVOICE` in Staff → Roles → edit role.
- Users without the permission see a "No permission" placeholder instead of the Convert button.
- Visible in the role editor under "Business Operations" for admin toggle.

### Loading Invoice Page (`/business/loading-invoice`)
- Lists all loading records fetched via `GET /api/loading-records` with a date range filter (presets: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, This Year).
- Search by pipe name, vehicle no., customer name, or vendor.
- Summary strip shows total records and how many have already been invoiced.
- Each loading record card shows: pipe name, vehicle no., customer, qty loaded, date — and an invoice status badge (Invoiced / Pending).
- **Convert to Invoice** button: opens a drawer pre-filled with the loading entry details (customer, items, qty, date). Accountant confirms invoice amount, GST rate (via tax group picker), due date, and payment terms, then submits.
- Once converted, the loading record is linked to the new invoice (`invoiceId` set) and the card shows the invoice number as a clickable link.

### Backend Routes
- `POST /api/invoices` — guarded by `RequireRoleOrPermission("CONVERT_LOADING_TO_INVOICE", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "MANAGER")`.
- `PATCH /api/invoices/{id}/status` — guarded by `RequireRoleOrPermission("CONVERT_LOADING_TO_INVOICE", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT")`.
- All other invoice routes (PUT, payment, send, delete) restricted to ADMIN / ACCOUNTANT as before.

---

## REQ-017 · Mobile — Loading Entries & Invoice Creation
**Screen:** Mobile → Business → Loading (`/business/loading`) · `LoadingInvoiceScreen`
**Status:** Implemented

Operators on the factory floor can log loading entries from the mobile app. Accountants and Admins can then view those entries and convert them to invoices directly from the same screen — without needing the web app.

### Loading Screen (operator)
- Lists all loading records for a selected date range with search by pipe name, vehicle no., customer, or vendor.
- FAB opens a create sheet to log a new loading entry: pipe type, qty, vehicle no., customer, destination address (auto-suggested from past records), date, driver, notes.
- Existing records can be edited via a bottom sheet.

### Invoice Conversion (accountant / admin)
- `LoadingInvoiceScreen` shows all loading records with an "Invoiced / Pending" status badge.
- Permission gate: `canConvert` is true when user role is `SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`, or the `permissions` array contains `CONVERT_LOADING_TO_INVOICE`.
- Users without the permission see the record but no Convert button.
- **Convert to Invoice** opens `_LoadingRecordEditSheet` which lets the user confirm invoice details (customer, items, qty, GST, due date, payment terms) and calls `POST /api/invoices` via `ApiService().createInvoice(...)`.
- Once converted, the card shows the invoice number and no further conversion is possible.

---

## REQ-018 · Mobile — Day Book Report
**Screen:** Mobile → Reports → Day Book
**Status:** Implemented

- Shows a chronological list of all financial vouchers for a selected date — invoices, receipts, purchase bills, payments, journal entries, credit notes.
- Each entry shows: voucher type badge, party name, reference number, amount (Debit / Credit).
- Tapping a voucher opens a detail bottom sheet. For invoices and purchase bills, full line-item details are fetched from the backend.
- Date navigation with Previous / Next day arrows and a date picker.
- Total Debits and Total Credits summary at the bottom.

---

## REQ-019 · Mobile — Ledger Report
**Screen:** Mobile → Reports → Ledger
**Status:** Implemented

- Account selector: fetches all GL accounts and lets the user pick one (search by name).
- Shows a running-balance ledger for the selected account over a chosen date range.
- Columns: Date, Description / Party, Debit, Credit, Balance (Dr / Cr).
- **PDF export**: generates a formatted PDF using the `pdf` package and shares it via `share_plus` or opens the print dialog via `printing`.
- Color scheme: violet (`0xFF7C3AED`).

---

## REQ-020 · Mobile — Debtors & Creditors Reports
**Screen:** Mobile → Reports → Debtors / Creditors
**Status:** Implemented

### Debtors
- Lists all customers with an outstanding balance, grouped and sortable.
- Each card is expandable to show invoice-level breakdown: invoice no., date, total, paid, outstanding.
- Date range filter; search by customer name.
- Color scheme: indigo (`0xFF4F46E5`).

### Creditors
- Lists all vendors with an outstanding payable balance.
- Same expandable card pattern: bill no., date, total, paid, outstanding.
- Date range filter; search by vendor / creditor name.
- Both screens are permission-gated: hidden if the user's `reports` permission list does not include `'debtors'` / `'creditors'` respectively (null permissions = show all).
- Accessible via Reports screen and also surfaced as quick-access tiles on the Reports hub.

---

## REQ-021 · Winding 2 & Coating 2 — Permissions & Report Pages
**Pages:** `/settings` → Card Permissions · `/production/reports/winding2` · `/production/reports/coating2`
**Status:** Implemented

### Card Permissions (`/settings` → Card Permissions)
- The PCCP stage permission list in `UserCardPermissionsPage.tsx` includes `WINDING_2` and `COATING_2` checkboxes alongside Winding, Coating, Spinning, etc.
- Admins select a staff member and toggle which PCCP stages they can access.
- Granting `WINDING_2` / `COATING_2` makes those stage tiles appear for that user on the mobile PCCP entry grid (the mobile app already filters by the `pccp` permissions array, so no extra mobile change was needed).

### Winding 2 Report (`/production/reports/winding2`)
- Shows all `WINDING_2` production entries with a date range filter (presets: Today, Yesterday, Last 7/15/30 Days, This/Last Week, This Month, Last Month, This Year).
- Per-entry columns: Date · Pipe Name · Qty Completed · Qty Rejected · Contractor Name.
- CSV export via Download button.
- Sidebar nav entry: Production → Reports → **Winding 2 Report** (BarChart2 icon).

### Coating 2 Report (`/production/reports/coating2`)
- Identical structure to the Winding 2 Report but filtered to `COATING_2` entries.
- Sidebar nav entry: Production → Reports → **Coating 2 Report** (BarChart2 icon).

---

## REQ-022 · Mobile — GST Reports
**Screen:** Mobile → Reports → GST Report
**Status:** Implemented

- Three-tab layout: **GSTR-1**, **GSTR-3B**, **HSN Summary**.
- Date range picker (month/year) at the top of the screen.
- **GSTR-1 tab**: shows B2B Taxable, B2C Taxable, Total Taxable, CGST, SGST, IGST, and Grand Total; PDF export button that generates a formatted GSTR-1 summary PDF.
- **GSTR-3B tab**: shows outward supplies summary with CGST/SGST/IGST breakdown.
- **HSN Summary tab**: lists HSN-wise taxable value and tax amounts.
- Accessible from the Reports hub on mobile.

---

## REQ-023 · Mobile — Loaded Pipes (PDI / Dispatch Records)
**Screen:** Mobile → Business → Loaded Pipes (`/business/loaded-pipes`)
**Status:** Implemented

- Displays loading/dispatch records within a selected date range (default: last 30 days).
- Date range filter via an overlay dropdown (custom quick presets + from/to pickers).
- Search bar to filter records by pipe name, party name, or vehicle number.
- Each record card shows: loading date, pipe details, quantity, party name, vehicle number.
- Fetches up to 500 records via `getLoadingRecords(from, to, size: 500)`.
- Color scheme: violet-purple (`0xFF7C3AED`).

---

## REQ-024 · Web — PO Public Verify Page
**Page:** `/verify/po/:poNumber` (no login required)
**Status:** Implemented

- Public (unauthenticated) page that anyone with the PO number can access to check its status.
- Displays: PO number, current status badge (DRAFT / CONFIRMED / RECEIVED / CANCELLED), supplier name/address/GSTIN, and the line items with quantities.
- Fetches data from `/api/purchase-orders/public/:poNumber`.
- Handles not-found (displays "no purchase order found" message) and loading states.
- Uses the P&P branded dark-blue header (`#1e497d`); no login/navigation chrome.

---

## REQ-025 · Web — Quotation Public Verify Page
**Page:** `/verify/quotation/:quotationNumber` (no login required)
**Status:** Implemented

- Public (unauthenticated) page for customers to verify a quotation by its number.
- Displays: quotation number, status badge (DRAFT / SENT / ACCEPTED / REJECTED / EXPIRED), customer name/address/GSTIN, and line items with quantities.
- Fetches data from `/api/quotations/public/:quotationNumber`.
- Handles not-found and loading states with appropriate UI messages.
- Same P&P branded header as the PO verify page; no login/navigation chrome.

---

## REQ-026 · Site Management Module (Water Supply Pipeline Projects)
**Pages:** `/site` · `/site/projects` · `/site/contractors` · `/site/work-orders` · `/site/work-bills` · `/site/contractor-ledger`
**Status:** Implemented (5 active modules; 6 planned/coming-soon)

### Module Dashboard (`/site`)
- Responsive card grid with links to each sub-module.
- Cards marked **Coming Soon** are visible but not interactive (disabled links with a "Coming Soon" badge).

| Sub-Module | Status |
|---|---|
| Projects | ✅ Active |
| Contractors | ✅ Active |
| Work Orders | ✅ Active |
| Work Bills | ✅ Active |
| Contractor Ledger | ✅ Active |
| Material Stock | 🔲 Coming Soon |
| Material Issues | 🔲 Coming Soon |
| Progress Claims | 🔲 Coming Soon |
| Daily Progress | 🔲 Coming Soon |
| Financial Report | 🔲 Coming Soon |
| Progress Report | 🔲 Coming Soon |

---

### Projects (`/site/projects`)
Tracks all water supply pipeline projects — contract details, timelines, and work packages grouped by construction phase.

**Project List (`/site/projects`)**
- Status filter tabs: All, Active, On Hold, Completed (with live counts).
- Search by name, client, location or contract number.
- Project cards show: client name, location, contract number, contract value, start–end dates, status badge.
- Actions per card: Open Project, Edit, Delete (with confirmation).

**Project Fields:** Project Name, Client Name, Location, Contract Number, Contract Value (₹), Start Date, End Date, Status (Active / On Hold / Completed).

**Project Detail (`/site/projects/:id`)**
- Info strip: Contract Value, Start/End Dates, Status, Total Work Packages (Inhouse / Subcontracted / Completed).
- Work packages grouped by construction phase with per-phase progress bars.
- Filter by Execution Type (All / Inhouse / Subcontracted) and Phase (Excavation, Concrete, PSC/PCCP, HDPE, MS Specials, WUA, Testing, Other).
- **Work Package Fields:** Description, Location/Chainage, Planned Quantity (unit: m/m²/m³/LS/Nos/RMT/MT/KG), Execution Type, Phase, Status (Planned/In Progress/Completed/On Hold), Notes.
- Add/Edit work package via slide-in panel; Delete requires confirmation.

---

### Contractors (`/site/contractors`)
Master register of all sub-contractors referenced by Work Orders and Work Bills.

- Live search by name, contact person, or phone.
- Responsive card grid (1/2/3 columns) with initials avatar, company name, contact person, phone, email, location, GSTIN, PAN, notes snippet.
- Expand toggle on each card for full details.
- Context menu per card: Edit, Delete.
- Add Contractor: `+` button opens a 70vw slide-in panel.

**Contractor Fields:** Company Name, Contact Person, Phone, Email, Trade/Specialisation (Civil/Pipe Laying/Concrete/Fabrication/Electrical/Survey/Other), GSTIN, PAN, Street Address, City, State, Pincode, Notes.

---

### Work Orders (`/site/work-orders`)
Manages sub-contract agreements issued to contractors for specific scopes of site work.

**List (`/site/work-orders`)**
- Status tabs: All, Draft, Active, Completed, Billed (with live counts).
- Search by WO number, title, contractor name or location.
- Rows show: WO number, status badge, title, contractor, location, start date, service summary, contract value.

**Work Order Fields:** WO Number (auto-assigned, e.g. `WO/RWS/2024/001`), Contractor (searchable dropdown from Contractors register), Work Title, Location/Section, Start Date, Expected End Date, Scope of Work (line items: Description, Unit, Qty, Rate ₹, Amount auto-calc), Notes.

**Status Lifecycle:** Draft → Active → Completed → Billed

**Actions:**
- New Work Order: opens 70vw slide-in form.
- Edit: available for Draft and Active orders; **disabled once Billed**.
- Mark Active: Draft → Active.
- Mark Completed: Active → Completed.
- Generate Work Bill: available on Completed orders — creates a Work Bill pre-populated with WO services.
- Delete: **available for Draft orders only**; requires confirmation.

---

### Work Bills (`/site/work-bills`)
Records contractor invoices with GST (CGST/SGST for intra-state, IGST for inter-state), TDS deductions, and full payment tracking. Can be created from a completed Work Order or entered manually.

**List (`/site/work-bills`)**
- Status tabs: All, Draft, Approved, Paid (with counts).
- Aggregate summary bar: Total Payable, Total Paid, Outstanding (highlighted red).
- Search by bill number, contractor, WO title or WO number.
- Rows: bill number, WO reference, status badge, contractor, bill date, payment progress bar, net payable.

**Bill Fields:** Bill Number (auto-assigned), Contractor, Work Order (optional), Contractor Invoice No., Bill Date, Due Date, Billing Period From/To, Supply Type (Intra-State → CGST+SGST / Inter-State → IGST), TDS Deduction (None / 1% §194C Individual / 2% §194C Company/Firm), Service Lines, Notes.

**Service Line Fields:** Description, Unit, Contracted Qty (from WO, read-only reference), Actual Qty (editable), Rate ₹, GST%, Amount (auto-calc: Actual Qty × Rate), +GST column.

**Financial Summary:** Subtotal → + GST (CGST+SGST or IGST) → Gross Total → − TDS → **Net Payable**.

**Status Lifecycle:** Draft → Approved → Paid

**Actions:**
- Create New Bill: navigates to `/site/work-bills/new` (full-page form).
- Approve Bill: Draft → Approved.
- Record Payment: available on Approved bills with outstanding balance — modal with Date, Amount (pre-filled with outstanding), Payment Mode (Bank Transfer/Cheque/UPI/Cash), Reference Number (UTR/cheque/transaction ID). Multiple partial payments supported; bill transitions to Paid when balance = 0.
- Print Invoice: navigates to the printable Work Bill Invoice page.
- View Detail: click row → 70vw slide-in with full breakdown.

**New Work Bill (`/site/work-bills/new`):** 7-step creation flow — Select Contractor → Select Work Order (optional, auto-populates service rows) → Fill Dates → Set Supply Type & TDS → Edit service lines → Add extra rows → Review & Save. Sticky footer shows running total and Save/Cancel.

---

### Contractor Ledger (`/site/contractor-ledger`)
Per-contractor financial summary aggregated from all Work Bills.

**Columns per contractor:** Total Bills count, Subtotal, GST Amount, TDS Deducted, Net Payable, Total Paid, Outstanding (highlighted red when > 0).
- Running totals across all columns.
- Read-only reporting view; no create/edit actions.

---

### Coming Soon (Disabled — Visible as Placeholders)

| Module | Planned Functionality |
|---|---|
| Material Stock | Site inventory levels, material receipts and consumption per project location |
| Material Issues | Materials issued to contractors — quantity, date, approval tracking |
| Progress Claims | Contractor progress claims, work verification, payment approval |
| Daily Progress | Daily in-house work log, labour attendance, equipment usage, site activity notes |
| Financial Report | Full picture of invoices received, payments made, outstanding balances, cost summary |
| Progress Report | Phase-wise completion percentages, daily trends, project velocity over time |

---

## REQ-027 · Purchase Orders — Free-Text / Custom Line Items
**Page:** Purchases → Purchase Orders (Create / Edit PO)
**Status:** Implemented

- PO line items are **not locked to the product catalog** — the item name is a free-text input, allowing any product, machinery, service, or custom item to be added without it existing in the system.
- Each line item has two text fields: **Product / Item name** (required) and **Description / specifications** (optional second line for notes or spec details).
- An optional **catalog picker** icon sits next to the name field — selecting a catalog product auto-fills the unit cost and tax rate, but picking from the catalog is not mandatory.
- Pricing is **qty × unit cost** (not metres-based), so it works for pipes, raw materials, machinery, tools, services, fittings, or any other purchase.
- Certain internal-only products are excluded from the catalog picker even if they exist in the DB (e.g. `silo cement`, `loose cement`, `extra cement` — not externally purchasable).
- This means a single PO can mix catalog-linked items and fully custom free-text items in the same order.

---

## REQ-028 · WINDING_2 & COATING_2 — Stage Funnel Visibility Fix
**Pages:** Dashboard (`/dashboard`) · Reports Page (`/reports`)
**Status:** Implemented

Previously, pipes processed on the second Winding (WINDING_2) and second Coating (COATING_2) machines were invisible in the WIP stage funnel on both the Dashboard and the Reports page. They were being recorded in production entries correctly but never surfaced in the stage overview counts.

### What was fixed

**Backend (`production_order.go` — `GetStageOverview`)**
- Added `WINDING_2` and `COATING_2` CASE columns to the SQL query that powers the stage overview API.
- Added `Winding2` and `Coating2` fields to the `StageOverviewRow` struct (JSON: `winding2`, `coating2`).
- These now return alongside all other stage counts in the API response.

**Frontend — Reports Page (`/reports`)**
- Added `winding2: 'Winding 2'` and `coating2: 'Coating 2'` to `STAGE_LABELS`.
- `STAGE_KEYS` (derived from `STAGE_LABELS`) automatically picks them up, so the stage funnel bar chart now includes Winding 2 and Coating 2 bars.

**Frontend — Dashboard (`/dashboard`)**
- Added `winding2` (violet) and `coating2` (cyan-700) entries to the `ALL_STAGES` array.
- Both stages now appear in the dashboard's per-pipe stage breakdown table with distinct colour coding.

---

## REQ-029 · Production Material Mapping — Silo Cement & Extra Cement Fix
**Status:** Implemented

### Problem
Spinning and Coating entries were failing with "insufficient raw material stock" because pipe config material formulas were mapped to incorrect product IDs that had 0 stock.

### Changes Made

#### DB — Silo CEMENT mapping (all pipe configs)
- `pipe_config_materials`: all SPINNING rows using "Silo CEMENT" (id=8, 0 kg) → updated to **"Silo CEMENT (CORE)"** (id=189, 20,145 kg available)
- `pipe_config_materials`: all COATING rows using "Silo CEMENT" (id=8, 0 kg) → updated to **"Silo CEMENT (COATING)"** (id=193, 33,400 kg available)
- Affected: 1,048 SPINNING rows + 1,048 COATING rows across all pipe configs

#### DB — Extra Cement mapping (all pipe configs)
- `products` (Cement Bags, id=221): set `sale_uom = 'kg'`, `sale_factor = 50` (1 bag = 50 kg)
- `pipe_config_materials`: all SPINNING and COATING rows using "EXTRA CEMENT" (id=190, 0 kg) → updated to **"Cement Bags"** (id=221, 237 bags = 11,850 kg available)
- Backend already converts bag qty → kg for both stock check and deduction via `sale_factor`

#### Mobile — Inventory dual display
- `mobile/lib/models/models.dart`: added `saleFactor` and `saleUom` fields to `Product` model
- `mobile/lib/screens/inventory/inventory_screen.dart`: `_StockBadge` widget updated — products with a `sale_factor` now show both **nos (floor, whole number)** and **kg equivalent** (nos × sale_factor)
- Example: Cement Bags shows "237 nos / 11,850 kg"

#### Mobile — Fabrication prior stage fix
- `mobile/lib/screens/business/business_detail_screen.dart`: `_priorCompleted[oid]` is no longer stored when backend returns null `stageType` (i.e. FABRICATION — first stage, no prior stage). Falls back to `plannedQty` as the ceiling instead of treating 0 as "no pipes available from prior stage"

### Outstanding
- **CHEMICAL** (id=191) still has 0 stock — stock needs to be added manually via Inventory screen before Spinning entries that consume Chemical will succeed
- **CHEMICAL UOM** — resolved: product `unit_of_measure` changed from `litre` to `kg` (product id=191) to match pipe formula. Stock still needs to be added manually via Inventory screen.

---

## REQ-013 · Out of Office
**Status:** Pending

Staff members need to mark themselves as "Out of Office" (away, on leave, or on-site at a customer location). This status is visible to managers and affects scheduling and task assignment.

- Mobile app already has an Out of Office toggle in the left drawer for the logged-in user.
- Requirement: expand this into a proper out-of-office feature with date range, reason, and visibility to admins.
- Web app should show out-of-office status on the Staff page per user.
- Possible fields: From date, To date, Reason (Leave / On-site / Other), Notes.
- Admin view: list of who is currently out of office.

---

## REQ-014 · Loading + Invoice (Combined Dispatch Flow)
**Status:** Pending

When pipes are loaded onto a truck for dispatch, the operator needs to simultaneously generate a Loading Memo and an Invoice without switching between multiple screens. This is a single-flow screen combining both steps.

- **Trigger**: From a Sales Order or Dispatch entry, tap "Load + Invoice".
- **Step 1 — Loading details**: Select truck, driver, pipes being loaded (with qty), loading date.
- **Step 2 — Invoice generation**: Auto-populate invoice from the loaded quantities; confirm invoice amount, tax, and payment terms.
- **Output**: Creates a Loading record AND an Invoice in one submission.
- Available on both web and mobile.
- Reduces double-entry and prevents mismatch between loaded quantities and invoiced quantities.

---

## REQ-015 · Second Winding & Coating Machine (Winding 2 / Coating 2)
**Pages:** `/production/entry`
**Status:** Implemented

A second winding machine and a second coating machine were added to the PCCP production line. The production stage sequence expanded from 10 to 12 stages, with `WINDING_2` and `COATING_2` inserted immediately after the existing `WINDING` and `COATING` stages.

### Stage Sequence Change
- **Before (10 stages):** … → WINDING → COATING → CURING_2 → FINAL_TESTING
- **After (12 stages):** … → WINDING → COATING → **WINDING_2** → **COATING_2** → CURING_2 → FINAL_TESTING

### What Was Added
- `StageWinding2` (`WINDING_2`) and `StageCoating2` (`COATING_2`) added to `ProdStageType` enum and `StageSequence` array.
- Both new stages added to `MaterialStages` map — they consume materials (same as their counterparts).
- `MachineTypeWinding2` and `MachineTypeCoating2` added to the `MachineType` enum and `MACHINE_TYPES` frontend constant.

### Production Entry Page (`/production/entry`)
- Stage selector cards added for Winding 2 (indigo) and Coating 2 (violet) — same icons and colors as Winding and Coating respectively.
- **Coating 2 behaves identically to Coating:**
  - Shows the **Sand Mix toggle** (Plaster Sand / Crushed Sand) when selected.
  - Triggers the **Silo 3 balance check** — warns if mortar balance is insufficient.
  - Filters materials to the selected sand type before submission.
- `STAGE_COLS` updated so production summary columns show "Winding 2" and "Coating 2".
- Stage image map updated to reuse `winding.jpg` for Winding 2 and `coating.avif` for Coating 2.

### Frontend Types (`web/src/types/index.ts`)
- `PROD_STAGES` constant extended with `{ key: 'WINDING_2', label: 'Winding 2' }` and `{ key: 'COATING_2', label: 'Coating 2' }`.
- `MATERIAL_STAGES` array extended to include `'WINDING_2'` and `'COATING_2'`.
- `MACHINE_TYPES` constant extended with `WINDING_2` and `COATING_2` entries.

---
