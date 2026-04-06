package repository

import (
	"backend/internal/models"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ARPRepository struct {
	db *gorm.DB
}

func NewARPRepository(db *gorm.DB) *ARPRepository {
	return &ARPRepository{db: db}
}

// Parties
func (r *ARPRepository) CreateParty(party *models.Party) error {
	return r.db.Create(party).Error
}

func (r *ARPRepository) EnsureCustomerPartyForUser(user *models.User) error {
	if models.IsStaffRole(user.Role) {
		return nil
	}

	return r.db.Transaction(func(tx *gorm.DB) error {
		var existingContact models.PartyContact
		err := tx.Where("contact_type = ? AND contact_value = ?", "phone", user.Phone).First(&existingContact).Error
		if err == nil {
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}

		party := models.Party{
			Name: user.Name,
			Type: "customer",
			Contacts: []models.PartyContact{
				{
					ContactName:  user.Name,
					ContactType:  "phone",
					ContactValue: user.Phone,
					IsPrimary:    true,
				},
			},
		}

		return tx.Create(&party).Error
	})
}

func (r *ARPRepository) FindPartyByPhone(phone string) (*models.Party, error) {
	var contact models.PartyContact
	if err := r.db.Where("contact_type = ? AND contact_value = ?", "phone", phone).First(&contact).Error; err != nil {
		return nil, err
	}

	var party models.Party
	if err := r.db.Where("party_id = ?", contact.PartyID).First(&party).Error; err != nil {
		return nil, err
	}

	return &party, nil
}

func (r *ARPRepository) CreateInvoiceForOrder(user *models.User, order *models.Order) error {
	if models.IsStaffRole(user.Role) {
		return nil
	}

	invoiceNo := fmt.Sprintf("ORD-%s", order.ID.String()[:8])

	var existing models.Invoice
	if err := r.db.Where("invoice_no = ?", invoiceNo).First(&existing).Error; err == nil {
		return nil
	} else if err != gorm.ErrRecordNotFound {
		return err
	}

	if err := r.EnsureCustomerPartyForUser(user); err != nil {
		return err
	}

	party, err := r.FindPartyByPhone(user.Phone)
	if err != nil {
		return err
	}

	invoiceItems := make([]models.InvoiceItem, 0, len(order.Items))
	for _, item := range order.Items {
		description := fmt.Sprintf("%s x%d", item.Product.Name, item.Quantity)
		invoiceItems = append(invoiceItems, models.InvoiceItem{
			Description: description,
			Quantity:    float64(item.Quantity),
			Rate:        item.Price,
			Amount:      item.Price * float64(item.Quantity),
		})
	}

	invoiceDate := time.Now()
	invoice := &models.Invoice{
		PartyID:     party.PartyID,
		InvoiceNo:   invoiceNo,
		InvoiceDate: invoiceDate,
		DueDate:     invoiceDate.Add(7 * 24 * time.Hour),
		Status:      "unpaid",
		TotalAmount: order.Total,
		CreatedBy:   user.ID,
		Items:       invoiceItems,
	}

	return r.CreateInvoice(invoice)
}

func (r *ARPRepository) GetAllParties() ([]models.Party, error) {
	var parties []models.Party
	err := r.db.Preload("Contacts").Find(&parties).Error
	return parties, err
}

func (r *ARPRepository) GetPartyByID(id string) (*models.Party, error) {
	var party models.Party
	if err := r.db.Preload("Contacts").Where("party_id = ?", id).First(&party).Error; err != nil {
		return nil, err
	}
	return &party, nil
}

func (r *ARPRepository) UpdateParty(party *models.Party) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Party{}).
			Where("party_id = ?", party.PartyID).
			Updates(map[string]interface{}{
				"name": party.Name,
				"type": party.Type,
			}).Error; err != nil {
			return err
		}

		if err := tx.Where("party_id = ?", party.PartyID).Delete(&models.PartyContact{}).Error; err != nil {
			return err
		}

		contacts := make([]models.PartyContact, 0, len(party.Contacts))
		for _, contact := range party.Contacts {
			if contact.ContactValue == "" {
				continue
			}
			contact.PartyID = party.PartyID
			contacts = append(contacts, contact)
		}

		if len(contacts) == 0 {
			return nil
		}

		return tx.Create(&contacts).Error
	})
}

func (r *ARPRepository) DeleteParty(id string) error {
	// Might need to delete contacts or handle foreign keys depending on DB setup
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("party_id = ?", id).Delete(&models.PartyContact{}).Error; err != nil {
			return err
		}
		if err := tx.Where("party_id = ?", id).Delete(&models.Party{}).Error; err != nil {
			return err
		}
		return nil
	})
}

// Invoices
func (r *ARPRepository) CreateInvoice(invoice *models.Invoice) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Items.Amount").Create(invoice).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *ARPRepository) GetInvoiceByID(id string) (*models.Invoice, error) {
	var invoice models.Invoice
	err := r.db.Preload("Items").Preload("Party").First(&invoice, "invoice_id = ?", id).Error
	return &invoice, err
}

// Payments
func (r *ARPRepository) RecordPayment(payment *models.Payment) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var invoice models.Invoice
		if err := tx.First(&invoice, "invoice_id = ?", payment.InvoiceID).Error; err != nil {
			return err
		}

		var totalPaid float64
		if err := tx.Model(&models.Payment{}).
			Where("invoice_id = ?", payment.InvoiceID).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&totalPaid).Error; err != nil {
			return err
		}

		remaining := invoice.TotalAmount - totalPaid
		if remaining <= 0 {
			return errors.New("this invoice is already fully paid")
		}
		if payment.Amount <= 0 {
			return errors.New("payment amount must be greater than zero")
		}
		if payment.Amount > remaining {
			return errors.New("payment amount exceeds remaining outstanding balance")
		}

		if err := tx.Create(payment).Error; err != nil {
			return err
		}

		newTotalPaid := totalPaid + payment.Amount
		newStatus := "partially_paid"
		if newTotalPaid >= invoice.TotalAmount {
			newStatus = "paid"
		}
		if totalPaid == 0 && newTotalPaid < invoice.TotalAmount {
			newStatus = "partially_paid"
		}

		if err := tx.Model(&models.Invoice{}).
			Where("invoice_id = ?", payment.InvoiceID).
			Update("status", newStatus).Error; err != nil {
			return err
		}

		return nil
	})
}

// Ledger View
func (r *ARPRepository) GetLedger() ([]models.PartyLedger, error) {
	var ledger []models.PartyLedger
	err := r.db.Raw(`
		SELECT pl.*
		FROM party_ledger pl
		LEFT JOIN party_contacts pc
			ON pc.party_id = pl.party_id
			AND pc.contact_type = 'phone'
			AND pc.is_primary = true
		LEFT JOIN users u
			ON u.phone = pc.contact_value
		WHERE COALESCE(u.role, 'USER') NOT IN ('ACCOUNTANT', 'ADMIN', 'SUPERADMIN')
	`).Scan(&ledger).Error
	return ledger, err
}

func (r *ARPRepository) GetSummary() (map[string]interface{}, error) {
	var totals struct {
		Receivable float64 `gorm:"column:total_receivable"`
		Payable    float64 `gorm:"column:total_payable"`
	}
	err := r.db.Raw(`
		WITH filtered_party_ledger AS (
			SELECT pl.*
			FROM party_ledger pl
			LEFT JOIN party_contacts pc
				ON pc.party_id = pl.party_id
				AND pc.contact_type = 'phone'
				AND pc.is_primary = true
			LEFT JOIN users u
				ON u.phone = pc.contact_value
			WHERE COALESCE(u.role, 'USER') NOT IN ('ACCOUNTANT', 'ADMIN', 'SUPERADMIN')
		)
		SELECT 
			COALESCE((SELECT SUM(CASE WHEN party_type = 'customer' THEN outstanding_balance ELSE 0 END) FROM filtered_party_ledger), 0) as total_receivable,
			COALESCE((SELECT SUM(CASE WHEN party_type = 'supplier' THEN outstanding_balance ELSE 0 END) FROM filtered_party_ledger), 0) as total_payable
	`).Scan(&totals).Error

	var settings models.AdminSettings
	bankAccounts := make([]map[string]interface{}, 0)
	if settingsErr := r.db.First(&settings).Error; settingsErr == nil && settings.BankAccountsJSON != "" {
		var parsed []map[string]interface{}
		if err := json.Unmarshal([]byte(settings.BankAccountsJSON), &parsed); err == nil {
			bankAccounts = parsed
		}
	}

	result := map[string]interface{}{
		"total_receivable": totals.Receivable,
		"total_payable":    totals.Payable,
		"cash_total":       settings.CashBalance,
		"bank_accounts":    bankAccounts,
	}
	return result, err
}
func (r *ARPRepository) GetDetailedLedger(partyID string) ([]models.Transaction, error) {
	var transactions []models.Transaction

	// Fetch Invoices
	var invoices []models.Invoice
	if err := r.db.Where("party_id = ?", partyID).Order("invoice_date asc").Find(&invoices).Error; err != nil {
		return nil, err
	}

	// Fetch Payments for these invoices
	var invoiceIDs []uuid.UUID
	for _, inv := range invoices {
		invoiceIDs = append(invoiceIDs, inv.InvoiceID)
	}

	var payments []models.Payment
	if len(invoiceIDs) > 0 {
		if err := r.db.Where("invoice_id IN ?", invoiceIDs).Order("payment_date asc").Find(&payments).Error; err != nil {
			return nil, err
		}
	}

	for _, inv := range invoices {
		transactions = append(transactions, models.Transaction{
			Date:      inv.InvoiceDate,
			Type:      "invoice",
			RefID:     inv.InvoiceNo,
			InvoiceID: inv.InvoiceID.String(),
			Amount:    inv.TotalAmount,
			Remarks:   "Invoice Generated",
		})
	}

	for _, p := range payments {
		transactions = append(transactions, models.Transaction{
			Date:        p.PaymentDate,
			Type:        "payment",
			RefID:       p.PaymentID.String(),
			InvoiceID:   p.InvoiceID.String(),
			Amount:      p.Amount,
			PaymentMode: p.PaymentMode,
			Remarks:     p.Remarks,
		})
	}

	sort.SliceStable(transactions, func(i, j int) bool {
		return transactions[i].Date.Before(transactions[j].Date)
	})

	return transactions, nil
}

func (r *ARPRepository) GetPaymentModeTransactions(paymentMode string) ([]models.PaymentModeTransaction, error) {
	var transactions []models.PaymentModeTransaction
	normalizedMode := strings.TrimSpace(paymentMode)

	query := r.db.Table("payments AS p").
		Select(`
			p.payment_id::text AS payment_id,
			p.created_at AS payment_date,
			p.amount,
			p.payment_mode,
			p.remarks,
			p.invoice_id::text AS reference_id,
			i.invoice_no AS reference_label,
			pa.party_id::text AS party_id,
			pa.name AS party_name,
			pa.type AS party_type,
			'arp_payment' AS source_module,
			'in' AS direction
		`).
		Joins("JOIN invoices AS i ON i.invoice_id = p.invoice_id").
		Joins("JOIN parties AS pa ON pa.party_id = i.party_id").
		Order("p.created_at DESC")

	if normalizedMode != "" && !strings.EqualFold(normalizedMode, "all") {
		query = query.Where("LOWER(TRIM(p.payment_mode)) = LOWER(TRIM(?))", normalizedMode)
	}

	err := query.Scan(&transactions).Error
	return transactions, err
}
