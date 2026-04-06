package services

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"backend/internal/models"
	"backend/internal/repository"

	"github.com/google/uuid"
)

type OrderService struct {
	orderRepo    *repository.OrderRepository
	cartRepo     *repository.CartRepository
	arpRepo      *repository.ARPRepository
	userRepo     *repository.UserRepository
	productRepo  *repository.ProductRepository
	invoiceRepo  *repository.InvoiceSequenceRepository
	settingsRepo repository.SettingsRepository
	financeRepo  *repository.FinanceTransactionRepository
}

func NewOrderService(orderRepo *repository.OrderRepository, cartRepo *repository.CartRepository, arpRepo *repository.ARPRepository, userRepo *repository.UserRepository, productRepo *repository.ProductRepository, invoiceRepo *repository.InvoiceSequenceRepository, settingsRepo repository.SettingsRepository, financeRepo *repository.FinanceTransactionRepository) *OrderService {
	return &OrderService{orderRepo: orderRepo, cartRepo: cartRepo, arpRepo: arpRepo, userRepo: userRepo, productRepo: productRepo, invoiceRepo: invoiceRepo, settingsRepo: settingsRepo, financeRepo: financeRepo}
}

type CreateOrderInput struct {
	Address        string
	CustomerName   string
	CustomerPhone  string
	ShopName       string
	AddressLine    string
	Pincode        string
	City           string
	State          string
	DeliveryType   string
	PaymentMode    string
	PaymentStatus  string
	Notes          string
	DeliveryCharge float64
}

type deliveryAddressDetails struct {
	AddressLine string
	Pincode     string
	City        string
	State       string
}

var deliveryAddressPattern = regexp.MustCompile(`^[^,]+,\s*\d{10},\s*(.+),\s*([^,]+),\s*([^-|]+)\s*-\s*(\d{6})$`)

func (s *OrderService) CreateOrder(userID uuid.UUID, input CreateOrderInput) (*models.Order, error) {
	cartItems, err := s.cartRepo.GetCartByUserID(userID)
	if err != nil || len(cartItems) == 0 {
		return nil, errors.New("cart is empty or failed to load cart")
	}

	var subtotal float64
	var orderItems []models.OrderItem

	for _, item := range cartItems {
		pricing := item.Product.PricingForQuantity(item.Quantity)
		if !pricing.MeetsMinimum {
			return nil, fmt.Errorf("%s requires minimum %d quantity", item.Product.Name, item.Product.MinimumOrderQuantity)
		}
		if item.Quantity > item.Product.Stock {
			return nil, fmt.Errorf("%s only has %d units in stock", item.Product.Name, item.Product.Stock)
		}

		subtotal += pricing.LineFinalTotal
		orderItems = append(orderItems, models.OrderItem{
			ProductID: item.ProductID,
			Quantity:  item.Quantity,
			Price:     pricing.FinalUnitPrice,
		})
	}

	deliveryType := input.DeliveryType
	if deliveryType != models.OrderDeliveryTypePickup {
		deliveryType = models.OrderDeliveryTypeDelivery
	}

	paymentMode := input.PaymentMode
	if paymentMode != models.OrderPaymentModeQR {
		paymentMode = models.OrderPaymentModeCOD
	}

	paymentStatus := input.PaymentStatus
	if paymentStatus == "" {
		paymentStatus = models.OrderPaymentStatusPending
	}

	order := &models.Order{
		ID:             uuid.New(),
		UserID:         userID,
		CustomerName:   input.CustomerName,
		CustomerPhone:  input.CustomerPhone,
		ShopName:       input.ShopName,
		Subtotal:       subtotal,
		DeliveryCharge: input.DeliveryCharge,
		Total:          subtotal + input.DeliveryCharge,
		Status:         models.OrderStatusPending,
		DeliveryType:   deliveryType,
		PaymentMode:    paymentMode,
		PaymentStatus:  paymentStatus,
		Address:        input.Address,
		Notes:          input.Notes,
		Items:          orderItems,
		StatusEvents: []models.OrderStatusEvent{
			{
				Status: models.OrderStatusPending,
				Note:   "Order placed successfully",
			},
		},
	}

	invoiceNumber, err := s.invoiceRepo.NextSalesInvoiceNumber()
	if err != nil {
		return nil, err
	}
	order.InvoiceNumber = invoiceNumber

	if err := s.orderRepo.CreateOrder(order); err != nil {
		return nil, err
	}

	for _, item := range cartItems {
		if err := s.productRepo.ReduceStock(item.ProductID.String(), item.Quantity); err != nil {
			return nil, err
		}
	}

	if err := s.cartRepo.ClearCart(userID); err != nil {
		return nil, err
	}

	if deliveryType == models.OrderDeliveryTypeDelivery && s.userRepo != nil {
		addressDetails := resolveDeliveryAddressDetails(input)
		if err := s.userRepo.UpdateCheckoutAddress(
			userID,
			addressDetails.AddressLine,
			addressDetails.Pincode,
			addressDetails.City,
			addressDetails.State,
		); err != nil {
			return nil, err
		}
	}

	if s.arpRepo != nil && s.userRepo != nil {
		user, err := s.userRepo.FindByID(userID)
		if err == nil {
			_ = s.arpRepo.CreateInvoiceForOrder(user, order)
		}
	}

	return order, nil
}

func (s *OrderService) GetUserOrders(userID uuid.UUID) ([]models.Order, error) {
	return s.orderRepo.GetUserOrders(userID)
}

func (s *OrderService) GetAllOrders() ([]models.Order, error) {
	return s.orderRepo.GetAllOrders()
}

type UpdateOrderStatusInput struct {
	Status                  string
	Note                    string
	PaymentStatus           string
	Notes                   string
	PaymentCollectionMethod string
}

func (s *OrderService) UpdateStatus(orderID uuid.UUID, input UpdateOrderStatusInput, changedBy *uuid.UUID) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return err
	}

	switch input.Status {
	case models.OrderStatusPending,
		models.OrderStatusConfirmed,
		models.OrderStatusPacked,
		models.OrderStatusOutForDelivery,
		models.OrderStatusDelivered,
		models.OrderStatusCancelled:
	default:
		return errors.New("invalid order status")
	}

	if input.PaymentStatus != "" {
		switch input.PaymentStatus {
		case models.OrderPaymentStatusPending,
			models.OrderPaymentStatusPendingVerification,
			models.OrderPaymentStatusPaid,
			models.OrderPaymentStatusUnpaid:
		default:
			return errors.New("invalid payment status")
		}
	}

	if input.Status == models.OrderStatusConfirmed &&
		order.Status != models.OrderStatusConfirmed &&
		order.PaymentMode == models.OrderPaymentModeCOD &&
		s.settingsRepo != nil {
		if err := s.settingsRepo.ApplyCollectedPayment(order.Total, input.PaymentCollectionMethod); err != nil {
			return err
		}
	}

	if err := s.orderRepo.UpdateStatus(orderID, input.Status, input.Note, input.PaymentStatus, input.Notes, changedBy); err != nil {
		return err
	}

	if input.Status == models.OrderStatusConfirmed &&
		order.Status != models.OrderStatusConfirmed &&
		order.PaymentMode == models.OrderPaymentModeCOD {
		return s.syncFinanceTransaction(order, input.PaymentCollectionMethod)
	}

	return nil
}

func (s *OrderService) SyncMissingERPInvoices() error {
	if s.arpRepo == nil || s.userRepo == nil {
		return nil
	}

	orders, err := s.orderRepo.GetAllOrdersWithItems()
	if err != nil {
		return err
	}

	for _, order := range orders {
		user, err := s.userRepo.FindByID(order.UserID)
		if err != nil {
			continue
		}

		orderCopy := order
		if err := s.arpRepo.CreateInvoiceForOrder(user, &orderCopy); err != nil {
			return err
		}
	}

	return nil
}

func (s *OrderService) UpdateInvoiceNumber(orderID uuid.UUID, invoiceNumber string) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return err
	}

	invoiceNumber = strings.TrimSpace(invoiceNumber)
	if invoiceNumber == "" {
		invoiceNumber = order.InvoiceNumber
	}

	hasConflict, err := s.invoiceRepo.IsSalesInvoiceNumberInUse(invoiceNumber, orderID.String(), "")
	if err != nil {
		return err
	}
	if hasConflict {
		return errors.New("invoice number already in use in orders or offline sales")
	}

	if err := s.orderRepo.UpdateInvoiceNumber(orderID, invoiceNumber); err != nil {
		return err
	}

	if order.PaymentMode == models.OrderPaymentModeCOD &&
		order.Status == models.OrderStatusConfirmed {
		order.InvoiceNumber = invoiceNumber
		return s.syncFinanceTransaction(order, "")
	}

	return nil
}

func (s *OrderService) syncFinanceTransaction(order *models.Order, paymentMode string) error {
	if s.financeRepo == nil {
		return nil
	}

	mode := paymentMode
	if mode == "" {
		mode = order.PaymentMode
	}

	remarks := order.Notes
	if remarks == "" {
		remarks = "Order payment collected"
	}

	return s.financeRepo.Replace(&models.FinanceTransaction{
		SourceModule:    "order_cod",
		SourceID:        order.ID.String(),
		TransactionDate: time.Now(),
		Direction:       "in",
		PaymentMode:     mode,
		Amount:          order.Total,
		ReferenceID:     order.ID.String(),
		ReferenceLabel:  s.orderReferenceLabel(order),
		PartyName:       order.CustomerName,
		PartyType:       "customer",
		Remarks:         remarks,
	})
}

func (s *OrderService) orderReferenceLabel(order *models.Order) string {
	if order == nil {
		return ""
	}
	return order.InvoiceNumber
}

func resolveDeliveryAddressDetails(input CreateOrderInput) deliveryAddressDetails {
	addressLine := strings.TrimSpace(input.AddressLine)
	pincode := strings.TrimSpace(input.Pincode)
	city := strings.TrimSpace(input.City)
	state := strings.TrimSpace(input.State)

	if addressLine != "" && pincode != "" && city != "" && state != "" {
		return deliveryAddressDetails{
			AddressLine: addressLine,
			Pincode:     pincode,
			City:        city,
			State:       state,
		}
	}

	address := strings.TrimSpace(input.Address)
	customerPart := strings.Split(address, " | Payment:")[0]
	match := deliveryAddressPattern.FindStringSubmatch(customerPart)
	if len(match) != 5 {
		return deliveryAddressDetails{
			AddressLine: addressLine,
			Pincode:     pincode,
			City:        city,
			State:       state,
		}
	}

	if addressLine == "" {
		addressLine = strings.TrimSpace(match[1])
	}
	if city == "" {
		city = strings.TrimSpace(match[2])
	}
	if state == "" {
		state = strings.TrimSpace(match[3])
	}
	if pincode == "" {
		pincode = strings.TrimSpace(match[4])
	}

	return deliveryAddressDetails{
		AddressLine: addressLine,
		Pincode:     pincode,
		City:        city,
		State:       state,
	}
}
