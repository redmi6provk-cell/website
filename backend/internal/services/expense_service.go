package services

import (
	"backend/internal/models"
	"backend/internal/repository"
	"errors"
	"strings"
)

type ExpenseService struct {
	repo         *repository.ExpenseRepository
	settingsRepo repository.SettingsRepository
	financeRepo  *repository.FinanceTransactionRepository
}

func NewExpenseService(repo *repository.ExpenseRepository, settingsRepo repository.SettingsRepository, financeRepo *repository.FinanceTransactionRepository) *ExpenseService {
	return &ExpenseService{repo: repo, settingsRepo: settingsRepo, financeRepo: financeRepo}
}

func (s *ExpenseService) GetAll() ([]models.Expense, error) {
	return s.repo.GetAll()
}

func (s *ExpenseService) Create(expense *models.Expense) error {
	if err := s.validate(expense); err != nil {
		return err
	}
	if err := s.repo.Create(expense); err != nil {
		return err
	}
	if err := s.adjustPaymentModeBalance(expense.PaymentMethod, -expense.Amount); err != nil {
		return err
	}
	return s.syncFinanceTransaction(expense)
}

func (s *ExpenseService) Update(expense *models.Expense) error {
	if err := s.validate(expense); err != nil {
		return err
	}
	existing, err := s.repo.GetByID(expense.ID.String())
	if err != nil {
		return err
	}
	if err := s.repo.Update(expense); err != nil {
		return err
	}
	if err := s.adjustPaymentModeBalance(existing.PaymentMethod, existing.Amount); err != nil {
		return err
	}
	if err := s.adjustPaymentModeBalance(expense.PaymentMethod, -expense.Amount); err != nil {
		return err
	}
	return s.syncFinanceTransaction(expense)
}

func (s *ExpenseService) Delete(id string) error {
	existing, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		return err
	}
	if err := s.adjustPaymentModeBalance(existing.PaymentMethod, existing.Amount); err != nil {
		return err
	}
	if s.financeRepo == nil {
		return nil
	}
	return s.financeRepo.DeleteBySource("expense", existing.ID.String())
}

func (s *ExpenseService) validate(expense *models.Expense) error {
	expense.Description = strings.TrimSpace(expense.Description)
	expense.Category = strings.TrimSpace(expense.Category)
	expense.PaymentMethod = strings.TrimSpace(expense.PaymentMethod)
	expense.Note = strings.TrimSpace(expense.Note)

	if expense.Date.IsZero() {
		return errors.New("expense date is required")
	}
	if expense.Description == "" {
		return errors.New("description is required")
	}
	if expense.Category == "" {
		return errors.New("category is required")
	}
	if expense.PaymentMethod == "" {
		return errors.New("payment method is required")
	}
	if expense.Amount <= 0 {
		return errors.New("amount must be greater than zero")
	}

	return nil
}

func (s *ExpenseService) adjustPaymentModeBalance(paymentMethod string, delta float64) error {
	settings, err := s.settingsRepo.Get()
	if err != nil {
		return err
	}

	method := strings.TrimSpace(paymentMethod)
	if strings.EqualFold(method, "cash") {
		settings.CashBalance += delta
		return s.settingsRepo.Save(settings)
	}

	accounts := parseBankAccounts(settings.BankAccountsJSON)
	found := false
	for index := range accounts {
		if strings.EqualFold(accounts[index].Name, method) {
			accounts[index].Balance += delta
			found = true
			break
		}
	}

	if !found && method != "" {
		accounts = append(accounts, BankAccount{
			Name:    method,
			Balance: delta,
		})
	}

	settings.BankAccountsJSON = marshalBankAccounts(accounts)
	return s.settingsRepo.Save(settings)
}

func (s *ExpenseService) SyncFinanceTransactions() error {
	expenses, err := s.repo.GetAll()
	if err != nil {
		return err
	}

	for index := range expenses {
		if err := s.syncFinanceTransaction(&expenses[index]); err != nil {
			return err
		}
	}

	return nil
}

func (s *ExpenseService) syncFinanceTransaction(expense *models.Expense) error {
	if s.financeRepo == nil {
		return nil
	}

	return s.financeRepo.Replace(&models.FinanceTransaction{
		SourceModule:    "expense",
		SourceID:        expense.ID.String(),
		TransactionDate: expense.Date,
		Direction:       "out",
		PaymentMode:     expense.PaymentMethod,
		Amount:          expense.Amount,
		ReferenceID:     expense.ID.String(),
		ReferenceLabel:  expense.Description,
		PartyName:       expense.Category,
		PartyType:       "expense",
		Remarks:         expense.Note,
	})
}
