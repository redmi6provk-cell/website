package handlers

import (
	"net/http"

	"backend/internal/services"
	"backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type InvoiceSequenceHandler struct {
	service *services.InvoiceSequenceService
}

func NewInvoiceSequenceHandler(service *services.InvoiceSequenceService) *InvoiceSequenceHandler {
	return &InvoiceSequenceHandler{service: service}
}

func (h *InvoiceSequenceHandler) GetNextSalesInvoiceNumber(c *gin.Context) {
	nextInvoiceNumber, err := h.service.PeekNextSalesInvoiceNumber()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "Failed to fetch next invoice number")
		return
	}

	response.OK(c, "Next invoice number fetched successfully", gin.H{
		"invoice_number": nextInvoiceNumber,
	})
}
