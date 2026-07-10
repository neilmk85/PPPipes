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
