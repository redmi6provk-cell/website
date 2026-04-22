package models

type PaymentBreakdownEntry struct {
	Mode   string  `json:"mode"`
	Amount float64 `json:"amount"`
}
