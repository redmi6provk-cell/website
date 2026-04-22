package handlers

import (
	"net/http"
	"strings"

	"backend/internal/models"
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
		Status                  string   `json:"status" binding:"required"`
		Note                    string   `json:"note"`
		PaymentStatus           string   `json:"payment_status"`
		Notes                   string   `json:"notes"`
		PaymentCollectionMethod string   `json:"payment_collection_method"`
		ReceivedAmount          *float64 `json:"received_amount"`
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
		ReceivedAmount:          req.ReceivedAmount,
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

func (h *OrderHandler) UpdateOrderPayment(c *gin.Context) {
	id := c.Param("id")
	orderUUID, err := uuid.Parse(id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid order ID")
		return
	}

	var req struct {
		ReceivedAmount          float64 `json:"received_amount"`
		PaymentCollectionMethod string  `json:"payment_collection_method"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Payment payload is invalid")
		return
	}

	if err := h.orderService.UpdatePaymentDetails(orderUUID, req.ReceivedAmount, req.PaymentCollectionMethod); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Order payment updated", nil)
}

func (h *OrderHandler) UpdateOrderPaymentBreakdown(c *gin.Context) {
	id := c.Param("id")
	orderUUID, err := uuid.Parse(id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid order ID")
		return
	}

	var req struct {
		PaymentBreakdown []models.PaymentBreakdownEntry `json:"payment_breakdown"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Payment breakdown payload is invalid")
		return
	}

	if err := h.orderService.UpdatePaymentBreakdown(orderUUID, req.PaymentBreakdown); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Order payment breakdown updated", nil)
}

func (h *OrderHandler) UpdateOrderItems(c *gin.Context) {
	id := c.Param("id")
	orderUUID, err := uuid.Parse(id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid order ID")
		return
	}

	var req struct {
		Items []struct {
			ID       string `json:"id"`
			Quantity int    `json:"quantity"`
		} `json:"items"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Order items payload is invalid")
		return
	}

	input := services.UpdateOrderItemsInput{
		Items: make([]services.UpdateOrderItemInput, 0, len(req.Items)),
	}
	for _, item := range req.Items {
		itemID, parseErr := uuid.Parse(item.ID)
		if parseErr != nil {
			response.Fail(c, http.StatusBadRequest, "Invalid order item ID")
			return
		}
		input.Items = append(input.Items, services.UpdateOrderItemInput{
			ID:       itemID,
			Quantity: item.Quantity,
		})
	}

	changedBy, ok := getUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "Unauthorized")
		return
	}
	input.ChangedBy = &changedBy

	order, err := h.orderService.UpdateItems(orderUUID, input)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Order items updated", order)
}
