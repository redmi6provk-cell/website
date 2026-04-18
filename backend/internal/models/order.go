package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	OrderStatusPending        = "pending"
	OrderStatusConfirmed      = "confirmed"
	OrderStatusPacked         = "packed"
	OrderStatusOutForDelivery = "out_for_delivery"
	OrderStatusDelivered      = "delivered"
	OrderStatusCancelled      = "cancelled"

	OrderDeliveryTypeDelivery = "delivery"
	OrderDeliveryTypePickup   = "pickup"

	OrderPaymentModeCOD = "cod"
	OrderPaymentModeQR  = "qr"

	OrderPaymentStatusPending             = "pending"
	OrderPaymentStatusPendingVerification = "pending_verification"
	OrderPaymentStatusPaid                = "paid"
	OrderPaymentStatusUnpaid              = "unpaid"
)

type Order struct {
	ID                      uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID                  uuid.UUID          `gorm:"type:uuid;not null" json:"user_id"`
	User                    User               `gorm:"foreignKey:UserID" json:"user"`
	CustomerName            string             `gorm:"type:varchar(120)" json:"customer_name"`
	CustomerPhone           string             `gorm:"type:varchar(20)" json:"customer_phone"`
	ShopName                string             `gorm:"type:varchar(120)" json:"shop_name"`
	InvoiceNumber           string             `gorm:"type:varchar(120);index" json:"invoice_number"`
	Subtotal                float64            `json:"subtotal"`
	DeliveryCharge          float64            `json:"delivery_charge"`
	Total                   float64            `json:"total"`
	Status                  string             `gorm:"default:'pending';type:varchar(50)" json:"status"`
	DeliveryType            string             `gorm:"default:'delivery';type:varchar(30)" json:"delivery_type"`
	PaymentMode             string             `gorm:"default:'cod';type:varchar(30)" json:"payment_mode"`
	PaymentStatus           string             `gorm:"default:'pending';type:varchar(30)" json:"payment_status"`
	ReceivedAmount          float64            `gorm:"type:decimal(15,2);default:0" json:"received_amount"`
	PaymentCollectionMethod string             `gorm:"type:varchar(120)" json:"payment_collection_method"`
	Address                 string             `json:"address"`
	Notes                   string             `json:"notes"`
	Items                   []OrderItem        `gorm:"foreignKey:OrderID" json:"items"`
	StatusEvents            []OrderStatusEvent `gorm:"foreignKey:OrderID" json:"status_events"`
	CreatedAt               time.Time          `json:"created_at"`
	UpdatedAt               time.Time          `json:"updated_at"`
}

type OrderItem struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID   uuid.UUID `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE;" json:"order_id"`
	ProductID uuid.UUID `gorm:"type:uuid;not null" json:"product_id"`
	Product   Product   `gorm:"foreignKey:ProductID" json:"product"`
	Quantity  int       `json:"quantity"`
	Price     float64   `json:"price"`
}

type OrderStatusEvent struct {
	ID            uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID       uuid.UUID  `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE;" json:"order_id"`
	Status        string     `gorm:"type:varchar(50);not null" json:"status"`
	Note          string     `json:"note"`
	ChangedBy     *uuid.UUID `gorm:"type:uuid" json:"changed_by"`
	ChangedByUser *User      `gorm:"foreignKey:ChangedBy" json:"changed_by_user,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}
