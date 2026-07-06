package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
)

// ActivityLogWriter wraps http.ResponseWriter to capture response body
type activityLogWriter struct {
	http.ResponseWriter
	statusCode int
	body       bytes.Buffer
}

// UserBucket is a mutable holder injected into the request context by ActivityLog
// so that the Authenticate middleware (which runs later in the chain) can write
// the authenticated user back to the outer ActivityLog scope.
type UserBucket struct {
	User *AuthUser
}

const UserBucketKey contextKey = "userBucket"

func (alw *activityLogWriter) WriteHeader(statusCode int) {
	alw.statusCode = statusCode
	alw.ResponseWriter.WriteHeader(statusCode)
}

func (alw *activityLogWriter) Write(b []byte) (int, error) {
	if alw.statusCode == 0 {
		alw.statusCode = http.StatusOK
	}
	alw.body.Write(b)
	return alw.ResponseWriter.Write(b)
}

// ActivityLog middleware logs user actions to activity_logs table
func ActivityLog(db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only log mutating requests
			if !isMutatingMethod(r.Method) {
				next.ServeHTTP(w, r)
				return
			}

			// Skip logging for activity-logs and uploads paths
			if shouldSkipActivityLogging(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// Read request body
			var requestBody []byte
			if r.Body != nil {
				var err error
				requestBody, err = io.ReadAll(r.Body)
				if err != nil {
					slog.Error("[ActivityLog] Failed to read request body", "error", err)
					requestBody = []byte{}
				}
				// Restore request body for handler to read
				r.Body = io.NopCloser(bytes.NewBuffer(requestBody))
			}

			// Capture "before" state for entity updates so we can diff only changed fields.
			// Must be done before the handler runs.
			var beforeBody []byte
			if r.Method == http.MethodPatch || r.Method == http.MethodPut {
				_, resource := parsePath(r.URL.Path)
				entityID := extractEntityID(r.URL.Path)
				if entityID != nil {
					beforeBody = fetchBeforeState(db, resource, *entityID)
				}
			}

			// Inject a UserBucket into the context so that the Authenticate
			// middleware (which runs inside the per-route chain, after us) can
			// write the authenticated user back into this outer scope.
			bucket := &UserBucket{}
			ctx := context.WithValue(r.Context(), UserBucketKey, bucket)
			r = r.WithContext(ctx)

			// Wrap response writer
			alw := &activityLogWriter{ResponseWriter: w, statusCode: http.StatusOK}

			// Call next handler (auth + business logic run inside here)
			next.ServeHTTP(alw, r)

			// Only log successful responses (2xx)
			if alw.statusCode < 200 || alw.statusCode >= 300 {
				return
			}

			// Read user that was populated by Authenticate middleware
			user := bucket.User
			if user == nil {
				return
			}

			// Copy response body bytes before handing off to goroutine
			responseBody := make([]byte, alw.body.Len())
			copy(responseBody, alw.body.Bytes())

			// Log activity asynchronously
			go func() {
				action, module, description := describeActivity(r.Method, r.URL.Path, requestBody, responseBody, beforeBody)
				entityID := extractEntityID(r.URL.Path)

				userID := user.ID
				userName := user.Name
				userEmail := user.Email
				ip := getClientIP(r)
				log := models.ActivityLog{
					UserID:      &userID,
					UserName:    &userName,
					UserEmail:   &userEmail,
					OutletID:    user.OutletID,
					Action:      action,
					Module:      module,
					Description: description,
					EntityID:    entityID,
					IPAddress:   &ip,
				}

				if err := db.Create(&log).Error; err != nil {
					slog.Error("[ActivityLog] Failed to save activity log", "error", err)
				}
			}()
		})
	}
}

// isMutatingMethod checks if the HTTP method mutates data
func isMutatingMethod(method string) bool {
	return method == http.MethodPost ||
		method == http.MethodPut ||
		method == http.MethodPatch ||
		method == http.MethodDelete
}

// shouldSkipActivityLogging checks if the path should skip activity logging
func shouldSkipActivityLogging(path string) bool {
	skip := []string{
		"/api/activity-logs",
		"/api/uploads",
		"/api/users/preferences",
		"/api/cart-holds",
	}
	for _, s := range skip {
		if strings.HasPrefix(path, s) {
			return true
		}
	}
	return false
}

// ── Path helpers ───────────────────────────────────────────────────────────────

// parsePath returns (group, resource) from a path like /api/{resource}/...
// or /api/{group}/{resource}/... where group is "production" or "business".
func parsePath(path string) (group, resource string) {
	segs := strings.Split(strings.Trim(path, "/"), "/")
	// segs[0] == "api"
	if len(segs) < 2 {
		return "", ""
	}
	switch segs[1] {
	case "production", "business", "integrations":
		if len(segs) > 2 {
			return segs[1], segs[2]
		}
		return segs[1], ""
	default:
		return "", segs[1]
	}
}

// extractEntityID extracts the numeric ID from the URL path (last numeric segment).
func extractEntityID(path string) *int {
	segs := strings.Split(strings.Trim(path, "/"), "/")
	for i := len(segs) - 1; i >= 0; i-- {
		var id int
		if err := json.Unmarshal([]byte(segs[i]), &id); err == nil {
			return &id
		}
	}
	return nil
}

// ── Body helpers ───────────────────────────────────────────────────────────────

// bodyField extracts a string field from a flat JSON body.
func bodyField(body []byte, fields ...string) string {
	if len(body) == 0 {
		return ""
	}
	var m map[string]interface{}
	if json.Unmarshal(body, &m) != nil {
		return ""
	}
	for _, f := range fields {
		if v, ok := m[f]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
			if n, ok := v.(float64); ok {
				return fmt.Sprintf("%g", n)
			}
		}
	}
	return ""
}

// respField extracts a string field from {"data": {...}} response JSON.
func respField(resp []byte, fields ...string) string {
	if len(resp) == 0 {
		return ""
	}
	var outer map[string]interface{}
	if json.Unmarshal(resp, &outer) != nil {
		return ""
	}
	raw, ok := outer["data"]
	if !ok {
		return ""
	}
	data, ok := raw.(map[string]interface{})
	if !ok {
		return ""
	}
	for _, f := range fields {
		if v, ok := data[f]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
			if n, ok := v.(float64); ok && n != 0 {
				return fmt.Sprintf("%g", n)
			}
		}
	}
	return ""
}

// nestedRespField extracts a field from a nested object inside {"data": {outer: {field: value}}}.
// e.g. nestedRespField(resp, "product", "name") → data.product.name
func nestedRespField(resp []byte, objectKey, field string) string {
	if len(resp) == 0 {
		return ""
	}
	var outer map[string]interface{}
	if json.Unmarshal(resp, &outer) != nil {
		return ""
	}
	raw, ok := outer["data"]
	if !ok {
		return ""
	}
	data, ok := raw.(map[string]interface{})
	if !ok {
		return ""
	}
	nested, ok := data[objectKey]
	if !ok {
		return ""
	}
	obj, ok := nested.(map[string]interface{})
	if !ok {
		return ""
	}
	if v, ok := obj[field]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		if n, ok := v.(float64); ok {
			return fmt.Sprintf("%g", n)
		}
	}
	return ""
}

// label returns the first non-empty result from response body then request body,
// trying each field list in order.
func label(req, resp []byte, fields ...string) string {
	if s := respField(resp, fields...); s != "" {
		return s
	}
	return bodyField(req, fields...)
}

// ── Main describe function ─────────────────────────────────────────────────────

func describeActivity(method, path string, reqBody, respBody, beforeBody []byte) (string, string, string) {
	// Determine action verb
	action := "UPDATED"
	switch method {
	case http.MethodPost:
		action = "CREATED"
	case http.MethodDelete:
		action = "DELETED"
	}

	group, resource := parsePath(path)

	switch group {
	case "production":
		return describeProduction(action, resource, reqBody, respBody)
	case "business":
		return describeBusiness(action, resource, reqBody, respBody, beforeBody)
	}

	// Standard top-level resources
	return describeStandard(action, resource, path, reqBody, respBody, beforeBody)
}

// ── Standard resources ─────────────────────────────────────────────────────────

func describeStandard(action, resource, path string, req, resp, before []byte) (string, string, string) {
	switch resource {
	// ── Auth ──────────────────────────────────────────────────────────────────
	case "auth":
		subAction := bodyField(req, "action")
		if strings.Contains(subAction, "login") || strings.Contains(path, "/login") {
			return "LOGIN", "AUTH", "User logged in"
		}
		if strings.Contains(subAction, "logout") || strings.Contains(path, "/logout") {
			return "LOGOUT", "AUTH", "User logged out"
		}
		return action, "AUTH", descLine(action, "auth action", "")

	// ── Users / Staff ─────────────────────────────────────────────────────────
	case "users", "staff":
		name := label(req, resp, "name", "fullName", "full_name", "email")
		return action, "USERS", descLine(action, "user", name)

	// ── Outlets ───────────────────────────────────────────────────────────────
	case "outlets":
		name := label(req, resp, "name")
		return action, "OUTLETS", descLine(action, "outlet", name)

	// ── Products ──────────────────────────────────────────────────────────────
	case "products":
		name := label(req, resp, "name", "itemName", "productName")
		base := descLine(action, "product", name)
		if action == "CREATED" {
			base = buildCreatedFields(base, req, resp, [][2]string{
				{"SKU", "sku"},
				{"type", "itemType"},
				{"unit", "unitOfMeasure"},
				{"price", "sellingPrice"},
				{"HSN", "hsnCode"},
			})
		} else if action == "UPDATED" {
			// Only log fields that actually changed by diffing against the before state.
			// If no before state is available, fall back to listing all non-empty req fields.
			trackedFields := [][2]string{
				{"HSN code", "hsnCode"},
				{"tax group", "taxGroupId"},
				{"unit", "unitOfMeasure"},
				{"purchase UoM", "purchaseUom"},
				{"sale UoM", "saleUom"},
				{"purchase factor", "purchaseFactor"},
				{"sale factor", "saleFactor"},
				{"reorder level", "reorderLevel"},
				{"selling price", "sellingPrice"},
				{"cost price", "costPrice"},
				{"category", "categoryId"},
				{"SKU", "sku"},
				{"item type", "itemType"},
				{"name", "name"},
			}
			var changes []string
			if len(before) > 0 {
				// Diff: only include fields where req value differs from before value
				for _, pair := range trackedFields {
					reqVal := bodyField(req, pair[1])
					if reqVal == "" {
						continue // field not sent in request, skip
					}
					beforeVal := bodyField(before, pair[1])
					if fmtFieldVal(reqVal) != fmtFieldVal(beforeVal) {
						changes = append(changes, pair[0]+": "+beforeVal+" → "+reqVal)
					}
				}
			} else {
				// No before state — just list non-empty req fields (fallback)
				for _, pair := range trackedFields {
					if v := bodyField(req, pair[1]); v != "" {
						changes = append(changes, pair[0]+": "+v)
					}
				}
			}
			if len(changes) > 0 {
				base = base + " — " + strings.Join(changes, ", ")
			}
		}
		return action, "PRODUCTS", base

	// ── Categories ────────────────────────────────────────────────────────────
	case "categories":
		name := label(req, resp, "name")
		return action, "CATEGORIES", descLine(action, "category", name)

	// ── Customers ─────────────────────────────────────────────────────────────
	case "customers":
		name := label(req, resp, "name", "customerName", "businessName", "displayName")
		base := descLine(action, "customer", name)
		if action == "CREATED" {
			base = buildCreatedFields(base, req, resp, [][2]string{
				{"phone", "phone"}, {"email", "email"}, {"city", "city"},
				{"GSTIN", "gstin"}, {"segment", "segment"},
			})
		}
		return action, "CUSTOMERS", base

	// ── Vendors ───────────────────────────────────────────────────────────────
	case "vendors":
		name := label(req, resp, "name", "vendorName", "companyName")
		base := descLine(action, "vendor", name)
		if action == "CREATED" {
			base = buildCreatedFields(base, req, resp, [][2]string{
				{"contact", "contactPerson"}, {"phone", "phone"}, {"email", "email"},
				{"city", "city"}, {"state", "state"}, {"GSTIN", "gstin"}, {"PAN", "pan"},
			})
		}
		return action, "VENDORS", base

	// ── Orders (POS / sales) ──────────────────────────────────────────────────
	case "orders":
		num := label(req, resp, "orderNumber", "order_number", "number")
		base := descLine(action, "order", num)
		if action == "CREATED" {
			if total := label(req, resp, "totalAmount", "total"); total != "" {
				base += " — total: ₹" + total
			}
		}
		return action, "ORDERS", base

	// ── Invoices ──────────────────────────────────────────────────────────────
	case "invoices":
		num := label(req, resp, "invoiceNumber", "invoice_number", "number")
		base := descLine(action, "invoice", num)
		if total := label(req, resp, "totalAmount", "grandTotal"); total != "" {
			base += " — ₹" + total
		}
		return action, "INVOICES", base

	// ── Quotations ────────────────────────────────────────────────────────────
	case "quotations":
		num := label(req, resp, "quotationNumber", "quotation_number", "number")
		return action, "QUOTATIONS", descLine(action, "quotation", num)

	// ── Sales orders ──────────────────────────────────────────────────────────
	case "sales-orders":
		num := label(req, resp, "soNumber", "orderNumber", "number")
		base := descLine(action, "sales order", num)
		if customer := nestedRespField(resp, "customer", "name"); customer != "" {
			base += " — customer: " + customer
		}
		if total := label(req, resp, "totalAmount"); total != "" {
			base += " — ₹" + total
		}
		if strings.Contains(path, "/confirm") {
			return "UPDATED", "SALES_ORDERS", "Confirmed sales order: " + num
		}
		if strings.Contains(path, "/cancel") {
			return "UPDATED", "SALES_ORDERS", "Cancelled sales order: " + num
		}
		return action, "SALES_ORDERS", base

	// ── Purchase orders ───────────────────────────────────────────────────────
	case "purchase-orders":
		num := label(req, resp, "poNumber", "orderNumber", "number")
		base := descLine(action, "purchase order", num)
		if vendor := label(req, resp, "vendorName", "vendor"); vendor != "" {
			base += " — vendor: " + vendor
		}
		return action, "PURCHASES", base

	// ── Purchase bills ────────────────────────────────────────────────────────
	case "purchase-bills":
		num := label(req, resp, "billNumber", "invoiceNumber", "number")
		base := descLine(action, "purchase bill", num)
		if total := label(req, resp, "totalAmount", "grandTotal"); total != "" {
			base += " — ₹" + total
		}
		return action, "PURCHASES", base

	// ── Bulk purchases ────────────────────────────────────────────────────────
	case "bulk-purchases":
		num := label(req, resp, "referenceNumber", "number")
		return action, "PURCHASES", descLine(action, "bulk purchase", num)

	// ── Purchase returns ──────────────────────────────────────────────────────
	case "purchase-returns":
		num := label(req, resp, "returnNumber", "referenceNumber", "number")
		return action, "PURCHASES", descLine(action, "purchase return", num)

	// ── Credit notes ──────────────────────────────────────────────────────────
	case "credit-notes":
		num := label(req, resp, "creditNoteNumber", "number")
		return action, "CREDIT_NOTES", descLine(action, "credit note", num)

	// ── Inventory ─────────────────────────────────────────────────────────────
	case "inventory":
		// Extract the product name from the response (embedded product object)
		productName := nestedRespField(resp, "product", "name")
		if productName == "" {
			productName = respField(resp, "productName")
		}

		// Stock adjustment: POST /api/inventory/adjustments
		if strings.Contains(path, "/adjustments") {
			qty := bodyField(req, "quantity")
			reason := bodyField(req, "reason")
			notes := bodyField(req, "notes")
			base := "Stock adjusted"
			if productName != "" {
				base += ": " + productName
			}
			if qty != "" {
				if !strings.HasPrefix(qty, "-") {
					qty = "+" + qty
				}
				base += " " + qty
			}
			if reason != "" {
				base += " (" + strings.ReplaceAll(strings.ToLower(reason), "_", " ") + ")"
			}
			if notes != "" {
				base += " — " + notes
			}
			return "UPDATED", "INVENTORY", base
		}

		// Reorder level: PATCH /api/inventory/reorder-level
		if strings.Contains(path, "/reorder-level") {
			reorder := bodyField(req, "reorderLevel")
			base := "Reorder level updated"
			if productName != "" {
				base += ": " + productName
			}
			if reorder != "" {
				base += " → " + reorder
			}
			return "UPDATED", "INVENTORY", base
		}

		// Transfer
		if strings.Contains(path, "/transfers") {
			fromOutlet := bodyField(req, "fromOutletName")
			toOutlet := bodyField(req, "toOutletName")
			if fromOutlet != "" && toOutlet != "" {
				return action, "INVENTORY", fmt.Sprintf("%s transfer: %s → %s", actionVerb(action), fromOutlet, toOutlet)
			}
			return action, "INVENTORY", descLine(action, "stock transfer", "")
		}

		return action, "INVENTORY", descLine(action, "inventory", productName)

	// ── Stock adjustments / transfers ─────────────────────────────────────────
	case "stock-adjustments":
		ref := label(req, resp, "referenceNumber", "reason")
		return action, "STOCK", descLine(action, "stock adjustment", ref)

	case "stock-transfers":
		ref := label(req, resp, "referenceNumber", "transferNumber")
		return action, "STOCK", descLine(action, "stock transfer", ref)

	// ── Expenses ──────────────────────────────────────────────────────────────
	case "expenses":
		name := label(req, resp, "description", "name", "title")
		base := descLine(action, "expense", name)
		if amt := label(req, resp, "amount"); amt != "" {
			base += " — ₹" + amt
		}
		return action, "EXPENSES", base

	case "expense-categories":
		name := label(req, resp, "name")
		return action, "EXPENSES", descLine(action, "expense category", name)

	// ── Discounts / coupons ───────────────────────────────────────────────────
	case "discounts":
		name := label(req, resp, "name", "code")
		return action, "DISCOUNTS", descLine(action, "discount", name)

	case "coupons":
		code := label(req, resp, "code", "name")
		return action, "DISCOUNTS", descLine(action, "coupon", code)

	// ── Price lists ───────────────────────────────────────────────────────────
	case "price-lists":
		name := label(req, resp, "name")
		return action, "PRICING", descLine(action, "price list", name)

	// ── Tax groups ────────────────────────────────────────────────────────────
	case "tax-groups":
		name := label(req, resp, "name")
		base := descLine(action, "tax group", name)
		if rate := label(req, resp, "totalRate"); rate != "" {
			base += " (" + rate + "%)"
		}
		return action, "TAX", base

	// ── Roles ─────────────────────────────────────────────────────────────────
	case "roles", "custom-roles":
		name := label(req, resp, "name")
		return action, "ROLES", descLine(action, "role", name)

	// ── Incentives ────────────────────────────────────────────────────────────
	case "incentives":
		name := label(req, resp, "name", "title")
		return action, "INCENTIVES", descLine(action, "incentive", name)

	// ── Shifts ────────────────────────────────────────────────────────────────
	case "shifts":
		if strings.Contains(path, "/open") {
			return "CREATED", "SHIFTS", "Shift opened"
		}
		if strings.Contains(path, "/close") {
			return "UPDATED", "SHIFTS", "Shift closed"
		}
		return action, "SHIFTS", descLine(action, "shift", "")

	// ── Vendor payments / credits ─────────────────────────────────────────────
	case "vendor-payments":
		ref := label(req, resp, "referenceNumber", "number")
		base := descLine(action, "vendor payment", ref)
		if amt := label(req, resp, "amount"); amt != "" {
			base += " — ₹" + amt
		}
		return action, "PURCHASES", base

	case "vendor-credits":
		ref := label(req, resp, "referenceNumber", "number")
		return action, "PURCHASES", descLine(action, "vendor credit", ref)

	// ── Default ───────────────────────────────────────────────────────────────
	default:
		human := strings.ReplaceAll(resource, "-", " ")
		name := label(req, resp, "name", "number", "code", "title")
		return action, strings.ToUpper(resource), descLine(action, human, name)
	}
}

// ── Production resources ───────────────────────────────────────────────────────

func describeProduction(action, resource string, req, resp []byte) (string, string, string) {
	switch resource {
	case "pipe-configs":
		name := label(req, resp, "name")
		return action, "PRODUCTION", descLine(action, "pipe config", name)

	case "orders":
		num := label(req, resp, "poNumber", "orderNumber", "number")
		qty := bodyField(req, "plannedQty")
		if num != "" && qty != "" {
			return action, "PRODUCTION", fmt.Sprintf("%s production order: %s (%s pipes planned)", actionVerb(action), num, qty)
		}
		return action, "PRODUCTION", descLine(action, "production order", num)

	case "entries":
		stage := label(req, resp, "stageType")
		processed := label(req, resp, "pipesProcessed")
		completed := label(req, resp, "pipesCompleted")
		pipeConfig := respField(resp, "pipeConfigName")
		if pipeConfig == "" {
			pipeConfig = bodyField(req, "pipeConfigName")
		}

		if stage != "" {
			stageHuman := strings.ReplaceAll(strings.ToLower(stage), "_", " ")
			detail := stageHuman
			if processed != "" && processed != "0" {
				detail += fmt.Sprintf(": %s pipes processed", processed)
				if completed != "" && completed != processed && completed != "0" {
					detail += fmt.Sprintf(", %s completed", completed)
				}
			}
			if pipeConfig != "" {
				detail = pipeConfig + " — " + detail
			}
			return action, "PRODUCTION", fmt.Sprintf("Recorded production entry: %s", detail)
		}
		return action, "PRODUCTION", "Recorded production entry"

	case "machines":
		name := label(req, resp, "name")
		return action, "PRODUCTION", descLine(action, "machine", name)

	case "shift-templates":
		name := label(req, resp, "name", "shiftName")
		return action, "PRODUCTION", descLine(action, "shift template", name)

	case "overhead-configs":
		name := label(req, resp, "name", "description")
		return action, "PRODUCTION", descLine(action, "overhead config", name)

	default:
		human := strings.ReplaceAll(resource, "-", " ")
		name := label(req, resp, "name", "number")
		return action, "PRODUCTION", descLine(action, "production "+human, name)
	}
}

// ── Business resources ─────────────────────────────────────────────────────────

func describeBusiness(action, resource string, req, resp, before []byte) (string, string, string) {
	switch resource {
	case "cement-bags":
		qty := bodyField(req, "quantity")
		date := bodyField(req, "date")
		base := "cement bag record"
		if date != "" {
			base += " on " + date
		}
		switch action {
		case "CREATED":
			if qty != "" {
				return action, "BUSINESS", fmt.Sprintf("Added cement bag entry — %s bags on %s", qty, date)
			}
			return action, "BUSINESS", descLine(action, "cement bag record", "")
		case "UPDATED":
			if len(before) > 0 {
				beforeQty := bodyField(before, "quantity")
				beforeDate := bodyField(before, "date")
				if beforeDate == "" { beforeDate = date }
				var changes []string
				if qty != "" && qty != beforeQty {
					changes = append(changes, fmt.Sprintf("quantity: %s → %s bags", beforeQty, qty))
				}
				if newDate := bodyField(req, "date"); newDate != "" && newDate != beforeDate {
					changes = append(changes, fmt.Sprintf("date: %s → %s", beforeDate, newDate))
				}
				if notes := bodyField(req, "notes"); notes != "" {
					prevNotes := bodyField(before, "notes")
					if notes != prevNotes {
						changes = append(changes, "notes updated")
					}
				}
				if len(changes) > 0 {
					return action, "BUSINESS", fmt.Sprintf("Updated cement bag record — %s", strings.Join(changes, ", "))
				}
			}
			if qty != "" {
				return action, "BUSINESS", fmt.Sprintf("Updated cement bag record — quantity: %s bags", qty)
			}
			return action, "BUSINESS", descLine(action, "cement bag record", "")
		default:
			return action, "BUSINESS", descLine(action, base, "")
		}

	case "vehicles":
		name := label(req, resp, "vehicleNumber", "name", "number")
		return action, "BUSINESS", descLine(action, "vehicle", name)

	case "maintenance":
		name := label(req, resp, "description", "name", "vehicleNumber")
		return action, "BUSINESS", descLine(action, "maintenance record", name)

	case "silos":
		name := label(req, resp, "name", "siloNumber")
		return action, "BUSINESS", descLine(action, "silo", name)

	case "silo-extractions":
		ref := label(req, resp, "referenceNumber", "siloName")
		return action, "BUSINESS", descLine(action, "silo extraction", ref)

	case "diesel-maintenance":
		ref := label(req, resp, "vehicleNumber", "description")
		return action, "BUSINESS", descLine(action, "diesel record", ref)

	case "store-room-materials":
		name := label(req, resp, "materialName", "name")
		return action, "BUSINESS", descLine(action, "store room material", name)

	case "extra-vehicles":
		name := label(req, resp, "vehicleNumber", "name")
		return action, "BUSINESS", descLine(action, "extra vehicle", name)

	case "testing-labs":
		name := label(req, resp, "name", "labName")
		return action, "BUSINESS", descLine(action, "testing lab", name)

	case "conversions":
		name := label(req, resp, "name", "description")
		return action, "BUSINESS", descLine(action, "conversion", name)

	default:
		human := strings.ReplaceAll(resource, "-", " ")
		name := label(req, resp, "name", "number", "referenceNumber")
		return action, "BUSINESS", descLine(action, human, name)
	}
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

// actionVerb returns a past-tense verb for the action.
func actionVerb(action string) string {
	switch action {
	case "CREATED":
		return "Created"
	case "DELETED":
		return "Deleted"
	default:
		return "Updated"
	}
}

// descLine builds "Created product: PCCP 400mm" or "Created product" if no label.
func descLine(action, thing, lbl string) string {
	base := actionVerb(action) + " " + thing
	if lbl != "" {
		return base + ": " + lbl
	}
	return base
}

// buildCreatedFields appends key field details to a CREATE description.
// fields is a list of [label, jsonField, ...] pairs.
// Result: "Created vendor: Vendor 1 — phone: 9876543210, email: v@v.com"
func buildCreatedFields(base string, req, resp []byte, pairs [][2]string) string {
	var details []string
	for _, p := range pairs {
		if v := label(req, resp, p[1]); v != "" {
			details = append(details, p[0]+": "+v)
		}
	}
	if len(details) == 0 {
		return base
	}
	return base + " — " + strings.Join(details, ", ")
}

// fetchBeforeState loads the current DB state for a known resource so the
// activity logger can diff only the fields that actually changed.
// Returns the record as JSON, or nil if unsupported / not found.
func fetchBeforeState(db *gorm.DB, resource string, id int) []byte {
	switch resource {
	case "products":
		var p models.Product
		if db.Select("id,name,sku,category_id,tax_group_id,cost_price,selling_price,hsn_code,unit_of_measure,purchase_uom,sale_uom,purchase_factor,sale_factor,item_type,reorder_level").
			First(&p, id).Error != nil {
			return nil
		}
		b, _ := json.Marshal(p)
		return b
	}
	return nil
}

// fmtFieldVal normalises a field value string for comparison:
// trims spaces, removes trailing zeros on decimals (e.g. "1.0000" → "1").
func fmtFieldVal(v string) string {
	v = strings.TrimSpace(v)
	// If it looks like a number, normalise it
	if f, err := fmt.Sscanf(v, "%g", new(float64)); f == 1 && err == nil {
		var n float64
		fmt.Sscanf(v, "%g", &n)
		return fmt.Sprintf("%g", n)
	}
	return v
}
