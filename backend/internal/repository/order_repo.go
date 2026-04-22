package repository

import (
	"backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

func (r *OrderRepository) CreateOrder(order *models.Order) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if order.ID == uuid.Nil {
			order.ID = uuid.New()
		}
		for index := range order.Items {
			if order.Items[index].ID == uuid.Nil {
				order.Items[index].ID = uuid.New()
			}
			order.Items[index].OrderID = order.ID
		}
		for index := range order.StatusEvents {
			if order.StatusEvents[index].ID == uuid.Nil {
				order.StatusEvents[index].ID = uuid.New()
			}
			order.StatusEvents[index].OrderID = order.ID
		}

		// Save the order once with its prepared child records.
		if err := tx.Create(order).Error; err != nil {
			return err
		}
		// Clear exactly this user's cart items
		if err := tx.Where("user_id = ?", order.UserID).Delete(&models.Cart{}).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *OrderRepository) GetUserOrders(userID uuid.UUID) ([]models.Order, error) {
	var orders []models.Order
	err := r.db.
		Preload("User").
		Preload("Items.Product").
		Preload("Items.Product.Brand").
		Preload("Items.Product.Category").
		Preload("StatusEvents", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at asc")
		}).
		Preload("StatusEvents.ChangedByUser").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Find(&orders).Error
	return orders, err
}

func (r *OrderRepository) GetAllOrders() ([]models.Order, error) {
	var orders []models.Order
	err := r.db.
		Preload("User").
		Preload("Items.Product").
		Preload("Items.Product.Brand").
		Preload("Items.Product.Category").
		Preload("StatusEvents", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at asc")
		}).
		Preload("StatusEvents.ChangedByUser").
		Order("created_at desc").
		Find(&orders).Error
	return orders, err
}

func (r *OrderRepository) GetAllOrdersWithItems() ([]models.Order, error) {
	var orders []models.Order
	err := r.db.
		Preload("User").
		Preload("Items.Product").
		Preload("Items.Product.Brand").
		Preload("Items.Product.Category").
		Preload("StatusEvents", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at asc")
		}).
		Preload("StatusEvents.ChangedByUser").
		Order("created_at asc").
		Find(&orders).Error
	return orders, err
}

func (r *OrderRepository) GetByID(orderID uuid.UUID) (*models.Order, error) {
	var order models.Order
	err := r.db.
		Preload("User").
		Preload("Items.Product").
		Preload("StatusEvents", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at asc")
		}).
		First(&order, "id = ?", orderID).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *OrderRepository) UpdateStatus(orderID uuid.UUID, status string, note string, paymentStatus string, notes string, receivedAmount *float64, paymentCollectionMethod string, changedBy *uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"status": status,
		}
		if paymentStatus != "" {
			updates["payment_status"] = paymentStatus
		}
		if notes != "" {
			updates["notes"] = notes
		}
		if receivedAmount != nil {
			updates["received_amount"] = *receivedAmount
		}
		if paymentCollectionMethod != "" {
			updates["payment_collection_method"] = paymentCollectionMethod
		}

		if err := tx.Model(&models.Order{}).
			Where("id = ?", orderID).
			Updates(updates).Error; err != nil {
			return err
		}

		event := models.OrderStatusEvent{
			ID:        uuid.New(),
			OrderID:   orderID,
			Status:    status,
			Note:      note,
			ChangedBy: changedBy,
		}

		return tx.Create(&event).Error
	})
}

func (r *OrderRepository) UpdateInvoiceNumber(orderID uuid.UUID, invoiceNumber string) error {
	return r.db.Model(&models.Order{}).
		Where("id = ?", orderID).
		Update("invoice_number", invoiceNumber).Error
}

func (r *OrderRepository) UpdatePaymentFields(orderID uuid.UUID, paymentStatus string, receivedAmount float64, paymentCollectionMethod string) error {
	updates := map[string]interface{}{
		"payment_status":            paymentStatus,
		"received_amount":           receivedAmount,
		"payment_collection_method": paymentCollectionMethod,
	}

	return r.db.Model(&models.Order{}).
		Where("id = ?", orderID).
		Updates(updates).Error
}

func (r *OrderRepository) UpdatePaymentBreakdown(orderID uuid.UUID, paymentBreakdownJSON string) error {
	return r.db.Model(&models.Order{}).
		Where("id = ?", orderID).
		Update("payment_breakdown_json", paymentBreakdownJSON).Error
}

func (r *OrderRepository) UpdateItems(
	orderID uuid.UUID,
	items []models.OrderItem,
	subtotal float64,
	total float64,
	paymentStatus string,
	receivedAmount float64,
	paymentCollectionMethod string,
	paymentBreakdownJSON string,
	stockAdjustments map[uuid.UUID]int,
	eventNote string,
	status string,
	changedBy *uuid.UUID,
) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for productID, delta := range stockAdjustments {
			if delta == 0 {
				continue
			}

			if delta > 0 {
				if err := tx.Model(&models.Product{}).
					Where("id = ?", productID).
					Update("stock", gorm.Expr("stock + ?", delta)).Error; err != nil {
					return err
				}
				continue
			}

			result := tx.Model(&models.Product{}).
				Where("id = ? AND stock >= ?", productID, -delta).
				Update("stock", gorm.Expr("stock - ?", -delta))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return gorm.ErrRecordNotFound
			}
		}

		for _, item := range items {
			if err := tx.Model(&models.OrderItem{}).
				Where("id = ? AND order_id = ?", item.ID, orderID).
				Updates(map[string]interface{}{
					"quantity": item.Quantity,
					"price":    item.Price,
				}).Error; err != nil {
				return err
			}
		}

		updates := map[string]interface{}{
			"subtotal":                  subtotal,
			"total":                     total,
			"payment_status":            paymentStatus,
			"received_amount":           receivedAmount,
			"payment_collection_method": paymentCollectionMethod,
			"payment_breakdown_json":    paymentBreakdownJSON,
		}

		if err := tx.Model(&models.Order{}).
			Where("id = ?", orderID).
			Updates(updates).Error; err != nil {
			return err
		}

		event := models.OrderStatusEvent{
			ID:        uuid.New(),
			OrderID:   orderID,
			Status:    status,
			Note:      eventNote,
			ChangedBy: changedBy,
		}

		return tx.Create(&event).Error
	})
}

func (r *OrderRepository) HasInvoiceNumberConflict(orderID uuid.UUID, invoiceNumber string) (bool, error) {
	var count int64
	query := r.db.Model(&models.Order{}).
		Where("LOWER(TRIM(invoice_number)) = LOWER(TRIM(?))", invoiceNumber)

	if orderID != uuid.Nil {
		query = query.Where("id <> ?", orderID)
	}

	if err := query.Count(&count).Error; err != nil {
		return false, err
	}

	return count > 0, nil
}
