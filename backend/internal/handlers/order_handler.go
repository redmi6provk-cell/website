package handlers

import (
	"net/http"
	"strings"

	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrderHandler struct {
	orderService *services.OrderService
}

func NewOrderHandler(orderService *services.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Address        string  `json:"address" binding:"required"`
		CustomerName   string  `json:"customer_name"`
		CustomerPhone  string  `json:"customer_phone"`
		ShopName       string  `json:"shop_name"`
		AddressLine    string  `json:"address_line"`
		Pincode        string  `json:"pincode"`
		City           string  `json:"city"`
		State          string  `json:"state"`
		DeliveryType   string  `json:"delivery_type"`
		PaymentMode    string  `json:"payment_mode"`
		PaymentStatus  string  `json:"payment_status"`
		Notes          string  `json:"notes"`
		DeliveryCharge float64 `json:"delivery_charge"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Address is required")
		return
	}

	order, err := h.orderService.CreateOrder(userID, services.CreateOrderInput{
		Address:        req.Address,
		CustomerName:   req.CustomerName,
		CustomerPhone:  req.CustomerPhone,
		ShopName:       req.ShopName,
		AddressLine:    req.AddressLine,
		Pincode:        req.Pincode,
		City:           req.City,
		State:          req.State,
		DeliveryType:   req.DeliveryType,
		PaymentMode:    req.PaymentMode,
		PaymentStatus:  req.PaymentStatus,
		Notes:          req.Notes,
		DeliveryCharge: req.DeliveryCharge,
	})
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Created(c, "Order placed successfully", order)
}

func (h *OrderHandler) GetMyOrders(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	orders, err := h.orderService.GetUserOrders(userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to fetch orders")
		return
	}
	response.OK(c, "Orders fetched", orders)
}

// Admin only endpoints

func (h *OrderHandler) GetAllOrders(c *gin.Context) {
	orders, err := h.orderService.GetAllOrders()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to fetch orders")
		return
	}
	response.OK(c, "All orders fetched", orders)
}

func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	id := c.Param("id")
	orderUUID, err := uuid.Parse(id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid order ID")
		return
	}

	var req struct {
		Status                  string `json:"status" binding:"required"`
		Note                    string `json:"note"`
		PaymentStatus           string `json:"payment_status"`
		Notes                   string `json:"notes"`
		PaymentCollectionMethod string `json:"payment_collection_method"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Status is required")
		return
	}

	changedBy, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := h.orderService.UpdateStatus(orderUUID, services.UpdateOrderStatusInput{
		Status:                  req.Status,
		Note:                    req.Note,
		PaymentStatus:           req.PaymentStatus,
		Notes:                   req.Notes,
		PaymentCollectionMethod: req.PaymentCollectionMethod,
	}, &changedBy); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.OK(c, "Order status updated", nil)
}

func (h *OrderHandler) UpdateOrderInvoiceNumber(c *gin.Context) {
	id := c.Param("id")
	orderUUID, err := uuid.Parse(id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid order ID")
		return
	}

	var req struct {
		InvoiceNumber string `json:"invoice_number"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invoice number payload is invalid")
		return
	}

	if err := h.orderService.UpdateInvoiceNumber(orderUUID, strings.TrimSpace(req.InvoiceNumber)); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Order invoice number updated", nil)
}
