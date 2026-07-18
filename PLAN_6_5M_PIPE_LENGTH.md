# Plan: 6.5m Pipe Length Support

## Context
The system currently supports only 5.25m pipes. A new 6.5m pipe size needs to be added alongside the existing one. The backend `PipeConfig` model already has a `length_m` field and `PipeConfigMaterial` rows are per-config, so the data model supports this natively. The gaps are in the frontend — the pipe config form has no length input, the TypeScript type is missing `lengthM`, and all meter↔qty conversions hardcode `5.25`.

---

## What Already Works (no code changes needed)
- `pipe_configs.length_m` is `decimal(5,2)` — already stores any length value
- `PipeConfigMaterial.quantityPerPipe` is per-config — a 6.5m config gets its own higher material quantities
- Production order + entry routing by `pipeConfigId` — no changes needed
- Material consumption calculation is per-config, per-stage — automatically correct once config is set up
- Bed type toggle (SMALL_BED / LARGE_BED) already exists in the mobile DEMOULDING form

---

## Changes Required

### 1. Add `lengthM` field to PipeConfigFormPage
**File:** `web/src/pages/production/PipeConfigFormPage.tsx`

The Details tab has no length input — without this, all new configs default to 5.25m in the DB. This is the most critical fix.

- Add `lengthM` to `defaultValues` (default: `5.25`, step: `0.01`)
- Add a number input in the Details tab UI
- Load `existingData.lengthM` on edit (alongside other fields at line ~71)
- Include `lengthM: Number(data.lengthM)` in the `onSaveDetails` payload (line ~143)
- Update the auto-name logic (line ~57): when `lengthM !== 5.25`, append it to the name — e.g. `PCCP 600mm 10kg 6.5m`

---

### 2. Add `lengthM` to TypeScript PipeConfig interface
**File:** `web/src/types/index.ts`

Add `lengthM: number` to the `PipeConfig` interface. The field is returned by the backend API but currently missing from the type, causing TypeScript to strip it.

---

### 3. Replace hardcoded `5.25` with dynamic `pipeConfig.lengthM` across frontend

**Pattern:** Wherever `METERS_PER_PIPE = 5.25` is declared or `5.25` is hardcoded in a meter↔qty conversion, replace with the selected pipe config's `lengthM` (fallback to `5.25` if not yet loaded).

| File | Location | Fix |
|---|---|---|
| `web/src/pages/production/PipeConfigFormPage.tsx` | Line 57 (auto-name) | Use `lengthM` in generated name when ≠ 5.25 |
| `web/src/pages/orders/CreateSalesOrderPage.tsx` | Line 296 | `Math.ceil(meters / (selectedConfig?.lengthM ?? 5.25))` |
| `web/src/pages/sales/QuotationsPage.tsx` | Module-level `METERS_PER_PIPE = 5.25` | Store `lengthM` on each `QuoteItem` when config is selected; use `item.lengthM ?? 5.25` per line |
| `web/src/pages/sales/InvoicesPage.tsx` | Module-level `METERS_PER_PIPE = 5.25` | Same approach as Quotations |
| `web/src/pages/business/LoadingPage.tsx` | Module-level `METERS_PER_PIPE = 5.25` | Use selected item's `lengthM` |
| `web/src/pages/business/ThirdPartyPipePurchasePage.tsx` | Line 16 `METERS_PER_PIPE = 5.25` | Use selected pipe config's `lengthM` |
| `web/src/pages/production/ProductionOrdersPage.tsx` | Lines 422, 435 `* 5.25` | `* (order.pipeConfig?.lengthM ?? 5.25)` |
| `web/src/pages/orders/SalesOrdersPage.tsx` | Line 207 `* 5.25` | `* (order.pipeConfig?.lengthM ?? 5.25)` |
| `web/src/pages/orders/SalesOrderDetailPage.tsx` | Line 102 `* 5.25` | `* (order.pipeConfig?.lengthM ?? 5.25)` |

**Note for Quotations/Invoices:** These are multi-line forms where each line can have a different pipe config. The fix is to add a `lengthM` field to the local `QuoteItem`/`InvoiceItem` state type, populate it when a pipe config is selected on that line, and use `item.lengthM ?? 5.25` in the meter↔qty conversion for that line.

---

### 4. Mobile — LARGE_BED enforcement for 6.5m pipes in Demoulding *(deferred)*
**File:** `mobile/lib/screens/business/business_detail_screen.dart`

To be handled separately. When implemented: if the selected production order's pipe config has `lengthM == 6.5`, hide the bed type toggle and auto-set `LARGE_BED` with a read-only label.

---

### 5. Data setup via admin UI (after code is deployed)
1. Go to `/production/pipe-configs` → New Pipe Configuration
2. Set Diameter, Pressure Class, **Length = 6.5m**, Name (e.g. `PCCP 600mm 10kg 6.5m`)
3. On the Raw Material Formula tab: add `PipeConfigMaterial` rows for FABRICATION, SPINNING, WINDING, COATING with `quantityPerPipe` values reflecting higher consumption for 6.5m pipes

---

## Verification
1. `cd web && npm run build` — zero TypeScript errors
2. Open `/production/pipe-configs/new` → Details tab shows a Length input → set 6.5 → name auto-appends "6.5m"
3. Create a Quotation with a 6.5m pipe item → enter 100 meters → qty = `ceil(100 / 6.5)` = 16 (not 19)
4. Create a Quotation with a 5.25m pipe item → enter 100 meters → qty = `ceil(100 / 5.25)` = 20 (unchanged)
5. Production Orders page → meters column shows correct value for both config types
6. Create a production order for the 6.5m config → production entries work normally
7. After a SPINNING entry, verify `material_consumptions` uses the 6.5m config's higher `quantityPerPipe`
