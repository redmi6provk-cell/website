package services

import (
	"backend/internal/models"
	"backend/internal/repository"
	"sort"
)

type ARPService struct {
	repo        *repository.ARPRepository
	financeRepo *repository.FinanceTransactionRepository
}

func NewARPService(repo *repository.ARPRepository, financeRepo *repository.FinanceTransactionRepository) *ARPService {
	return &ARPService{repo: repo, financeRepo: financeRepo}
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
