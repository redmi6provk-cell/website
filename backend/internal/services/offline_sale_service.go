package services

import (
	"backend/internal/models"
	"backend/internal/repository"
	"errors"
	"fmt"
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
		for _, entry := range sale.PaymentBreakdown {
			if err := s.settingsRepo.AdjustPaymentBalance(entry.Amount, entry.Mode); err != nil {
				return err
			}
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
		existingBreakdown := normalizePaymentBreakdown(parsePaymentBreakdown(existing.PaymentBreakdownJSON))
		if len(existingBreakdown) == 0 && existing.AmountReceived > 0 {
			existingBreakdown = []models.PaymentBreakdownEntry{{Mode: existing.PaymentMode, Amount: existing.AmountReceived}}
		}
		for _, entry := range existingBreakdown {
			if err := s.settingsRepo.AdjustPaymentBalance(-entry.Amount, entry.Mode); err != nil {
				return err
			}
		}
		for _, entry := range sale.PaymentBreakdown {
			if err := s.settingsRepo.AdjustPaymentBalance(entry.Amount, entry.Mode); err != nil {
				return err
			}
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
		existingBreakdown := normalizePaymentBreakdown(parsePaymentBreakdown(existing.PaymentBreakdownJSON))
		if len(existingBreakdown) == 0 && existing.AmountReceived > 0 {
			existingBreakdown = []models.PaymentBreakdownEntry{{Mode: existing.PaymentMode, Amount: existing.AmountReceived}}
		}
		for _, entry := range existingBreakdown {
			if err := s.settingsRepo.AdjustPaymentBalance(-entry.Amount, entry.Mode); err != nil {
				return err
			}
		}
	}
	if s.financeRepo == nil {
		return nil
	}
	return s.financeRepo.DeleteBySourcePrefix("offline_sale", existing.ID.String())
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
	sale.PaymentBreakdown = normalizePaymentBreakdown(sale.PaymentBreakdown)
	if len(sale.PaymentBreakdown) == 0 && sale.AmountReceived > 0 {
		mode := strings.TrimSpace(sale.PaymentMode)
		if mode == "" {
			mode = "cash"
		}
		sale.PaymentBreakdown = []models.PaymentBreakdownEntry{{Mode: mode, Amount: sale.AmountReceived}}
	}
	sale.AmountReceived = totalPaymentBreakdown(sale.PaymentBreakdown)
	sale.PaymentMode = primaryPaymentMode(sale.PaymentBreakdown, strings.TrimSpace(sale.PaymentMode))
	if sale.PaymentMode == "" {
		sale.PaymentMode = "cash"
	}
	sale.PaymentBreakdownJSON = serializePaymentBreakdown(sale.PaymentBreakdown)
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
			return s.financeRepo.DeleteBySourcePrefix("offline_sale", sale.ID.String())
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

	breakdown := normalizePaymentBreakdown(parsePaymentBreakdown(sale.PaymentBreakdownJSON))
	if len(breakdown) == 0 && sale.AmountReceived > 0 {
		breakdown = []models.PaymentBreakdownEntry{{Mode: sale.PaymentMode, Amount: sale.AmountReceived}}
	}

	entries := make([]models.FinanceTransaction, 0, len(breakdown))
	for index, entry := range breakdown {
		entries = append(entries, models.FinanceTransaction{
			SourceModule:    "offline_sale",
			SourceID:        fmt.Sprintf("%s::%d", sale.ID.String(), index),
			TransactionDate: sale.SaleDate,
			Direction:       "in",
			PaymentMode:     entry.Mode,
			Amount:          entry.Amount,
			ReferenceID:     sale.ID.String(),
			ReferenceLabel:  sale.BillNumber,
			PartyID:         partyID,
			PartyName:       sale.CustomerName,
			PartyType:       "customer",
			Remarks:         remarks,
		})
	}

	return s.financeRepo.ReplaceMany("offline_sale", sale.ID.String(), entries)
}

func (s *OfflineSaleService) UpdatePaymentBreakdown(id string, breakdown []models.PaymentBreakdownEntry) error {
	sale, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	normalized := normalizePaymentBreakdown(breakdown)
	receivedAmount := totalPaymentBreakdown(normalized)
	if receivedAmount > sale.FinalTotal {
		return errors.New("received amount cannot exceed total sale amount")
	}

	existingBreakdown := normalizePaymentBreakdown(parsePaymentBreakdown(sale.PaymentBreakdownJSON))
	if len(existingBreakdown) == 0 && sale.AmountReceived > 0 {
		existingBreakdown = []models.PaymentBreakdownEntry{{Mode: sale.PaymentMode, Amount: sale.AmountReceived}}
	}

	if s.settingsRepo != nil {
		for _, entry := range existingBreakdown {
			if err := s.settingsRepo.AdjustPaymentBalance(-entry.Amount, entry.Mode); err != nil {
				return err
			}
		}
		for _, entry := range normalized {
			if err := s.settingsRepo.ApplyCollectedPayment(entry.Amount, entry.Mode); err != nil {
				return err
			}
		}
	}

	sale.PaymentBreakdown = normalized
	sale.PaymentBreakdownJSON = serializePaymentBreakdown(normalized)
	sale.AmountReceived = receivedAmount
	sale.PaymentMode = primaryPaymentMode(normalized, "cash")
	sale.BalanceDue = sale.FinalTotal - receivedAmount
	if sale.BalanceDue < 0 {
		sale.BalanceDue = 0
	}
	if receivedAmount >= sale.FinalTotal && sale.FinalTotal > 0 {
		sale.Status = "paid"
	} else if receivedAmount > 0 {
		sale.Status = "partial"
	} else {
		sale.Status = "due"
	}

	if err := s.repo.UpdatePaymentBreakdown(id, sale.PaymentMode, sale.AmountReceived, sale.BalanceDue, sale.Status, sale.PaymentBreakdownJSON); err != nil {
		return err
	}

	return s.syncFinanceTransaction(sale)
}
