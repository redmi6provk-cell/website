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

func (s *ARPService) RecordPayment(payment *models.Payment) error {
	return s.repo.RecordPayment(payment)
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
