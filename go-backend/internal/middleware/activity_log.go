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
		if customer := nestedRespField(resp, "customer", "name"); customer != "" {
			base += " — customer: " + customer
		}
		if total := label(req, resp, "totalAmount", "total"); total != "" {
			base += " — ₹" + total
		}
		return action, "ORDERS", base

	// ── Invoices ──────────────────────────────────────────────────────────────
	case "invoices":
		num := label(req, resp, "invoiceNumber", "invoice_number", "number")
		base := descLine(action, "invoice", num)
		if customer := nestedRespField(resp, "customer", "name"); customer != "" {
			base += " — customer: " + customer
		}
		if total := label(req, resp, "totalAmount", "grandTotal"); total != "" {
			base += " — ₹" + total
		}
		return action, "INVOICES", base

	// ── Quotations ────────────────────────────────────────────────────────────
	case "quotations":
		num := label(req, resp, "quotationNumber", "quotation_number", "number")
		base := descLine(action, "quotation", num)
		if customer := nestedRespField(resp, "customer", "name"); customer != "" {
			base += " — customer: " + customer
		}
		if total := label(req, resp, "totalAmount", "grandTotal"); total != "" {
			base += " — ₹" + total
		}
		return action, "QUOTATIONS", base

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
		if strings.Contains(path, "/cancel") {
			return "UPDATED", "SALES_ORDERS", "Cancelled sales order: " + num
		}
		return action, "SALES_ORDERS", base

	// ── Purchase orders ───────────────────────────────────────────────────────
	case "purchase-orders":
		num := label(req, resp, "poNumber", "orderNumber", "number")
		base := descLine(action, "purchase order", num)
		vendor := nestedRespField(resp, "supplier", "name")
		if vendor == "" {
			vendor = label(req, resp, "vendorName", "vendor")
		}
		if vendor != "" {
			base += " — " + vendor
		}
		if summary := poItemsSummary(req, resp); summary != "" {
			base += " — " + summary
		}
		if total := respField(resp, "totalAmount"); total != "" {
			base += " — ₹" + total
		}
		if expDate := respField(resp, "expectedDate"); expDate != "" {
			base += " — due: " + expDate[:10]
		}
		return action, "PURCHASES", base

	// ── Purchase bills ────────────────────────────────────────────────────────
	case "purchase-bills":
		num := label(req, resp, "billNumber", "invoiceNumber", "number")
		base := descLine(action, "purchase bill", num)
		vendor := label(req, resp, "vendorName")
		if vendor == "" {
			vendor = nestedRespField(resp, "vendor", "name")
		}
		if vendor != "" {
			base += " — vendor: " + vendor
		}
		if total := label(req, resp, "totalAmount", "grandTotal"); total != "" {
			base += " — ₹" + total
		}
		return action, "PURCHASES", base

	// ── Bulk purchases ────────────────────────────────────────────────────────
	case "bulk-purchases":
		num := label(req, resp, "referenceNumber", "number")
		base := descLine(action, "bulk purchase", num)
		if vendor := label(req, resp, "vendorName"); vendor != "" {
			base += " — vendor: " + vendor
		}
		if total := label(req, resp, "totalAmount", "grandTotal"); total != "" {
			base += " — ₹" + total
		}
		return action, "PURCHASES", base

	// ── Purchase returns ──────────────────────────────────────────────────────
	case "purchase-returns":
		num := label(req, resp, "returnNumber", "referenceNumber", "number")
		base := descLine(action, "purchase return", num)
		if vendor := nestedRespField(resp, "vendor", "name"); vendor != "" {
			base += " — vendor: " + vendor
		}
		return action, "PURCHASES", base

	// ── Credit notes ──────────────────────────────────────────────────────────
	case "credit-notes":
		num := label(req, resp, "creditNoteNumber", "number")
		base := descLine(action, "credit note", num)
		if customer := nestedRespField(resp, "customer", "name"); customer != "" {
			base += " — customer: " + customer
		}
		if amt := label(req, resp, "totalAmount", "amount"); amt != "" {
			base += " — ₹" + amt
		}
		return action, "CREDIT_NOTES", base

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
		vendor := label(req, resp, "vendorName")
		if vendor == "" {
			vendor = nestedRespField(resp, "vendor", "name")
		}
		if vendor != "" {
			base += " — vendor: " + vendor
		}
		if amt := label(req, resp, "amount", "totalAmount"); amt != "" {
			base += " — ₹" + amt
		}
		return action, "PURCHASES", base

	case "vendor-credits":
		ref := label(req, resp, "referenceNumber", "number")
		base := descLine(action, "vendor credit", ref)
		if vendor := nestedRespField(resp, "vendor", "name"); vendor != "" {
			base += " — vendor: " + vendor
		}
		if amt := label(req, resp, "amount", "totalAmount"); amt != "" {
			base += " — ₹" + amt
		}
		return action, "PURCHASES", base

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
		pipeConfig := nestedRespField(resp, "pipeConfig", "name")
		if pipeConfig == "" {
			pipeConfig = respField(resp, "pipeConfigName")
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
		process := label(req, resp, "process", "description", "name")
		vendor := label(req, resp, "vendor")
		amount := label(req, resp, "amount")
		base := actionVerb(action) + " maintenance record"
		if process != "" { base += ": " + process }
		if vendor != "" { base += " — " + vendor }
		if amount != "" { base += " — ₹" + amount }
		return action, "BUSINESS", base

	case "silos":
		name := label(req, resp, "name", "siloNumber")
		return action, "BUSINESS", descLine(action, "silo", name)

	case "silo-fills":
		date := bodyField(req, "date")
		s1 := bodyField(req, "silo1Value")
		s2 := bodyField(req, "silo2Value")
		s3 := bodyField(req, "silo3Value")
		var parts []string
		if s1 != "" {
			u1 := bodyField(req, "silo1Unit")
			if u1 == "" { u1 = "MT" }
			parts = append(parts, fmt.Sprintf("Silo 1: %s %s", s1, u1))
		}
		if s2 != "" {
			u2 := bodyField(req, "silo2Unit")
			if u2 == "" { u2 = "MT" }
			parts = append(parts, fmt.Sprintf("Silo 2: %s %s", s2, u2))
		}
		if s3 != "" {
			u3 := bodyField(req, "silo3Unit")
			if u3 == "" { u3 = "MT" }
			parts = append(parts, fmt.Sprintf("Silo 3: %s %s", s3, u3))
		}
		base := actionVerb(action) + " silo fill"
		if date != "" { base += " on " + date }
		if len(parts) > 0 { base += " — " + strings.Join(parts, ", ") }
		return action, "BUSINESS", base

	case "silo-extractions":
		date := bodyField(req, "date")
		siloNum := bodyField(req, "siloNumber")
		qty := bodyField(req, "quantityMt")
		base := actionVerb(action) + " silo extraction"
		if date != "" { base += " on " + date }
		if siloNum != "" { base += " — Silo " + siloNum }
		if qty != "" { base += ": " + qty + " MT" }
		return action, "BUSINESS", base

	case "loading-records":
		dc := label(req, resp, "deliveryChallanNo")
		pipeName := label(req, resp, "pipeName")
		qty := label(req, resp, "quantity")
		customer := label(req, resp, "customerName")
		base := actionVerb(action) + " loading record"
		if dc != "" { base += ": DC " + dc }
		if pipeName != "" { base += " — " + pipeName }
		if qty != "" { base += " × " + qty + " pipes" }
		if customer != "" { base += " — " + customer }
		return action, "BUSINESS", base

	case "pdis":
		pipeName := label(req, resp, "pipeName")
		qty := label(req, resp, "quantity")
		inspector := label(req, resp, "thirdParty")
		date := bodyField(req, "date")
		base := actionVerb(action) + " PDI"
		if pipeName != "" { base += ": " + pipeName }
		if qty != "" { base += " × " + qty + " pipes" }
		if inspector != "" { base += " — inspector: " + inspector }
		if date != "" { base += " on " + date }
		return action, "BUSINESS", base

	case "cuttings":
		fromSheet := label(req, resp, "fromSheet")
		toSheet := label(req, resp, "toSheet")
		qty := label(req, resp, "quantity")
		base := actionVerb(action) + " cutting"
		if fromSheet != "" && toSheet != "" { base += ": " + fromSheet + " → " + toSheet }
		if qty != "" { base += " × " + qty }
		return action, "BUSINESS", base

	case "discards":
		pipeName := label(req, resp, "pipeName")
		qty := label(req, resp, "quantity")
		process := label(req, resp, "process")
		base := actionVerb(action) + " discard"
		if pipeName != "" { base += ": " + pipeName }
		if qty != "" { base += " × " + qty }
		if process != "" { base += " (" + process + ")" }
		return action, "BUSINESS", base

	case "labour":
		contractor := label(req, resp, "contractorName")
		count := label(req, resp, "labourCount")
		date := bodyField(req, "date")
		base := actionVerb(action) + " labour record"
		if contractor != "" { base += ": " + contractor }
		if count != "" { base += " — " + count + " workers" }
		if date != "" { base += " on " + date }
		return action, "BUSINESS", base

	case "pipe-purchases":
		pipeName := label(req, resp, "pipeName")
		qty := label(req, resp, "quantity")
		vendor := label(req, resp, "vendor")
		base := actionVerb(action) + " pipe purchase"
		if pipeName != "" { base += ": " + pipeName }
		if qty != "" { base += " × " + qty + " pipes" }
		if vendor != "" { base += " — " + vendor }
		return action, "BUSINESS", base

	case "diesel-maintenance":
		process := label(req, resp, "process")
		qty := label(req, resp, "quantity")
		date := bodyField(req, "date")
		base := actionVerb(action) + " diesel record"
		if process != "" { base += ": " + process }
		if qty != "" { base += " — " + qty + " L" }
		if date != "" { base += " on " + date }
		return action, "BUSINESS", base

	case "store-room-materials":
		itemName := label(req, resp, "itemName", "materialName", "name")
		qty := label(req, resp, "quantity")
		uom := label(req, resp, "uom")
		base := actionVerb(action) + " store room material"
		if itemName != "" { base += ": " + itemName }
		if qty != "" {
			if uom != "" { base += " — " + qty + " " + uom } else { base += " — qty: " + qty }
		}
		return action, "BUSINESS", base

	case "conversions":
		fromPipe := label(req, resp, "fromPipe")
		toPipe := label(req, resp, "toPipe")
		qty := label(req, resp, "quantity")
		base := actionVerb(action) + " pipe conversion"
		if fromPipe != "" && toPipe != "" { base += ": " + fromPipe + " → " + toPipe }
		if qty != "" { base += " × " + qty }
		return action, "BUSINESS", base

	case "testing-labs":
		date := bodyField(req, "date")
		base := actionVerb(action) + " testing lab record"
		if date != "" { base += " on " + date }
		return action, "BUSINESS", base

	case "extra-vehicles":
		vendor := label(req, resp, "vendor")
		date := bodyField(req, "date")
		base := actionVerb(action) + " extra vehicle record"
		if vendor != "" { base += ": " + vendor }
		if date != "" { base += " on " + date }
		return action, "BUSINESS", base

	case "extra-fab":
		desc := label(req, resp, "description", "name")
		date := bodyField(req, "date")
		base := actionVerb(action) + " extra fab record"
		if desc != "" { base += ": " + desc }
		if date != "" { base += " on " + date }
		return action, "BUSINESS", base

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

// poItemsSummary extracts a readable summary of purchase order items from
// the response body (data.items[]) or request body (items[]).
func poItemsSummary(req, resp []byte) string {
	items := extractItems(resp, true)
	if len(items) == 0 {
		items = extractItems(req, false)
	}
	if len(items) == 0 {
		return ""
	}
	limit := 2
	if len(items) < limit {
		limit = len(items)
	}
	var parts []string
	for i := 0; i < limit; i++ {
		item, ok := items[i].(map[string]interface{})
		if !ok {
			continue
		}
		desc := ""
		for _, key := range []string{"description", "productName", "name"} {
			if v, ok := item[key].(string); ok && v != "" {
				desc = v
				break
			}
		}
		// Fall back to nested product.name if item-level description is empty
		if desc == "" {
			if prod, ok := item["product"].(map[string]interface{}); ok {
				if v, ok := prod["name"].(string); ok && v != "" {
					desc = v
				}
			}
		}
		qty := ""
		for _, key := range []string{"orderedQuantity", "quantity"} {
			if v, ok := item[key].(float64); ok && v != 0 {
				qty = fmt.Sprintf("%g", v)
				break
			}
		}
		if desc != "" {
			if qty != "" {
				parts = append(parts, desc+" ×"+qty)
			} else {
				parts = append(parts, desc)
			}
		}
	}
	result := strings.Join(parts, ", ")
	if len(items) > limit {
		result += fmt.Sprintf(" +%d more", len(items)-limit)
	}
	return result
}

func extractItems(body []byte, nested bool) []interface{} {
	if len(body) == 0 {
		return nil
	}
	var m map[string]interface{}
	if json.Unmarshal(body, &m) != nil {
		return nil
	}
	src := m
	if nested {
		data, ok := m["data"].(map[string]interface{})
		if !ok {
			return nil
		}
		src = data
	}
	items, _ := src["items"].([]interface{})
	return items
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
