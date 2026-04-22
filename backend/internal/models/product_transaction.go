package models

type ProductTransaction struct {
	Type           string  `json:"type"`
	ReferenceNo    string  `json:"reference_no"`
	Name           string  `json:"name"`
	Date           string  `json:"date"`
	Quantity       int     `json:"quantity"`
	PricePerUnit   float64 `json:"price_per_unit"`
	LineTotal      float64 `json:"line_total"`
	InvoiceTotal   float64 `json:"invoice_total"`
	ReceivedAmount float64 `json:"received_amount"`
	PaymentStatus  string  `json:"payment_status"`
	PaymentMode    string  `json:"payment_mode"`
	SourceModule   string  `json:"source_module"`
	SourceID       string  `json:"source_id"`
}
