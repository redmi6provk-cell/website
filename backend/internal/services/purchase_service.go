package services

import (
	"backend/internal/models"
	"backend/internal/repository"
	"errors"
	"strings"

	"github.com/google/uuid"
)

type PurchaseService struct {
	repo         *repository.PurchaseRepository
	arpRepo      *repository.ARPRepository
	settingsRepo repository.SettingsRepository
	financeRepo  *repository.FinanceTransactionRepository
}

func NewPurchaseService(repo *repository.PurchaseRepository, arpRepo *repository.ARPRepository, settingsRepo repository.SettingsRepository, financeRepo *repository.FinanceTransactionRepository) *PurchaseService {
	return &PurchaseService{repo: repo, arpRepo: arpRepo, settingsRepo: settingsRepo, financeRepo: financeRepo}
}

func (s *PurchaseService) GetAll() ([]models.Purchase, error) {
	return s.repo.GetAll()
}

func (s *PurchaseService) Create(purchase *models.Purchase) error {
	if err := s.validate(purchase); err != nil {
		return err
	}
	if err := s.repo.Create(purchase); err != nil {
		return err
	}
	if s.settingsRepo != nil && purchase.PaymentStatus == "paid" {
		if err := s.settingsRepo.AdjustPaymentBalance(-purchase.TotalAmount, purchase.PaymentMethod); err != nil {
			return err
		}
	}
	return s.syncFinanceTransaction(purchase)
}

func (s *PurchaseService) Update(purchase *models.Purchase) error {
	if err := s.validate(purchase); err != nil {
		return err
	}
	existing, err := s.repo.GetByID(purchase.ID.String())
	if err != nil {
		return err
	}
	if err := s.repo.Update(purchase); err != nil {
		return err
	}
	if s.settingsRepo != nil {
		if existing.PaymentStatus == "paid" {
			if err := s.settingsRepo.AdjustPaymentBalance(existing.TotalAmount, existing.PaymentMethod); err != nil {
				return err
			}
		}
		if purchase.PaymentStatus == "paid" {
			if err := s.settingsRepo.AdjustPaymentBalance(-purchase.TotalAmount, purchase.PaymentMethod); err != nil {
				return err
			}
		}
	}
	return s.syncFinanceTransaction(purchase)
}

func (s *PurchaseService) Delete(id string) error {
	existing, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		return err
	}
	if s.settingsRepo != nil && existing.PaymentStatus == "paid" {
		if err := s.settingsRepo.AdjustPaymentBalance(existing.TotalAmount, existing.PaymentMethod); err != nil {
			return err
		}
	}
	if s.financeRepo == nil {
		return nil
	}
	return s.financeRepo.DeleteBySource("purchase", existing.ID.String())
}

func (s *PurchaseService) IsStockConflict(err error) bool {
	return errors.Is(err, repository.ErrPurchaseStockConflict)
}

func (s *PurchaseService) SyncFinanceTransactions() error {
	purchases, err := s.repo.GetAll()
	if err != nil {
		return err
	}

	for index := range purchases {
		if err := s.syncFinanceTransaction(&purchases[index]); err != nil {
			return err
		}
	}

	return nil
}

func (s *PurchaseService) validate(purchase *models.Purchase) error {
	purchase.SupplierName = strings.TrimSpace(purchase.SupplierName)
	purchase.InvoiceNumber = strings.TrimSpace(purchase.InvoiceNumber)
	purchase.Notes = strings.TrimSpace(purchase.Notes)

	if purchase.SupplierName == "" {
		return errors.New("supplier name is required")
	}
	if purchase.SupplierPartyID == nil || *purchase.SupplierPartyID == uuid.Nil {
		return errors.New("supplier selection is required")
	}
	if purchase.Date.IsZero() {
		return errors.New("purchase date is required")
	}
	if purchase.PaymentStatus == "" {
		return errors.New("payment status is required")
	}
	if purchase.PaymentMethod == "" {
		return errors.New("payment method is required")
	}
	if len(purchase.Items) == 0 {
		return errors.New("at least one purchase item is required")
	}

	party, err := s.arpRepo.GetPartyByID(purchase.SupplierPartyID.String())
	if err != nil {
		return errors.New("selected supplier not found")
	}
	if party.Type != "supplier" {
		return errors.New("selected party is not a supplier")
	}
	purchase.SupplierName = party.Name

	total := 0.0
	for index := range purchase.Items {
		item := &purchase.Items[index]
		if item.ProductID == uuid.Nil {
			return errors.New("product is required for each purchase item")
		}
		item.ProductName = strings.TrimSpace(item.ProductName)
		if item.ProductName == "" {
			return errors.New("product name is required for each purchase item")
		}
		if item.Quantity <= 0 {
			return errors.New("quantity must be greater than zero")
		}
		if item.BuyPrice <= 0 {
			return errors.New("buy price must be greater than zero")
		}
		item.LineTotal = float64(item.Quantity) * item.BuyPrice
		total += item.LineTotal
	}

	purchase.TotalAmount = total
	return nil
}

func (s *PurchaseService) syncFinanceTransaction(purchase *models.Purchase) error {
	if s.financeRepo == nil {
		return nil
	}

	if purchase.PaymentStatus != "paid" {
		return s.financeRepo.DeleteBySource("purchase", purchase.ID.String())
	}

	remarks := purchase.Notes
	if remarks == "" {
		remarks = "Purchase payment"
	}

	return s.financeRepo.Replace(&models.FinanceTransaction{
		SourceModule:    "purchase",
		SourceID:        purchase.ID.String(),
		TransactionDate: purchase.Date,
		Direction:       "out",
		PaymentMode:     purchase.PaymentMethod,
		Amount:          purchase.TotalAmount,
		ReferenceID:     purchase.ID.String(),
		ReferenceLabel:  purchase.InvoiceNumber,
		PartyID:         purchase.SupplierPartyID.String(),
		PartyName:       purchase.SupplierName,
		PartyType:       "supplier",
		Remarks:         remarks,
	})
}
