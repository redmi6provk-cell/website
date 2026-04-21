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

type ledgerAggregateRow struct {
	PartyID   string
	PartyName string
	PartyType string
	Amount    float64
}

type ledgerTransactionRow struct {
	Date        time.Time
	Type        string
	RefID       string
	InvoiceID   string
	PaymentID   string
	SourceModule string
	Amount      float64
	PaymentMode string
	Remarks     string
	Direction   string
}

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
			return tx.Model(&models.Party{}).
				Where("party_id = ? AND (COALESCE(shop_name, '') = '')", existingContact.PartyID).
				Update("shop_name", user.ShopName).Error
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}

		party := models.Party{
			Name:     user.Name,
			ShopName: user.ShopName,
			Type:     "customer",
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
				"name":      party.Name,
				"shop_name": party.ShopName,
				"type":      party.Type,
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

func (r *ARPRepository) UpdateInvoice(invoice *models.Invoice) error {
	return r.db.Model(&models.Invoice{}).
		Where("invoice_id = ?", invoice.InvoiceID).
		Updates(map[string]interface{}{
			"invoice_no":   invoice.InvoiceNo,
			"invoice_date": invoice.InvoiceDate,
			"due_date":     invoice.DueDate,
			"total_amount": invoice.TotalAmount,
			"status":       invoice.Status,
		}).Error
}

func (r *ARPRepository) GetPaymentByID(id string) (*models.Payment, error) {
	var payment models.Payment
	err := r.db.First(&payment, "payment_id = ?", id).Error
	return &payment, err
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

func (r *ARPRepository) UpdatePayment(payment *models.Payment) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var existing models.Payment
		if err := tx.First(&existing, "payment_id = ?", payment.PaymentID).Error; err != nil {
			return err
		}

		var invoice models.Invoice
		if err := tx.First(&invoice, "invoice_id = ?", existing.InvoiceID).Error; err != nil {
			return err
		}

		var totalOtherPaid float64
		if err := tx.Model(&models.Payment{}).
			Where("invoice_id = ? AND payment_id <> ?", existing.InvoiceID, existing.PaymentID).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&totalOtherPaid).Error; err != nil {
			return err
		}

		remainingCapacity := invoice.TotalAmount - totalOtherPaid
		if payment.Amount <= 0 {
			return errors.New("payment amount must be greater than zero")
		}
		if payment.Amount > remainingCapacity {
			return errors.New("payment amount exceeds remaining outstanding balance")
		}

		if err := tx.Model(&models.Payment{}).
			Where("payment_id = ?", existing.PaymentID).
			Updates(map[string]interface{}{
				"payment_date": payment.PaymentDate,
				"amount":       payment.Amount,
				"payment_mode": payment.PaymentMode,
				"remarks":      payment.Remarks,
			}).Error; err != nil {
			return err
		}

		newTotalPaid := totalOtherPaid + payment.Amount
		newStatus := "unpaid"
		if newTotalPaid > 0 && newTotalPaid < invoice.TotalAmount {
			newStatus = "partially_paid"
		}
		if newTotalPaid >= invoice.TotalAmount {
			newStatus = "paid"
		}

		return tx.Model(&models.Invoice{}).
			Where("invoice_id = ?", invoice.InvoiceID).
			Update("status", newStatus).Error
	})
}

// Ledger View
func (r *ARPRepository) GetLedger() ([]models.PartyLedger, error) {
	parties := make(map[string]*models.PartyLedger)

	ensureParty := func(row ledgerAggregateRow) *models.PartyLedger {
		entry, exists := parties[row.PartyID]
		if exists {
			return entry
		}

		parsedPartyID, _ := uuid.Parse(row.PartyID)
		entry = &models.PartyLedger{
			PartyID:   parsedPartyID,
			PartyName: row.PartyName,
			PartyType: row.PartyType,
		}
		parties[row.PartyID] = entry
		return entry
	}

	var invoiceRows []ledgerAggregateRow
	if err := r.db.Raw(`
		SELECT
			pa.party_id::text AS party_id,
			pa.name AS party_name,
			pa.type AS party_type,
			COALESCE(SUM(i.total_amount), 0) AS amount
		FROM invoices AS i
		JOIN parties AS pa ON pa.party_id = i.party_id
		LEFT JOIN party_contacts AS pc
			ON pc.party_id = pa.party_id
			AND pc.contact_type = 'phone'
			AND pc.is_primary = true
		LEFT JOIN users AS u
			ON u.phone = pc.contact_value
		WHERE COALESCE(u.role, 'USER') NOT IN ('ACCOUNTANT', 'ADMIN', 'SUPERADMIN')
		GROUP BY pa.party_id, pa.name, pa.type
	`).Scan(&invoiceRows).Error; err != nil {
		return nil, err
	}
	for _, row := range invoiceRows {
		ensureParty(row).TotalInvoiced += row.Amount
	}

	var offlineSaleRows []ledgerAggregateRow
	if err := r.db.Raw(`
		SELECT
			pa.party_id::text AS party_id,
			pa.name AS party_name,
			pa.type AS party_type,
			COALESCE(SUM(os.final_total), 0) AS amount
		FROM offline_sales AS os
		JOIN parties AS pa
			ON (
				pa.party_id = os.customer_party_id
				OR (
					os.customer_party_id IS NULL
					AND pa.type = 'customer'
					AND EXISTS (
						SELECT 1
						FROM party_contacts AS pc
						WHERE pc.party_id = pa.party_id
							AND pc.contact_type = 'phone'
							AND TRIM(pc.contact_value) = TRIM(os.customer_phone)
					)
				)
			)
		LEFT JOIN users AS u
			ON u.phone = os.customer_phone
		WHERE (
			os.customer_party_id IS NOT NULL
			OR TRIM(COALESCE(os.customer_phone, '')) <> ''
		)
			AND COALESCE(u.role, 'USER') NOT IN ('ACCOUNTANT', 'ADMIN', 'SUPERADMIN')
		GROUP BY pa.party_id, pa.name, pa.type
	`).Scan(&offlineSaleRows).Error; err != nil {
		return nil, err
	}
	for _, row := range offlineSaleRows {
		ensureParty(row).TotalInvoiced += row.Amount
	}

	var purchaseRows []ledgerAggregateRow
	if err := r.db.Raw(`
		SELECT
			supplier_party_id::text AS party_id,
			supplier_name AS party_name,
			'supplier' AS party_type,
			COALESCE(SUM(total_amount), 0) AS amount
		FROM purchases
		WHERE supplier_party_id IS NOT NULL
		GROUP BY supplier_party_id, supplier_name
	`).Scan(&purchaseRows).Error; err != nil {
		return nil, err
	}
	for _, row := range purchaseRows {
		ensureParty(row).TotalInvoiced += row.Amount
	}

	var paymentRows []ledgerAggregateRow
	if err := r.db.Raw(`
		SELECT
			pa.party_id::text AS party_id,
			pa.name AS party_name,
			pa.type AS party_type,
			COALESCE(SUM(p.amount), 0) AS amount
		FROM payments AS p
		JOIN invoices AS i ON i.invoice_id = p.invoice_id
		JOIN parties AS pa ON pa.party_id = i.party_id
		LEFT JOIN party_contacts AS pc
			ON pc.party_id = pa.party_id
			AND pc.contact_type = 'phone'
			AND pc.is_primary = true
		LEFT JOIN users AS u
			ON u.phone = pc.contact_value
		WHERE COALESCE(u.role, 'USER') NOT IN ('ACCOUNTANT', 'ADMIN', 'SUPERADMIN')
		GROUP BY pa.party_id, pa.name, pa.type
	`).Scan(&paymentRows).Error; err != nil {
		return nil, err
	}
	for _, row := range paymentRows {
		ensureParty(row).TotalPaid += row.Amount
	}

	var financeRows []ledgerAggregateRow
	if err := r.db.Raw(`
		SELECT
			party_id,
			MAX(COALESCE(NULLIF(TRIM(party_name), ''), reference_label, reference_id, 'Unknown Party')) AS party_name,
			MAX(COALESCE(NULLIF(TRIM(party_type), ''), 'customer')) AS party_type,
			COALESCE(SUM(
				CASE
					WHEN LOWER(COALESCE(TRIM(party_type), '')) = 'customer' AND LOWER(COALESCE(TRIM(direction), '')) = 'in' THEN amount
					WHEN LOWER(COALESCE(TRIM(party_type), '')) = 'customer' AND LOWER(COALESCE(TRIM(direction), '')) = 'out' THEN -amount
					WHEN LOWER(COALESCE(TRIM(party_type), '')) = 'supplier' AND LOWER(COALESCE(TRIM(direction), '')) = 'out' THEN amount
					WHEN LOWER(COALESCE(TRIM(party_type), '')) = 'supplier' AND LOWER(COALESCE(TRIM(direction), '')) = 'in' THEN -amount
					ELSE 0
				END
			), 0) AS amount
		FROM finance_transactions
		WHERE TRIM(COALESCE(party_id, '')) <> ''
		GROUP BY party_id
	`).Scan(&financeRows).Error; err != nil {
		return nil, err
	}
	for _, row := range financeRows {
		ensureParty(row).TotalPaid += row.Amount
	}

	ledger := make([]models.PartyLedger, 0, len(parties))
	for _, entry := range parties {
		entry.OutstandingBalance = entry.TotalInvoiced - entry.TotalPaid
		ledger = append(ledger, *entry)
	}

	sort.SliceStable(ledger, func(i, j int) bool {
		if ledger[i].PartyType == ledger[j].PartyType {
			return strings.ToLower(ledger[i].PartyName) < strings.ToLower(ledger[j].PartyName)
		}
		return ledger[i].PartyType < ledger[j].PartyType
	})

	return ledger, nil
}

func (r *ARPRepository) GetSummary() (map[string]interface{}, error) {
	ledger, err := r.GetLedger()
	if err != nil {
		return nil, err
	}

	totals := struct {
		Receivable float64
		Payable    float64
	}{}

	for _, entry := range ledger {
		// Dashboard cards should show only pending dues, not already settled or overpaid balances.
		if entry.OutstandingBalance <= 0 {
			continue
		}

		if strings.EqualFold(entry.PartyType, "customer") {
			totals.Receivable += entry.OutstandingBalance
			continue
		}

		if strings.EqualFold(entry.PartyType, "supplier") {
			totals.Payable += entry.OutstandingBalance
		}
	}

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

	parsedPartyID, err := uuid.Parse(partyID)
	if err != nil {
		return nil, err
	}

	party, err := r.GetPartyByID(parsedPartyID.String())
	if err != nil {
		return nil, err
	}

	phoneNumbers := make([]string, 0)
	for _, contact := range party.Contacts {
		if strings.EqualFold(contact.ContactType, "phone") && strings.TrimSpace(contact.ContactValue) != "" {
			phoneNumbers = append(phoneNumbers, strings.TrimSpace(contact.ContactValue))
		}
	}

	var invoiceRows []ledgerTransactionRow
	if err := r.db.Raw(`
		SELECT
			invoice_date AS date,
			'invoice' AS type,
			invoice_no AS ref_id,
			invoice_id::text AS invoice_id,
			total_amount AS amount,
			'' AS payment_mode,
			'Invoice Generated' AS remarks
		FROM invoices
		WHERE party_id = ?
	`, parsedPartyID).Scan(&invoiceRows).Error; err != nil {
		return nil, err
	}
	for _, row := range invoiceRows {
		transactions = append(transactions, models.Transaction{
			Date:      row.Date,
			Type:      row.Type,
			RefID:     row.RefID,
			InvoiceID: row.InvoiceID,
			SourceModule: "invoice",
			Amount:    row.Amount,
			Remarks:   row.Remarks,
		})
	}

	var paymentRows []ledgerTransactionRow
	if err := r.db.Raw(`
		SELECT
			p.payment_date AS date,
			'payment' AS type,
			i.invoice_no AS ref_id,
			p.invoice_id::text AS invoice_id,
			p.payment_id::text AS payment_id,
			p.amount AS amount,
			p.payment_mode AS payment_mode,
			COALESCE(NULLIF(TRIM(p.remarks), ''), 'Invoice payment received') AS remarks
		FROM payments AS p
		JOIN invoices AS i ON i.invoice_id = p.invoice_id
		WHERE i.party_id = ?
	`, parsedPartyID).Scan(&paymentRows).Error; err != nil {
		return nil, err
	}
	for _, row := range paymentRows {
		transactions = append(transactions, models.Transaction{
			Date:        row.Date,
			Type:        row.Type,
			RefID:       row.RefID,
			InvoiceID:   row.InvoiceID,
			PaymentID:   row.PaymentID,
			SourceModule: "arp_payment",
			Amount:      row.Amount,
			PaymentMode: row.PaymentMode,
			Remarks:     row.Remarks,
		})
	}

	if strings.EqualFold(party.Type, "supplier") {
		var purchaseRows []ledgerTransactionRow
		if err := r.db.Raw(`
			SELECT
				date AS date,
				'invoice' AS type,
				COALESCE(NULLIF(TRIM(invoice_number), ''), id::text) AS ref_id,
				'' AS invoice_id,
				total_amount AS amount,
				'' AS payment_mode,
				COALESCE(NULLIF(TRIM(notes), ''), 'Purchase bill created') AS remarks
			FROM purchases
			WHERE supplier_party_id = ?
		`, parsedPartyID).Scan(&purchaseRows).Error; err != nil {
			return nil, err
		}
		for _, row := range purchaseRows {
			transactions = append(transactions, models.Transaction{
				Date:      row.Date,
				Type:      row.Type,
				RefID:     row.RefID,
				InvoiceID: row.InvoiceID,
				SourceModule: "purchase",
				Amount:    row.Amount,
				Remarks:   row.Remarks,
			})
		}
	}

	if strings.EqualFold(party.Type, "customer") && len(phoneNumbers) > 0 {
		var offlineRows []ledgerTransactionRow
		if err := r.db.Raw(`
			SELECT
				sale_date AS date,
				'invoice' AS type,
				bill_number AS ref_id,
				'' AS invoice_id,
				final_total AS amount,
				'' AS payment_mode,
				COALESCE(NULLIF(TRIM(notes), ''), 'Offline sale invoice') AS remarks
			FROM offline_sales
			WHERE customer_phone IN ?
		`, phoneNumbers).Scan(&offlineRows).Error; err != nil {
			return nil, err
		}
		for _, row := range offlineRows {
			transactions = append(transactions, models.Transaction{
				Date:      row.Date,
				Type:      row.Type,
				RefID:     row.RefID,
				InvoiceID: row.InvoiceID,
				SourceModule: "offline_sale",
				Amount:    row.Amount,
				Remarks:   row.Remarks,
			})
		}
	}

	var financeRows []ledgerTransactionRow
	if err := r.db.Raw(`
		SELECT
			transaction_date AS date,
			'' AS type,
			COALESCE(NULLIF(TRIM(reference_label), ''), NULLIF(TRIM(reference_id), ''), source_module) AS ref_id,
			'' AS invoice_id,
			id::text AS payment_id,
			source_module,
			amount AS amount,
			payment_mode AS payment_mode,
			COALESCE(NULLIF(TRIM(remarks), ''), 'Payment recorded') AS remarks,
			direction
		FROM finance_transactions
		WHERE party_id = ?
	`, parsedPartyID.String()).Scan(&financeRows).Error; err != nil {
		return nil, err
	}
	for _, row := range financeRows {
		transactionType := "payment"
		if strings.EqualFold(party.Type, "customer") && strings.EqualFold(row.Direction, "out") {
			transactionType = "invoice"
		}
		if strings.EqualFold(party.Type, "supplier") && strings.EqualFold(row.Direction, "in") {
			transactionType = "invoice"
		}
		transactions = append(transactions, models.Transaction{
			Date:        row.Date,
			Type:        transactionType,
			RefID:       row.RefID,
			InvoiceID:   row.InvoiceID,
			PaymentID:   row.PaymentID,
			SourceModule: row.SourceModule,
			Amount:      row.Amount,
			PaymentMode: row.PaymentMode,
			Remarks:     row.Remarks,
		})
	}

	sort.SliceStable(transactions, func(i, j int) bool {
		return transactions[i].Date.Before(transactions[j].Date)
	})

	balance := 0.0
	for index := range transactions {
		if transactions[index].Type == "invoice" {
			balance += transactions[index].Amount
		} else {
			balance -= transactions[index].Amount
		}
		transactions[index].Balance = balance
	}

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
