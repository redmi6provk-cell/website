package handlers

import (
	"net/http"
	"strings"
	"time"

	"backend/internal/models"
	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ARPHandler struct {
	service *services.ARPService
}

type manualFinanceTransactionRequest struct {
	Direction       string  `json:"direction"`
	PaymentMode     string  `json:"payment_mode"`
	Amount          float64 `json:"amount"`
	TransactionDate string  `json:"transaction_date"`
	ReferenceID     string  `json:"reference_id"`
	ReferenceLabel  string  `json:"reference_label"`
	PartyID         string  `json:"party_id"`
	PartyName       string  `json:"party_name"`
	PartyType       string  `json:"party_type"`
	Remarks         string  `json:"remarks"`
}

func NewARPHandler(service *services.ARPService) *ARPHandler {
	return &ARPHandler{service: service}
}

// Parties
func (h *ARPHandler) GetParties(c *gin.Context) {
	parties, err := h.service.GetParties()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, "Parties fetched successfully", parties)
}

func (h *ARPHandler) CreateParty(c *gin.Context) {
	var party models.Party
	if err := c.ShouldBindJSON(&party); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.CreateParty(&party); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, "Party created successfully", party)
}

func (h *ARPHandler) UpdateParty(c *gin.Context) {
	id := c.Param("id")
	partyID, err := uuid.Parse(id)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid party id")
		return
	}

	var party models.Party
	if err := c.ShouldBindJSON(&party); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	party.PartyID = partyID

	if err := h.service.UpdateParty(&party); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, "Party updated successfully", nil)
}

func (h *ARPHandler) DeleteParty(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteParty(id); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, "Party deleted successfully", nil)
}

// Invoices
func (h *ARPHandler) CreateInvoice(c *gin.Context) {
	var invoice models.Invoice
	if err := c.ShouldBindJSON(&invoice); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "invalid authenticated user")
		return
	}

	invoice.CreatedBy = userID

	if err := h.service.CreateInvoice(&invoice); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, "Invoice created successfully", invoice)
}

// Payments
func (h *ARPHandler) RecordPayment(c *gin.Context) {
	var payment models.Payment
	if err := c.ShouldBindJSON(&payment); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, "invalid authenticated user")
		return
	}

	payment.ProcessedBy = userID

	if err := h.service.RecordPayment(&payment); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, "Payment recorded successfully", payment)
}

// Ledger & Summary
func (h *ARPHandler) GetLedger(c *gin.Context) {
	ledger, err := h.service.GetLedger()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, "Ledger fetched successfully", ledger)
}

func (h *ARPHandler) GetSummary(c *gin.Context) {
	summary, err := h.service.GetSummary()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, "Summary fetched successfully", summary)
}

func (h *ARPHandler) GetDetailedLedger(c *gin.Context) {
	partyID := c.Param("id")
	ledger, err := h.service.GetDetailedLedger(partyID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, "Detailed ledger fetched successfully", ledger)
}

func (h *ARPHandler) GetPaymentModeTransactions(c *gin.Context) {
	paymentMode := c.Query("mode")
	transactions, err := h.service.GetPaymentModeTransactions(paymentMode)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, "Payment mode transactions fetched successfully", transactions)
}

func (h *ARPHandler) RecordManualTransaction(c *gin.Context) {
	var req manualFinanceTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	transactionDate, err := time.Parse(time.RFC3339, strings.TrimSpace(req.TransactionDate))
	if err != nil {
		if parsedDate, parseErr := time.Parse("2006-01-02", strings.TrimSpace(req.TransactionDate)); parseErr == nil {
			transactionDate = parsedDate
		} else {
			response.Fail(c, http.StatusBadRequest, "invalid transaction date")
			return
		}
	}

	entry, err := h.service.RecordManualTransaction(
		req.Direction,
		req.PaymentMode,
		req.ReferenceID,
		req.ReferenceLabel,
		req.PartyID,
		req.PartyName,
		req.PartyType,
		req.Remarks,
		req.Amount,
		transactionDate,
	)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.Created(c, "Manual transaction recorded successfully", entry)
}

func getAuthenticatedUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, false
	}

	parsedUserID, ok := userID.(uuid.UUID)
	if !ok || parsedUserID == uuid.Nil {
		return uuid.Nil, false
	}

	return parsedUserID, true
}
