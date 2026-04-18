package services

import (
	"backend/internal/models"
	"backend/internal/repository"
	"errors"
	"strings"

	"github.com/google/uuid"
)

type OfflineSaleService struct {
	repo         *repository.OfflineSaleRepository
	invoiceRepo  *repository.InvoiceSequenceRepository
	arpRepo      *repository.ARPRepository
	settingsRepo repository.SettingsRepository
	financeRepo  *repository.FinanceTransactionRepository
}

func NewOfflineSaleService(repo *repository.OfflineSaleRepository, invoiceRepo *repository.InvoiceSequenceRepository, arpRepo *repository.ARPRepository, settingsRepo repository.SettingsRepository, financeRepo *repository.FinanceTransactionRepository) *OfflineSaleService {
	return &OfflineSaleService{repo: repo, invoiceRepo: invoiceRepo, arpRepo: arpRepo, settingsRepo: settingsRepo, financeRepo: financeRepo}
}

func (s *OfflineSaleService) GetAll() ([]models.OfflineSale, error) {
	return s.repo.GetAll()
}

func (s *OfflineSaleService) Create(sale *models.OfflineSale) error {
	if strings.TrimSpace(sale.BillNumber) == "" {
		invoiceNumber, err := s.invoiceRepo.NextSalesInvoiceNumber()
		if err != nil {
			return err
		}
		sale.BillNumber = invoiceNumber
	}
	if err := s.validate(sale, false); err != nil {
		return err
	}
	if err := s.repo.Create(sale); err != nil {
		return err
	}
	if s.settingsRepo != nil {
		if err := s.settingsRepo.AdjustPaymentBalance(sale.AmountReceived, sale.PaymentMode); err != nil {
			return err
		}
	}
	return s.syncFinanceTransaction(sale)
}

func (s *OfflineSaleService) Update(sale *models.OfflineSale) error {
	if err := s.validate(sale, false); err != nil {
		return err
	}
	existing, err := s.repo.GetByID(sale.ID.String())
	if err != nil {
		return err
	}
	if err := s.repo.Update(sale); err != nil {
		return err
	}
	if s.settingsRepo != nil {
		if err := s.settingsRepo.AdjustPaymentBalance(-existing.AmountReceived, existing.PaymentMode); err != nil {
			return err
		}
		if err := s.settingsRepo.AdjustPaymentBalance(sale.AmountReceived, sale.PaymentMode); err != nil {
			return err
		}
	}
	return s.syncFinanceTransaction(sale)
}

func (s *OfflineSaleService) Delete(id string) error {
	existing, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		return err
	}
	if s.settingsRepo != nil {
		if err := s.settingsRepo.AdjustPaymentBalance(-existing.AmountReceived, existing.PaymentMode); err != nil {
			return err
		}
	}
	if s.financeRepo == nil {
		return nil
	}
	return s.financeRepo.DeleteBySource("offline_sale", existing.ID.String())
}

func (s *OfflineSaleService) IsStockConflict(err error) bool {
	return errors.Is(err, repository.ErrOfflineSaleStockConflict)
}

func (s *OfflineSaleService) SyncFinanceTransactions() error {
	sales, err := s.repo.GetAll()
	if err != nil {
		return err
	}

	for index := range sales {
		if err := s.syncFinanceTransaction(&sales[index]); err != nil {
			return err
		}
	}

	return nil
}

func (s *OfflineSaleService) validate(sale *models.OfflineSale, generateBill bool) error {
	sale.CustomerName = strings.TrimSpace(sale.CustomerName)
	sale.CustomerPhone = strings.TrimSpace(sale.CustomerPhone)
	sale.ShopName = strings.TrimSpace(sale.ShopName)
	sale.BillNumber = strings.TrimSpace(sale.BillNumber)
	sale.PaymentMode = strings.TrimSpace(sale.PaymentMode)
	sale.Notes = strings.TrimSpace(sale.Notes)

	if sale.CustomerName == "" {
		sale.CustomerName = "Walk-in Customer"
	}
	if sale.CustomerPartyID == nil && s.arpRepo != nil && sale.CustomerPhone != "" {
		if party, err := s.arpRepo.FindPartyByPhone(sale.CustomerPhone); err == nil && strings.EqualFold(party.Type, "customer") {
			sale.CustomerPartyID = &party.PartyID
		}
	}
	if sale.SaleDate.IsZero() {
		return errors.New("sale date is required")
	}
	if sale.PaymentMode == "" {
		return errors.New("payment mode is required")
	}
	if sale.BillNumber == "" {
		return errors.New("invoice number is required")
	}
	if len(sale.Items) == 0 {
		return errors.New("at least one sale item is required")
	}

	hasConflict, err := s.invoiceRepo.IsSalesInvoiceNumberInUse(sale.BillNumber, "", sale.ID.String())
	if err != nil {
		return err
	}
	if hasConflict {
		return errors.New("invoice number already in use in orders or offline sales")
	}

	subtotal := 0.0
	discountTotal := 0.0
	for index := range sale.Items {
		item := &sale.Items[index]
		item.ProductName = strings.TrimSpace(item.ProductName)
		if item.ProductID == uuid.Nil {
			return errors.New("product is required for each item")
		}
		if item.ProductName == "" {
			return errors.New("product name is required for each item")
		}
		if item.Quantity <= 0 {
			return errors.New("quantity must be greater than zero")
		}
		if item.SellPrice < 0 {
			return errors.New("sell price cannot be negative")
		}
		if item.DiscountValue < 0 {
			item.DiscountValue = 0
		}
		baseLine := float64(item.Quantity) * item.SellPrice
		if item.DiscountValue > baseLine {
			return errors.New("item discount cannot exceed line amount")
		}
		item.LineTotal = baseLine - item.DiscountValue
		subtotal += baseLine
		discountTotal += item.DiscountValue
	}

	sale.Subtotal = subtotal
	sale.DiscountTotal = discountTotal
	sale.FinalTotal = subtotal - discountTotal
	if sale.AmountReceived < 0 {
		return errors.New("amount received cannot be negative")
	}
	sale.BalanceDue = sale.FinalTotal - sale.AmountReceived
	if sale.BalanceDue < 0 {
		sale.BalanceDue = 0
	}
	if sale.AmountReceived >= sale.FinalTotal {
		sale.Status = "paid"
	} else if sale.AmountReceived > 0 {
		sale.Status = "partial"
	} else {
		sale.Status = "due"
	}

	return nil
}

func (s *OfflineSaleService) syncFinanceTransaction(sale *models.OfflineSale) error {
	if s.financeRepo == nil || sale.AmountReceived <= 0 {
		if s.financeRepo != nil && sale.AmountReceived <= 0 {
			return s.financeRepo.DeleteBySource("offline_sale", sale.ID.String())
		}
		return nil
	}

	remarks := sale.Notes
	if remarks == "" {
		remarks = "Offline sale collection"
	}

	partyID := ""
	if sale.CustomerPartyID != nil {
		partyID = sale.CustomerPartyID.String()
	} else if s.arpRepo != nil {
		phone := strings.TrimSpace(sale.CustomerPhone)
		if phone != "" {
			if party, err := s.arpRepo.FindPartyByPhone(phone); err == nil {
				partyID = party.PartyID.String()
			}
		}
	}

	return s.financeRepo.Replace(&models.FinanceTransaction{
		SourceModule:    "offline_sale",
		SourceID:        sale.ID.String(),
		TransactionDate: sale.SaleDate,
		Direction:       "in",
		PaymentMode:     sale.PaymentMode,
		Amount:          sale.AmountReceived,
		ReferenceID:     sale.ID.String(),
		ReferenceLabel:  sale.BillNumber,
		PartyID:         partyID,
		PartyName:       sale.CustomerName,
		PartyType:       "customer",
		Remarks:         remarks,
	})
}
