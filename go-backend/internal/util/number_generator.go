package util

import (
	"crypto/rand"
	"fmt"
	"sync"
	"time"

	"gorm.io/gorm"
)

type NumberGenerator struct {
	mu sync.Mutex
}

var ng = &NumberGenerator{}

// Sequence model for database lookups
type Sequence struct {
	ID    uint   `gorm:"primaryKey"`
	Name  string `gorm:"uniqueIndex;size:191"`
	Value int64
}

func GenerateOrderNumber(db *gorm.DB, outletCode string) (string, error) {
	num, err := getNextSequenceValue(db, "order_sequence")
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("ORD-%s-%d", outletCode, num), nil
}

func GenerateInvoiceNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "invoice_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	return fmt.Sprintf("INV-%s-%d", dateStr, num), nil
}

func GenerateTransferNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "transfer_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	nanoLike := time.Now().UnixNano() % 10000
	return fmt.Sprintf("TRN-%s-%d-%d", dateStr, num, nanoLike), nil
}

func GenerateCreditNoteNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "credit_note_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	nanoLike := time.Now().UnixNano() % 10000
	return fmt.Sprintf("CN-%s-%d-%d", dateStr, num, nanoLike), nil
}

func GeneratePONumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "po_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	nanoLike := time.Now().UnixNano() % 10000
	return fmt.Sprintf("PO-%s-%d-%d", dateStr, num, nanoLike), nil
}

func GenerateSaleReturnNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "sale_return_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	return fmt.Sprintf("SR-%s-%04d", dateStr, num), nil
}

func GeneratePurchaseReturnNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "purchase_return_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	nanoLike := time.Now().UnixNano() % 10000
	return fmt.Sprintf("PR-%s-%d-%d", dateStr, num, nanoLike), nil
}

func GenerateQuotationNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "quotation_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	return fmt.Sprintf("QT-%s-%d", dateStr, num), nil
}

func PeekNextQuotationNumber(db *gorm.DB) (string, error) {
	var seq Sequence
	err := db.Where("name = ?", "quotation_sequence").First(&seq).Error
	if err == gorm.ErrRecordNotFound {
		return fmt.Sprintf("QT-%s-1", time.Now().Format("20060102")), nil
	}
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("QT-%s-%d", time.Now().Format("20060102"), seq.Value+1), nil
}

func GenerateProductionOrderNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "production_order_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("2006")
	return fmt.Sprintf("PRD-%s-%04d", dateStr, num), nil
}

func GenerateSONumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "so_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	nanoLike := time.Now().UnixNano() % 10000
	return fmt.Sprintf("SO-%s-%d-%d", dateStr, num, nanoLike), nil
}

func GenerateBulkPurchaseNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "bulk_purchase_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	nanoLike := time.Now().UnixNano() % 10000
	return fmt.Sprintf("BP-%s-%d-%d", dateStr, num, nanoLike), nil
}

func GenerateBillNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "bill_sequence")
	if err != nil {
		return "", err
	}
	dateStr := time.Now().Format("20060102")
	nanoLike := time.Now().UnixNano() % 10000
	return fmt.Sprintf("BILL-%s-%d-%d", dateStr, num, nanoLike), nil
}

func GenerateBarcode() (string, error) {
	// Generate random EAN-13 barcode with check digit
	randBytes := make([]byte, 6)
	if _, err := rand.Read(randBytes); err != nil {
		return "", err
	}

	// Create 12-digit base
	barcode := "5"
	for i := 0; i < 6; i++ {
		barcode += fmt.Sprintf("%02d", randBytes[i]%100)
	}

	// Calculate check digit
	sum := 0
	for i := 0; i < 12; i++ {
		digit := int(barcode[i] - '0')
		if i%2 == 0 {
			sum += digit * 1
		} else {
			sum += digit * 3
		}
	}
	checkDigit := (10 - (sum % 10)) % 10
	return barcode + fmt.Sprintf("%d", checkDigit), nil
}

func GenerateWONumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "wo_sequence")
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("WO-%03d", num), nil
}

func GenerateWBNumber(db *gorm.DB) (string, error) {
	num, err := getNextSequenceValue(db, "wb_sequence")
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("WB-%03d", num), nil
}

func ResetSequences(db *gorm.DB) error {
	sequences := []string{
		"order_sequence",
		"invoice_sequence",
		"transfer_sequence",
		"credit_note_sequence",
		"po_sequence",
		"purchase_return_sequence",
		"quotation_sequence",
		"so_sequence",
		"bulk_purchase_sequence",
		"bill_sequence",
	}

	for _, seqName := range sequences {
		if err := db.Model(&Sequence{}).Where("name = ?", seqName).Update("value", 0).Error; err != nil {
			return err
		}
	}

	return nil
}

func getNextSequenceValue(db *gorm.DB, sequenceName string) (int64, error) {
	ng.mu.Lock()
	defer ng.mu.Unlock()

	var seq Sequence
	result := db.Where("name = ?", sequenceName).First(&seq)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new sequence
		seq = Sequence{Name: sequenceName, Value: 1}
		if err := db.Create(&seq).Error; err != nil {
			return 0, err
		}
		return 1, nil
	}

	if result.Error != nil {
		return 0, result.Error
	}

	// Increment and update
	seq.Value++
	if err := db.Model(&seq).Update("value", seq.Value).Error; err != nil {
		return 0, err
	}

	return seq.Value, nil
}
