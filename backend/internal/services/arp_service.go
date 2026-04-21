package services

import (
	"backend/internal/models"
	"backend/internal/repository"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

type ARPService struct {
	repo         *repository.ARPRepository
	financeRepo  *repository.FinanceTransactionRepository
	settingsRepo repository.SettingsRepository
}

func NewARPService(repo *repository.ARPRepository, financeRepo *repository.FinanceTransactionRepository, settingsRepo repository.SettingsRepository) *ARPService {
	return &ARPService{repo: repo, financeRepo: financeRepo, settingsRepo: settingsRepo}
}

func (s *ARPService) CreateParty(party *models.Party) error {
	return s.repo.CreateParty(party)
}

func (s *ARPService) GetParties() ([]models.Party, error) {
	return s.repo.GetAllParties()
}

func (s *ARPService) UpdateParty(party *models.Party) error {
	return s.repo.UpdateParty(party)
}

func (s *ARPService) DeleteParty(id string) error {
	return s.repo.DeleteParty(id)
}

func (s *ARPService) CreateInvoice(invoice *models.Invoice) error {
	return s.repo.CreateInvoice(invoice)
}

func (s *ARPService) GetInvoice(id string) (*models.Invoice, error) {
	return s.repo.GetInvoiceByID(id)
}

func (s *ARPService) UpdateInvoice(invoice *models.Invoice) error {
	existing, err := s.repo.GetInvoiceByID(invoice.InvoiceID.String())
	if err != nil {
		return err
	}

	var totalPaid float64
	paymentRows, err := s.repo.GetDetailedLedger(existing.PartyID.String())
	if err != nil {
		return err
	}
	for _, row := range paymentRows {
		if row.Type == "payment" && row.InvoiceID == existing.InvoiceID.String() {
			totalPaid += row.Amount
		}
	}

	if invoice.TotalAmount < totalPaid {
		return errors.New("invoice amount cannot be less than already received payments")
	}

	status := "unpaid"
	if totalPaid > 0 && totalPaid < invoice.TotalAmount {
		status = "partially_paid"
	}
	if totalPaid >= invoice.TotalAmount && invoice.TotalAmount > 0 {
		status = "paid"
	}
	invoice.Status = status

	return s.repo.UpdateInvoice(invoice)
}

func (s *ARPService) RecordPayment(payment *models.Payment) error {
	return s.repo.RecordPayment(payment)
}

func (s *ARPService) GetPayment(id string) (*models.Payment, error) {
	return s.repo.GetPaymentByID(id)
}

func (s *ARPService) UpdatePayment(payment *models.Payment) error {
	return s.repo.UpdatePayment(payment)
}

func (s *ARPService) GetLedger() ([]models.PartyLedger, error) {
	return s.repo.GetLedger()
}

func (s *ARPService) GetSummary() (map[string]interface{}, error) {
	return s.repo.GetSummary()
}

func (s *ARPService) GetDetailedLedger(partyID string) ([]models.Transaction, error) {
	return s.repo.GetDetailedLedger(partyID)
}

func (s *ARPService) GetPaymentModeTransactions(paymentMode string) ([]models.PaymentModeTransaction, error) {
	arpTransactions, err := s.repo.GetPaymentModeTransactions(paymentMode)
	if err != nil {
		return nil, err
	}

	if s.financeRepo == nil {
		return arpTransactions, nil
	}

	financeTransactions, err := s.financeRepo.GetPaymentModeTransactions(paymentMode)
	if err != nil {
		return nil, err
	}

	transactions := append(arpTransactions, financeTransactions...)
	sort.SliceStable(transactions, func(i, j int) bool {
		return transactions[i].PaymentDate.After(transactions[j].PaymentDate)
	})
	return transactions, nil
}

func (s *ARPService) RecordManualTransaction(direction, paymentMode, referenceID, referenceLabel, partyID, partyName, partyType, remarks string, amount float64, transactionDate time.Time) (*models.FinanceTransaction, error) {
	if s.financeRepo == nil {
		return nil, errors.New("finance transaction repository is not configured")
	}
	if transactionDate.IsZero() {
		return nil, errors.New("transaction date is required")
	}
	if amount <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}

	normalizedDirection := strings.ToLower(strings.TrimSpace(direction))
	if normalizedDirection != "in" && normalizedDirection != "out" {
		return nil, errors.New("direction must be either in or out")
	}

	normalizedMode := strings.TrimSpace(paymentMode)
	if normalizedMode == "" {
		return nil, errors.New("payment mode is required")
	}

	trimmedPartyID := strings.TrimSpace(partyID)
	trimmedPartyName := strings.TrimSpace(partyName)
	trimmedPartyType := strings.TrimSpace(partyType)
	if trimmedPartyID != "" {
		party, err := s.repo.GetPartyByID(trimmedPartyID)
		if err != nil {
			return nil, err
		}
		trimmedPartyName = party.Name
		trimmedPartyType = party.Type
	}

	entry := &models.FinanceTransaction{
		ID:              uuid.New(),
		SourceModule:    "manual_payment",
		SourceID:        uuid.NewString(),
		TransactionDate: transactionDate,
		Direction:       normalizedDirection,
		PaymentMode:     normalizedMode,
		Amount:          amount,
		ReferenceID:     strings.TrimSpace(referenceID),
		ReferenceLabel:  strings.TrimSpace(referenceLabel),
		PartyID:         trimmedPartyID,
		PartyName:       trimmedPartyName,
		PartyType:       trimmedPartyType,
		Remarks:         strings.TrimSpace(remarks),
	}

	if err := s.financeRepo.Create(entry); err != nil {
		return nil, err
	}

	if s.settingsRepo != nil {
		adjustment := amount
		if normalizedDirection == "out" {
			adjustment = -amount
		}
		if err := s.settingsRepo.AdjustPaymentBalance(adjustment, normalizedMode); err != nil {
			return nil, err
		}
	}

	return entry, nil
}

func (s *ARPService) UpdateManualTransaction(id, direction, paymentMode, referenceID, referenceLabel, partyID, partyName, partyType, remarks string, amount float64, transactionDate time.Time) (*models.FinanceTransaction, error) {
	if s.financeRepo == nil {
		return nil, errors.New("finance transaction repository is not configured")
	}
	if transactionDate.IsZero() {
		return nil, errors.New("transaction date is required")
	}
	if amount <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}

	existing, err := s.financeRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(existing.SourceModule, "manual_payment") {
		return nil, errors.New("only manual payment entries can be edited here")
	}

	normalizedDirection := strings.ToLower(strings.TrimSpace(direction))
	if normalizedDirection != "in" && normalizedDirection != "out" {
		return nil, errors.New("direction must be either in or out")
	}

	normalizedMode := strings.TrimSpace(paymentMode)
	if normalizedMode == "" {
		return nil, errors.New("payment mode is required")
	}

	trimmedPartyID := strings.TrimSpace(partyID)
	trimmedPartyName := strings.TrimSpace(partyName)
	trimmedPartyType := strings.TrimSpace(partyType)
	if trimmedPartyID != "" {
		party, err := s.repo.GetPartyByID(trimmedPartyID)
		if err != nil {
			return nil, err
		}
		trimmedPartyName = party.Name
		trimmedPartyType = party.Type
	}

	if s.settingsRepo != nil {
		previousAdjustment := existing.Amount
		if strings.EqualFold(existing.Direction, "out") {
			previousAdjustment = -existing.Amount
		}
		if err := s.settingsRepo.AdjustPaymentBalance(-previousAdjustment, existing.PaymentMode); err != nil {
			return nil, err
		}
	}

	existing.TransactionDate = transactionDate
	existing.Direction = normalizedDirection
	existing.PaymentMode = normalizedMode
	existing.Amount = amount
	existing.ReferenceID = strings.TrimSpace(referenceID)
	existing.ReferenceLabel = strings.TrimSpace(referenceLabel)
	existing.PartyID = trimmedPartyID
	existing.PartyName = trimmedPartyName
	existing.PartyType = trimmedPartyType
	existing.Remarks = strings.TrimSpace(remarks)

	if err := s.financeRepo.Update(existing); err != nil {
		return nil, err
	}

	if s.settingsRepo != nil {
		newAdjustment := amount
		if normalizedDirection == "out" {
			newAdjustment = -amount
		}
		if err := s.settingsRepo.AdjustPaymentBalance(newAdjustment, normalizedMode); err != nil {
			return nil, err
		}
	}

	return existing, nil
}
