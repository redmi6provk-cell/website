package models

import (
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	DiscountTypePercent = "PERCENT"
	DiscountTypeFixed   = "FIXED"
)

type QuantityDiscount struct {
	MinQuantity   int     `json:"min_quantity"`
	MaxQuantity   *int    `json:"max_quantity,omitempty"`
	DiscountType  string  `json:"discount_type"`
	DiscountValue float64 `json:"discount_value"`
}

type ProductPricing struct {
	BaseUnitPrice   float64           `json:"base_unit_price"`
	FinalUnitPrice  float64           `json:"final_unit_price"`
	LineBaseTotal   float64           `json:"line_base_total"`
	LineFinalTotal  float64           `json:"line_final_total"`
	LineDiscount    float64           `json:"line_discount"`
	MeetsMinimum    bool              `json:"meets_minimum"`
	MissingQuantity int               `json:"missing_quantity"`
	AppliedDiscount *QuantityDiscount `json:"applied_discount,omitempty"`
	NextDiscount    *QuantityDiscount `json:"next_discount,omitempty"`
	LegacyDiscount  float64           `json:"legacy_discount"`
}

type Product struct {
	ID                   uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name                 string             `gorm:"unique;not null;type:varchar(200)" json:"name"`
	Description          string             `json:"description"`
	CategoryID           *uuid.UUID         `gorm:"type:uuid" json:"category_id"`
	Category             Category           `gorm:"foreignKey:CategoryID" json:"category_info"`
	CategoryName         string             `gorm:"-" json:"category"`
	BrandID              *uuid.UUID         `gorm:"type:uuid" json:"brand_id"`
	Brand                Brand              `gorm:"foreignKey:BrandID" json:"brand_info"`
	BrandName            string             `gorm:"-" json:"brand"`
	Price                float64            `json:"price"`
	Discount             float64            `json:"discount"`
	MinimumOrderQuantity int                `gorm:"default:1;not null" json:"minimum_order_quantity"`
	QuantityDiscounts    []QuantityDiscount `gorm:"type:jsonb;serializer:json" json:"quantity_discounts"`
	Stock                int                `json:"stock"`
	Unit                 string             `json:"unit"`
	ImageURL             string             `json:"image_url"`
	SecondaryImageURL    string             `json:"secondary_image_url"`
	IsActive             bool               `gorm:"default:true;not null" json:"is_active"`
	CanDelete            bool               `gorm:"-" json:"can_delete"`
	CreatedAt            time.Time          `json:"created_at"`
}

func (p *Product) BeforeSave(tx *gorm.DB) error {
	p.NormalizePricingRules()
	return nil
}

func (p *Product) NormalizePricingRules() {
	if p.MinimumOrderQuantity < 1 {
		p.MinimumOrderQuantity = 1
	}

	normalized := make([]QuantityDiscount, 0, len(p.QuantityDiscounts))
	for _, slab := range p.QuantityDiscounts {
		slab.DiscountType = strings.ToUpper(strings.TrimSpace(slab.DiscountType))
		if slab.MinQuantity < 1 {
			continue
		}
		if slab.MaxQuantity != nil && *slab.MaxQuantity < slab.MinQuantity {
			continue
		}
		if slab.DiscountValue < 0 {
			slab.DiscountValue = 0
		}
		normalized = append(normalized, slab)
	}

	sort.Slice(normalized, func(i, j int) bool {
		return normalized[i].MinQuantity < normalized[j].MinQuantity
	})

	p.QuantityDiscounts = normalized
}

func (p Product) ValidatePricingRules() error {
	if strings.TrimSpace(p.Name) == "" {
		return errors.New("product name is required")
	}
	if p.Price < 0 {
		return errors.New("base price cannot be negative")
	}
	if p.MinimumOrderQuantity < 1 {
		return errors.New("minimum order quantity must be at least 1")
	}

	for i, slab := range p.QuantityDiscounts {
		if slab.MinQuantity < 1 {
			return errors.New("discount slab minimum quantity must be at least 1")
		}
		if slab.MaxQuantity != nil && *slab.MaxQuantity < slab.MinQuantity {
			return errors.New("discount slab max quantity must be greater than or equal to min quantity")
		}
		if slab.DiscountType != DiscountTypePercent && slab.DiscountType != DiscountTypeFixed {
			return errors.New("discount slab type must be PERCENT or FIXED")
		}
		if slab.DiscountValue < 0 {
			return errors.New("discount slab value cannot be negative")
		}
		if slab.DiscountType == DiscountTypePercent && slab.DiscountValue > 100 {
			return errors.New("percentage discount cannot exceed 100")
		}
		if i == 0 {
			continue
		}

		prev := p.QuantityDiscounts[i-1]
		if prev.MaxQuantity == nil {
			return errors.New("open-ended discount slab must be the last slab")
		}
		if slab.MinQuantity <= *prev.MaxQuantity {
			return errors.New("discount slabs cannot overlap")
		}
	}

	return nil
}

func (p Product) PricingForQuantity(quantity int) ProductPricing {
	if quantity < 1 {
		quantity = 1
	}

	minQty := p.MinimumOrderQuantity
	if minQty < 1 {
		minQty = 1
	}

	var applied *QuantityDiscount
	var next *QuantityDiscount
	for i := range p.QuantityDiscounts {
		slab := p.QuantityDiscounts[i]
		if slab.AppliesTo(quantity) {
			copy := slab
			applied = &copy
			continue
		}
		if slab.MinQuantity > quantity {
			copy := slab
			next = &copy
			break
		}
	}

	legacyDiscount := math.Max(0, p.Discount)
	slabDiscount := 0.0
	if applied != nil {
		slabDiscount = applied.DiscountAmount(p.Price)
	}

	unitDiscount := math.Max(legacyDiscount, slabDiscount)
	finalUnitPrice := math.Max(0, p.Price-unitDiscount)
	lineBaseTotal := p.Price * float64(quantity)
	lineFinalTotal := finalUnitPrice * float64(quantity)
	missingQty := 0
	if quantity < minQty {
		missingQty = minQty - quantity
	}

	return ProductPricing{
		BaseUnitPrice:   p.Price,
		FinalUnitPrice:  finalUnitPrice,
		LineBaseTotal:   lineBaseTotal,
		LineFinalTotal:  lineFinalTotal,
		LineDiscount:    math.Max(0, lineBaseTotal-lineFinalTotal),
		MeetsMinimum:    quantity >= minQty,
		MissingQuantity: missingQty,
		AppliedDiscount: applied,
		NextDiscount:    next,
		LegacyDiscount:  legacyDiscount,
	}
}

func (d QuantityDiscount) AppliesTo(quantity int) bool {
	if quantity < d.MinQuantity {
		return false
	}
	if d.MaxQuantity != nil && quantity > *d.MaxQuantity {
		return false
	}
	return true
}

func (d QuantityDiscount) DiscountAmount(basePrice float64) float64 {
	switch d.DiscountType {
	case DiscountTypePercent:
		return (basePrice * d.DiscountValue) / 100
	case DiscountTypeFixed:
		return d.DiscountValue
	default:
		return 0
	}
}
