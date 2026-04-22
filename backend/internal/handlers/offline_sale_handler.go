package handlers

import (
	"net/http"
	"time"

	"backend/internal/models"
	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OfflineSaleHandler struct {
	service *services.OfflineSaleService
}

type offlineSaleItemRequest struct {
	ProductID     string  `json:"product_id"`
	ProductName   string  `json:"product_name"`
	Quantity      int     `json:"quantity"`
	SellPrice     float64 `json:"sell_price"`
	DiscountValue float64 `json:"discount_value"`
	LineTotal     float64 `json:"line_total"`
}

type offlineSaleRequest struct {
	BillNumber       string                         `json:"bill_number"`
	SaleDate         string                         `json:"sale_date"`
	CustomerPartyID  string                         `json:"customer_party_id"`
	CustomerName     string                         `json:"customer_name"`
	CustomerPhone    string                         `json:"customer_phone"`
	ShopName         string                         `json:"shop_name"`
	PaymentMode      string                         `json:"payment_mode"`
	Notes            string                         `json:"notes"`
	AmountReceived   float64                        `json:"amount_received"`
	Items            []offlineSaleItemRequest       `json:"items"`
	PaymentBreakdown []models.PaymentBreakdownEntry `json:"payment_breakdown"`
}

func NewOfflineSaleHandler(service *services.OfflineSaleService) *OfflineSaleHandler {
	return &OfflineSaleHandler{service: service}
}

func (h *OfflineSaleHandler) GetOfflineSales(c *gin.Context) {
	sales, err := h.service.GetAll()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to fetch offline sales")
		return
	}
	response.OK(c, "Offline sales fetched successfully", sales)
}

func (h *OfflineSaleHandler) CreateOfflineSale(c *gin.Context) {
	var req offlineSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "invalid authenticated user")
		return
	}

	sale, err := buildOfflineSaleModel(req)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	sale.CreatedBy = userID

	if err := h.service.Create(&sale); err != nil {
		if h.service.IsStockConflict(err) {
			response.Fail(c, http.StatusConflict, "Stock available nahi hai for one or more products.")
			return
		}
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Created(c, "Offline sale created successfully", sale)
}

func (h *OfflineSaleHandler) UpdateOfflineSale(c *gin.Context) {
	id := c.Param("id")
	var req offlineSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "invalid authenticated user")
		return
	}
	parsedID, err := uuid.Parse(id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid sale id")
		return
	}

	sale, err := buildOfflineSaleModel(req)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	sale.ID = parsedID
	sale.CreatedBy = userID

	if err := h.service.Update(&sale); err != nil {
		if h.service.IsStockConflict(err) {
			response.Fail(c, http.StatusConflict, "Stock available nahi hai for one or more products.")
			return
		}
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.OK(c, "Offline sale updated successfully", sale)
}

func (h *OfflineSaleHandler) DeleteOfflineSale(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.Delete(id); err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to delete offline sale")
		return
	}
	response.OK(c, "Offline sale deleted successfully", nil)
}

func (h *OfflineSaleHandler) UpdateOfflineSalePaymentBreakdown(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		PaymentBreakdown []models.PaymentBreakdownEntry `json:"payment_breakdown"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Payment breakdown payload is invalid")
		return
	}

	if err := h.service.UpdatePaymentBreakdown(id, req.PaymentBreakdown); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Offline sale payment breakdown updated", nil)
}

func buildOfflineSaleModel(req offlineSaleRequest) (models.OfflineSale, error) {
	saleDate, err := time.Parse("2006-01-02", req.SaleDate)
	if err != nil {
		return models.OfflineSale{}, err
	}

	var customerPartyID *uuid.UUID
	if req.CustomerPartyID != "" {
		parsedPartyID, parseErr := uuid.Parse(req.CustomerPartyID)
		if parseErr != nil {
			return models.OfflineSale{}, parseErr
		}
		customerPartyID = &parsedPartyID
	}

	items := make([]models.OfflineSaleItem, 0, len(req.Items))
	for _, item := range req.Items {
		productID, parseErr := uuid.Parse(item.ProductID)
		if parseErr != nil {
			return models.OfflineSale{}, parseErr
		}
		items = append(items, models.OfflineSaleItem{
			ProductID:     productID,
			ProductName:   item.ProductName,
			Quantity:      item.Quantity,
			SellPrice:     item.SellPrice,
			DiscountValue: item.DiscountValue,
			LineTotal:     item.LineTotal,
		})
	}

	return models.OfflineSale{
		BillNumber:       req.BillNumber,
		SaleDate:         saleDate,
		CustomerPartyID:  customerPartyID,
		CustomerName:     req.CustomerName,
		CustomerPhone:    req.CustomerPhone,
		ShopName:         req.ShopName,
		PaymentMode:      req.PaymentMode,
		Notes:            req.Notes,
		AmountReceived:   req.AmountReceived,
		PaymentBreakdown: req.PaymentBreakdown,
		Items:            items,
	}, nil
}
