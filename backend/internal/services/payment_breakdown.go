package services

import (
	"backend/internal/models"
	"encoding/json"
	"strings"
)

func parsePaymentBreakdown(raw string) []models.PaymentBreakdownEntry {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	var entries []models.PaymentBreakdownEntry
	if err := json.Unmarshal([]byte(raw), &entries); err != nil {
		return nil
	}

	return normalizePaymentBreakdown(entries)
}

func serializePaymentBreakdown(entries []models.PaymentBreakdownEntry) string {
	if len(entries) == 0 {
		return "[]"
	}

	encoded, err := json.Marshal(entries)
	if err != nil {
		return "[]"
	}

	return string(encoded)
}

func normalizePaymentBreakdown(entries []models.PaymentBreakdownEntry) []models.PaymentBreakdownEntry {
	grouped := make(map[string]float64)
	order := make([]string, 0, len(entries))

	for _, entry := range entries {
		mode := strings.TrimSpace(entry.Mode)
		if mode == "" || entry.Amount <= 0 {
			continue
		}
		if _, seen := grouped[mode]; !seen {
			order = append(order, mode)
		}
		grouped[mode] += entry.Amount
	}

	normalized := make([]models.PaymentBreakdownEntry, 0, len(order))
	for _, mode := range order {
		normalized = append(normalized, models.PaymentBreakdownEntry{
			Mode:   mode,
			Amount: grouped[mode],
		})
	}

	return normalized
}

func totalPaymentBreakdown(entries []models.PaymentBreakdownEntry) float64 {
	total := 0.0
	for _, entry := range entries {
		total += entry.Amount
	}
	return total
}

func primaryPaymentMode(entries []models.PaymentBreakdownEntry, fallback string) string {
	if len(entries) == 0 {
		return fallback
	}
	if len(entries) == 1 {
		return entries[0].Mode
	}
	return "mixed"
}
