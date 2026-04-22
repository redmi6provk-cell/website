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
	"gorm.io/gorm"
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
		if !item.Product.IsActive {
			return nil, fmt.Errorf("%s is no longer available for sale", item.Product.Name)
		}
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
	ReceivedAmount          *float64
}

type UpdateOrderItemsInput struct {
	Items     []UpdateOrderItemInput
	ChangedBy *uuid.UUID
}

type UpdateOrderItemInput struct {
	ID       uuid.UUID
	Quantity int
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

	newReceivedAmount := order.ReceivedAmount
	if input.ReceivedAmount != nil {
		if *input.ReceivedAmount < 0 {
			return errors.New("received amount cannot be negative")
		}
		if *input.ReceivedAmount > order.Total {
			return errors.New("received amount cannot exceed total order amount")
		}
		newReceivedAmount = *input.ReceivedAmount
	}

	newCollectionMethod := strings.TrimSpace(input.PaymentCollectionMethod)
	if newCollectionMethod == "" {
		newCollectionMethod = strings.TrimSpace(order.PaymentCollectionMethod)
	}

	if order.PaymentMode == models.OrderPaymentModeCOD && input.Status == models.OrderStatusConfirmed {
		if newReceivedAmount >= order.Total && order.Total > 0 {
			input.PaymentStatus = models.OrderPaymentStatusPaid
		} else {
			input.PaymentStatus = models.OrderPaymentStatusUnpaid
		}
	}

	if order.PaymentMode == models.OrderPaymentModeCOD && s.settingsRepo != nil {
		shouldSyncBalances :=
			input.Status == models.OrderStatusConfirmed &&
				(order.Status != models.OrderStatusConfirmed || input.ReceivedAmount != nil || newCollectionMethod != strings.TrimSpace(order.PaymentCollectionMethod))

		if shouldSyncBalances {
			if order.Status == models.OrderStatusConfirmed && order.ReceivedAmount > 0 && strings.TrimSpace(order.PaymentCollectionMethod) != "" {
				if err := s.settingsRepo.AdjustPaymentBalance(-order.ReceivedAmount, order.PaymentCollectionMethod); err != nil {
					return err
				}
			}
			if newReceivedAmount > 0 && newCollectionMethod != "" {
				if err := s.settingsRepo.ApplyCollectedPayment(newReceivedAmount, newCollectionMethod); err != nil {
					return err
				}
			}
		}
	}

	if err := s.orderRepo.UpdateStatus(orderID, input.Status, input.Note, input.PaymentStatus, input.Notes, &newReceivedAmount, newCollectionMethod, changedBy); err != nil {
		return err
	}

	order.Status = input.Status
	if input.PaymentStatus != "" {
		order.PaymentStatus = input.PaymentStatus
	}
	if input.Notes != "" {
		order.Notes = input.Notes
	}
	order.ReceivedAmount = newReceivedAmount
	order.PaymentCollectionMethod = newCollectionMethod

	if input.Status == models.OrderStatusConfirmed &&
		order.PaymentMode == models.OrderPaymentModeCOD {
		return s.syncFinanceTransaction(order, newCollectionMethod)
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

func (s *OrderService) SyncFinanceTransactions() error {
	if s.financeRepo == nil {
		return nil
	}

	orders, err := s.orderRepo.GetAllOrders()
	if err != nil {
		return err
	}

	for index := range orders {
		order := &orders[index]
		if order.Status == models.OrderStatusConfirmed &&
			order.PaymentMode == models.OrderPaymentModeCOD &&
			order.ReceivedAmount > 0 {
			if err := s.syncFinanceTransaction(order, ""); err != nil {
				return err
			}
			continue
		}

		if err := s.financeRepo.DeleteBySource("order_cod", order.ID.String()); err != nil {
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

func (s *OrderService) UpdatePaymentDetails(orderID uuid.UUID, receivedAmount float64, collectionMethod string) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return err
	}

	if receivedAmount < 0 {
		return errors.New("received amount cannot be negative")
	}
	if receivedAmount > order.Total {
		return errors.New("received amount cannot exceed total order amount")
	}

	method := strings.TrimSpace(collectionMethod)
	if receivedAmount > 0 && method == "" {
		method = strings.TrimSpace(order.PaymentCollectionMethod)
	}
	if receivedAmount > 0 && method == "" {
		if strings.EqualFold(order.PaymentMode, models.OrderPaymentModeQR) {
			method = "QR"
		} else {
			method = "cash"
		}
	}
	if receivedAmount == 0 {
		method = ""
	}

	if s.settingsRepo != nil && order.ReceivedAmount > 0 && strings.TrimSpace(order.PaymentCollectionMethod) != "" {
		if err := s.settingsRepo.AdjustPaymentBalance(-order.ReceivedAmount, order.PaymentCollectionMethod); err != nil {
			return err
		}
	}
	if s.settingsRepo != nil && receivedAmount > 0 && method != "" {
		if err := s.settingsRepo.ApplyCollectedPayment(receivedAmount, method); err != nil {
			return err
		}
	}

	paymentStatus := models.OrderPaymentStatusUnpaid
	if receivedAmount >= order.Total && order.Total > 0 {
		paymentStatus = models.OrderPaymentStatusPaid
	}

	if err := s.orderRepo.UpdatePaymentFields(orderID, paymentStatus, receivedAmount, method); err != nil {
		return err
	}

	order.ReceivedAmount = receivedAmount
	order.PaymentCollectionMethod = method
	order.PaymentStatus = paymentStatus
	return s.syncFinanceTransaction(order, method)
}

func (s *OrderService) UpdatePaymentBreakdown(orderID uuid.UUID, breakdown []models.PaymentBreakdownEntry) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return err
	}

	normalized := normalizePaymentBreakdown(breakdown)
	receivedAmount := totalPaymentBreakdown(normalized)
	if receivedAmount > order.Total {
		return errors.New("received amount cannot exceed total order amount")
	}

	existingBreakdown := normalizePaymentBreakdown(parsePaymentBreakdown(order.PaymentBreakdownJSON))
	if len(existingBreakdown) == 0 && order.ReceivedAmount > 0 {
		mode := strings.TrimSpace(order.PaymentCollectionMethod)
		if mode == "" {
			if strings.EqualFold(order.PaymentMode, models.OrderPaymentModeQR) {
				mode = "QR"
			} else {
				mode = "cash"
			}
		}
		existingBreakdown = []models.PaymentBreakdownEntry{{Mode: mode, Amount: order.ReceivedAmount}}
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

	paymentStatus := models.OrderPaymentStatusUnpaid
	if receivedAmount >= order.Total && order.Total > 0 {
		paymentStatus = models.OrderPaymentStatusPaid
	}
	paymentMethod := primaryPaymentMode(normalized, "")

	order.ReceivedAmount = receivedAmount
	order.PaymentCollectionMethod = paymentMethod
	order.PaymentStatus = paymentStatus
	order.PaymentBreakdownJSON = serializePaymentBreakdown(normalized)
	order.PaymentBreakdown = normalized

	if err := s.orderRepo.UpdatePaymentFields(orderID, paymentStatus, receivedAmount, paymentMethod); err != nil {
		return err
	}
	if err := s.orderRepo.UpdatePaymentBreakdown(orderID, order.PaymentBreakdownJSON); err != nil {
		return err
	}

	return s.syncFinanceTransaction(order, paymentMethod)
}

func (s *OrderService) UpdateItems(orderID uuid.UUID, input UpdateOrderItemsInput) (*models.Order, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, err
	}

	if len(input.Items) == 0 {
		return nil, errors.New("at least one order item is required")
	}
	if len(input.Items) != len(order.Items) {
		return nil, errors.New("all existing order items must be provided")
	}

	existingItems := make(map[uuid.UUID]models.OrderItem, len(order.Items))
	for _, item := range order.Items {
		existingItems[item.ID] = item
	}

	updatedItems := make([]models.OrderItem, 0, len(input.Items))
	stockAdjustments := make(map[uuid.UUID]int, len(input.Items))
	var subtotal float64

	for _, payloadItem := range input.Items {
		currentItem, ok := existingItems[payloadItem.ID]
		if !ok {
			return nil, errors.New("invalid order item provided")
		}
		if payloadItem.Quantity < 1 {
			return nil, errors.New("quantity must be at least 1")
		}
		if !currentItem.Product.IsActive {
			return nil, fmt.Errorf("%s is no longer available for sale", currentItem.Product.Name)
		}

		pricing := currentItem.Product.PricingForQuantity(payloadItem.Quantity)
		if !pricing.MeetsMinimum {
			return nil, fmt.Errorf("%s requires minimum %d quantity", currentItem.Product.Name, currentItem.Product.MinimumOrderQuantity)
		}

		delta := payloadItem.Quantity - currentItem.Quantity
		if delta > 0 && currentItem.Product.Stock < delta {
			return nil, fmt.Errorf("%s only has %d extra units in stock", currentItem.Product.Name, currentItem.Product.Stock)
		}

		stockAdjustments[currentItem.ProductID] -= delta
		updatedItem := currentItem
		updatedItem.Quantity = payloadItem.Quantity
		updatedItem.Price = pricing.FinalUnitPrice
		updatedItems = append(updatedItems, updatedItem)
		subtotal += pricing.LineFinalTotal
		delete(existingItems, payloadItem.ID)
	}

	if len(existingItems) > 0 {
		return nil, errors.New("some order items are missing from the update payload")
	}

	total := subtotal + order.DeliveryCharge
	if order.ReceivedAmount > total {
		return nil, errors.New("received amount is higher than the revised order total, please adjust payment first")
	}

	paymentStatus := order.PaymentStatus
	if strings.EqualFold(order.PaymentMode, models.OrderPaymentModeCOD) {
		paymentStatus = models.OrderPaymentStatusUnpaid
		if order.ReceivedAmount >= total && total > 0 {
			paymentStatus = models.OrderPaymentStatusPaid
		}
	}

	eventNote := fmt.Sprintf("Order items updated by admin. Revised total: Rs. %.2f", total)

	if err := s.orderRepo.UpdateItems(
		orderID,
		updatedItems,
		subtotal,
		total,
		paymentStatus,
		order.ReceivedAmount,
		order.PaymentCollectionMethod,
		order.PaymentBreakdownJSON,
		stockAdjustments,
		eventNote,
		order.Status,
		input.ChangedBy,
	); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("insufficient stock available for the updated quantity")
		}
		return nil, err
	}

	order.Items = updatedItems
	order.Subtotal = subtotal
	order.Total = total
	order.PaymentStatus = paymentStatus
	order.StatusEvents = append(order.StatusEvents, models.OrderStatusEvent{
		ID:        uuid.New(),
		OrderID:   order.ID,
		Status:    order.Status,
		Note:      eventNote,
		ChangedBy: input.ChangedBy,
		CreatedAt: time.Now(),
	})

	if strings.EqualFold(order.PaymentMode, models.OrderPaymentModeCOD) {
		if err := s.syncFinanceTransaction(order, order.PaymentCollectionMethod); err != nil {
			return nil, err
		}
	}

	return order, nil
}

func (s *OrderService) syncFinanceTransaction(order *models.Order, paymentMode string) error {
	if s.financeRepo == nil {
		return nil
	}

	remarks := order.Notes
	if remarks == "" {
		remarks = "Order payment collected"
	}

	if order.ReceivedAmount <= 0 {
		return s.financeRepo.DeleteBySourcePrefix("order_cod", order.ID.String())
	}

	partyID := ""
	if s.arpRepo != nil {
		phone := strings.TrimSpace(order.CustomerPhone)
		if phone == "" && s.userRepo != nil {
			if user, err := s.userRepo.FindByID(order.UserID); err == nil {
				phone = strings.TrimSpace(user.Phone)
			}
		}
		if phone != "" {
			if party, err := s.arpRepo.FindPartyByPhone(phone); err == nil {
				partyID = party.PartyID.String()
			}
		}
	}

	breakdown := normalizePaymentBreakdown(parsePaymentBreakdown(order.PaymentBreakdownJSON))
	if len(breakdown) == 0 && order.ReceivedAmount > 0 {
		mode := paymentMode
		if mode == "" {
			mode = order.PaymentCollectionMethod
		}
		if mode == "" {
			mode = order.PaymentMode
		}
		breakdown = []models.PaymentBreakdownEntry{{Mode: mode, Amount: order.ReceivedAmount}}
	}

	entries := make([]models.FinanceTransaction, 0, len(breakdown))
	for index, entry := range breakdown {
		entries = append(entries, models.FinanceTransaction{
			SourceModule:    "order_cod",
			SourceID:        fmt.Sprintf("%s::%d", order.ID.String(), index),
			TransactionDate: time.Now(),
			Direction:       "in",
			PaymentMode:     entry.Mode,
			Amount:          entry.Amount,
			ReferenceID:     order.ID.String(),
			ReferenceLabel:  s.orderReferenceLabel(order),
			PartyID:         partyID,
			PartyName:       order.CustomerName,
			PartyType:       "customer",
			Remarks:         remarks,
		})
	}

	return s.financeRepo.ReplaceMany("order_cod", order.ID.String(), entries)
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
