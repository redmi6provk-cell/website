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

type updateInvoiceRequest struct {
	InvoiceNo   string  `json:"invoice_no"`
	InvoiceDate string  `json:"invoice_date"`
	DueDate     string  `json:"due_date"`
	TotalAmount float64 `json:"total_amount"`
}

type updatePaymentRequest struct {
	PaymentDate string  `json:"payment_date"`
	Amount      float64 `json:"amount"`
	PaymentMode string  `json:"payment_mode"`
	Remarks     string  `json:"remarks"`
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

func (h *ARPHandler) UpdateInvoice(c *gin.Context) {
	invoiceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid invoice id")
		return
	}

	var req updateInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	invoiceDate, err := time.Parse(time.RFC3339, strings.TrimSpace(req.InvoiceDate))
	if err != nil {
		if parsedDate, parseErr := time.Parse("2006-01-02", strings.TrimSpace(req.InvoiceDate)); parseErr == nil {
			invoiceDate = parsedDate
		} else {
			response.Fail(c, http.StatusBadRequest, "invalid invoice date")
			return
		}
	}

	dueDate, err := time.Parse(time.RFC3339, strings.TrimSpace(req.DueDate))
	if err != nil {
		if parsedDate, parseErr := time.Parse("2006-01-02", strings.TrimSpace(req.DueDate)); parseErr == nil {
			dueDate = parsedDate
		} else {
			response.Fail(c, http.StatusBadRequest, "invalid due date")
			return
		}
	}

	existing, err := h.service.GetInvoice(invoiceID.String())
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	existing.InvoiceNo = strings.TrimSpace(req.InvoiceNo)
	existing.InvoiceDate = invoiceDate
	existing.DueDate = dueDate
	existing.TotalAmount = req.TotalAmount

	if err := h.service.UpdateInvoice(existing); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Invoice updated successfully", existing)
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

func (h *ARPHandler) UpdatePayment(c *gin.Context) {
	paymentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "invalid payment id")
		return
	}

	var req updatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	paymentDate, err := time.Parse(time.RFC3339, strings.TrimSpace(req.PaymentDate))
	if err != nil {
		if parsedDate, parseErr := time.Parse("2006-01-02", strings.TrimSpace(req.PaymentDate)); parseErr == nil {
			paymentDate = parsedDate
		} else {
			response.Fail(c, http.StatusBadRequest, "invalid payment date")
			return
		}
	}

	existing, err := h.service.GetPayment(paymentID.String())
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	existing.PaymentDate = paymentDate
	existing.Amount = req.Amount
	existing.PaymentMode = strings.TrimSpace(req.PaymentMode)
	existing.Remarks = strings.TrimSpace(req.Remarks)

	if err := h.service.UpdatePayment(existing); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	response.OK(c, "Payment updated successfully", existing)
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

func (h *ARPHandler) UpdateManualTransaction(c *gin.Context) {
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

	entry, err := h.service.UpdateManualTransaction(
		c.Param("id"),
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

	response.OK(c, "Manual transaction updated successfully", entry)
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
