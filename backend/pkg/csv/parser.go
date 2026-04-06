package csv

import (
	"encoding/csv"
	"fmt"
	"mime/multipart"
	"strconv"

	"backend/internal/models"
)

func ParseProductCSV(file multipart.File) ([]models.Product, []string) {
	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	var products []models.Product
	var errors []string

	if err != nil {
		return nil, []string{"Failed to parse CSV file"}
	}

	if len(records) < 2 {
		return nil, []string{"CSV file is empty or missing headers"}
	}

	for i, row := range records[1:] { // skip header
		if len(row) < 8 {
			errors = append(errors, fmt.Sprintf("row %d: missing columns", i+2))
			continue
		}

		price, err := strconv.ParseFloat(row[1], 64)
		if err != nil {
			errors = append(errors, fmt.Sprintf("row %d: invalid price", i+2))
			continue
		}

		stock, err := strconv.Atoi(row[2])
		if err != nil {
			errors = append(errors, fmt.Sprintf("row %d: invalid stock", i+2))
			continue
		}

		discount, _ := strconv.ParseFloat(row[6], 64)

		products = append(products, models.Product{
			Name:        row[0],
			Price:       price,
			Stock:       stock,
			CategoryName: row[3],
			BrandName:    row[4],
			Unit:        row[5],
			Discount:    discount,
			Description: row[7],
		})
	}
	return products, errors
}
