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

type PurchaseHandler struct {
	service *services.PurchaseService
}

type purchaseItemRequest struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	BuyPrice    float64 `json:"buy_price"`
	LineTotal   float64 `json:"line_total"`
}

type purchaseRequest struct {
	Date          string                `json:"date"`
	InvoiceNumber string                `json:"invoice_number"`
	SupplierPartyID string              `json:"supplier_party_id"`
	SupplierName  string                `json:"supplier_name"`
	PaymentStatus string                `json:"payment_status"`
	PaymentMethod string                `json:"payment_method"`
	Notes         string                `json:"notes"`
	Items         []purchaseItemRequest `json:"items"`
}

func NewPurchaseHandler(service *services.PurchaseService) *PurchaseHandler {
	return &PurchaseHandler{service: service}
}

func (h *PurchaseHandler) GetPurchases(c *gin.Context) {
	purchases, err := h.service.GetAll()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to fetch purchases")
		return
	}
	response.OK(c, "Purchases fetched successfully", purchases)
}

func (h *PurchaseHandler) CreatePurchase(c *gin.Context) {
	var req purchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "invalid authenticated user")
		return
	}
	purchase, err := buildPurchaseModel(req)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	purchase.CreatedBy = userID

	if err := h.service.Create(&purchase); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Created(c, "Purchase created successfully", purchase)
}

func (h *PurchaseHandler) UpdatePurchase(c *gin.Context) {
	id := c.Param("id")
	var req purchaseRequest
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
		response.Fail(c, http.StatusBadRequest, "Invalid purchase id")
		return
	}
	purchase, err := buildPurchaseModel(req)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	purchase.ID = parsedID
	purchase.CreatedBy = userID

	if err := h.service.Update(&purchase); err != nil {
		if h.service.IsStockConflict(err) {
			response.Fail(c, http.StatusConflict, "Purchase update se stock negative ho raha hai.")
			return
		}
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Purchase updated successfully", purchase)
}

func (h *PurchaseHandler) DeletePurchase(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.Delete(id); err != nil {
		if h.service.IsStockConflict(err) {
			response.Fail(c, http.StatusConflict, "Purchase delete se stock negative ho raha hai.")
			return
		}
		response.Fail(c, http.StatusInternalServerError, "Failed to delete purchase")
		return
	}
	response.OK(c, "Purchase deleted successfully", nil)
}

func buildPurchaseModel(req purchaseRequest) (models.Purchase, error) {
	purchaseDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return models.Purchase{}, err
	}

	items := make([]models.PurchaseItem, 0, len(req.Items))
	for _, item := range req.Items {
		productID, parseErr := uuid.Parse(item.ProductID)
		if parseErr != nil {
			return models.Purchase{}, parseErr
		}
		items = append(items, models.PurchaseItem{
			ProductID:   productID,
			ProductName: item.ProductName,
			Quantity:    item.Quantity,
			BuyPrice:    item.BuyPrice,
			LineTotal:   item.LineTotal,
		})
	}

	var supplierPartyID *uuid.UUID
	if req.SupplierPartyID != "" {
		parsedSupplierID, parseErr := uuid.Parse(req.SupplierPartyID)
		if parseErr != nil {
			return models.Purchase{}, parseErr
		}
		supplierPartyID = &parsedSupplierID
	}

	return models.Purchase{
		Date:          purchaseDate,
		InvoiceNumber: req.InvoiceNumber,
		SupplierPartyID: supplierPartyID,
		SupplierName:  req.SupplierName,
		PaymentStatus: req.PaymentStatus,
		PaymentMethod: req.PaymentMethod,
		Notes:         req.Notes,
		Items:         items,
	}, nil
}
