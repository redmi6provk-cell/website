package repository

import (
	"backend/internal/models"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrProductHasOrders = errors.New("product is linked to existing orders and cannot be deleted")

type ProductRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) *ProductRepository {
	return &ProductRepository{db: db}
}

func (r *ProductRepository) GetAll(category, brand, sort string, minPrice, maxPrice float64, offset, limit int, includeInactive bool) ([]models.Product, int64, error) {
	var products []models.Product
	var total int64

	query := r.db.Model(&models.Product{}).Preload("Category").Preload("Brand")
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	if category != "" {
		query = query.Where("category_id = ?", category)
	}
	if brand != "" {
		query = query.Where("brand_id = ?", brand)
	}
	if minPrice > 0 {
		query = query.Where("price >= ?", minPrice)
	}
	if maxPrice > 0 {
		query = query.Where("price <= ?", maxPrice)
	}

	query.Count(&total)

	switch sort {
	case "price_asc":
		query = query.Order("price asc")
	case "price_desc":
		query = query.Order("price desc")
	case "newest":
		query = query.Order("created_at desc")
	}

	if limit > 0 {
		query = query.Offset(offset).Limit(limit)
	}

	err := query.Find(&products).Error
	if err != nil {
		return nil, 0, err
	}

	if includeInactive {
		if err := r.attachDeleteAvailability(products); err != nil {
			return nil, 0, err
		}
	}

	return products, total, err
}

func (r *ProductRepository) GetByID(id string, includeInactive bool) (*models.Product, error) {
	var product models.Product
	query := r.db.Preload("Category").Preload("Brand").Where("id = ?", id)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}
	if err := query.First(&product).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *ProductRepository) Create(product *models.Product) error {
	return r.db.Create(product).Error
}

func (r *ProductRepository) Update(product *models.Product) error {
	return r.db.Save(product).Error
}

func (r *ProductRepository) Delete(id string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var orderItemCount int64
		if err := tx.Model(&models.OrderItem{}).Where("product_id = ?", id).Count(&orderItemCount).Error; err != nil {
			return err
		}
		if orderItemCount > 0 {
			return ErrProductHasOrders
		}

		if err := tx.Where("product_id = ?", id).Delete(&models.Cart{}).Error; err != nil {
			return err
		}

		return tx.Where("id = ?", id).Delete(&models.Product{}).Error
	})
}

func (r *ProductRepository) SetActive(id string, isActive bool) error {
	return r.db.Model(&models.Product{}).Where("id = ?", id).Update("is_active", isActive).Error
}

func (r *ProductRepository) UpdateStock(id string, stock int) error {
	return r.db.Model(&models.Product{}).Where("id = ?", id).Update("stock", stock).Error
}

func (r *ProductRepository) ReduceStock(id string, quantity int) error {
	result := r.db.Model(&models.Product{}).
		Where("id = ? AND stock >= ?", id, quantity).
		Update("stock", gorm.Expr("stock - ?", quantity))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *ProductRepository) GetTransactions(productID string) ([]models.ProductTransaction, error) {
	transactions := make([]models.ProductTransaction, 0)

	query := `
		SELECT *
		FROM (
			SELECT
				'Sale' AS type,
				COALESCE(NULLIF(TRIM(o.invoice_number), ''), o.id::text) AS reference_no,
				COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(o.shop_name), ''), NULLIF(TRIM(u.name), ''), 'Online Customer') AS name,
				TO_CHAR(o.created_at::date, 'DD/MM/YYYY') AS date,
				oi.quantity AS quantity,
				oi.price AS price_per_unit,
				oi.price * oi.quantity AS line_total,
				o.total AS invoice_total,
				COALESCE(o.received_amount, 0) AS received_amount,
				CASE
					WHEN COALESCE(o.received_amount, 0) >= COALESCE(o.total, 0) AND COALESCE(o.total, 0) > 0 THEN 'paid'
					WHEN COALESCE(o.received_amount, 0) > 0 THEN 'partial'
					ELSE 'unpaid'
				END AS payment_status,
				COALESCE(NULLIF(TRIM(o.payment_collection_method), ''), NULLIF(TRIM(o.payment_mode), ''), 'cash') AS payment_mode,
				'order' AS source_module,
				o.id::text AS source_id,
				o.created_at AS sort_date
			FROM order_items oi
			INNER JOIN orders o ON o.id = oi.order_id
			LEFT JOIN users u ON u.id = o.user_id
			WHERE oi.product_id = ?

			UNION ALL

			SELECT
				'Sale' AS type,
				COALESCE(NULLIF(TRIM(os.bill_number), ''), os.id::text) AS reference_no,
				COALESCE(NULLIF(TRIM(os.customer_name), ''), NULLIF(TRIM(os.shop_name), ''), 'Walk-in Customer') AS name,
				TO_CHAR(os.sale_date, 'DD/MM/YYYY') AS date,
				osi.quantity AS quantity,
				osi.sell_price AS price_per_unit,
				osi.line_total AS line_total,
				os.final_total AS invoice_total,
				COALESCE(os.amount_received, 0) AS received_amount,
				CASE
					WHEN LOWER(COALESCE(os.status, '')) = 'paid' THEN 'paid'
					WHEN LOWER(COALESCE(os.status, '')) = 'partial' THEN 'partial'
					WHEN LOWER(COALESCE(os.status, '')) = 'due' THEN 'unpaid'
					ELSE COALESCE(NULLIF(TRIM(os.status), ''), 'pending')
				END AS payment_status,
				COALESCE(NULLIF(TRIM(os.payment_mode), ''), 'cash') AS payment_mode,
				'offline_sale' AS source_module,
				os.id::text AS source_id,
				os.sale_date AS sort_date
			FROM offline_sale_items osi
			INNER JOIN offline_sales os ON os.id = osi.offline_sale_id
			WHERE osi.product_id = ?

			UNION ALL

			SELECT
				'Purchase' AS type,
				COALESCE(NULLIF(TRIM(p.invoice_number), ''), p.id::text) AS reference_no,
				COALESCE(NULLIF(TRIM(p.supplier_name), ''), 'Supplier') AS name,
				TO_CHAR(p.date, 'DD/MM/YYYY') AS date,
				pi.quantity AS quantity,
				pi.buy_price AS price_per_unit,
				pi.line_total AS line_total,
				p.total_amount AS invoice_total,
				CASE
					WHEN LOWER(COALESCE(TRIM(p.payment_status), '')) = 'paid' THEN p.total_amount
					ELSE 0
				END AS received_amount,
				COALESCE(NULLIF(TRIM(p.payment_status), ''), 'pending') AS payment_status,
				COALESCE(NULLIF(TRIM(p.payment_method), ''), 'cash') AS payment_mode,
				'purchase' AS source_module,
				p.id::text AS source_id,
				p.date AS sort_date
			FROM purchase_items pi
			INNER JOIN purchases p ON p.id = pi.purchase_id
			WHERE pi.product_id = ?
		) AS product_transactions
		ORDER BY sort_date DESC, reference_no DESC
	`

	if err := r.db.Raw(query, productID, productID, productID).Scan(&transactions).Error; err != nil {
		return nil, err
	}

	return transactions, nil
}

func (r *ProductRepository) BulkUpsert(products []models.Product) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "name"}},
		DoUpdates: clause.AssignmentColumns([]string{"price", "stock", "category_id", "brand_id", "unit", "discount", "description", "minimum_order_quantity", "quantity_discounts", "image_url", "secondary_image_url", "is_active"}),
	}).Create(&products).Error
}

func (r *ProductRepository) attachDeleteAvailability(products []models.Product) error {
	if len(products) == 0 {
		return nil
	}

	productIDs := make([]uuid.UUID, 0, len(products))
	for _, product := range products {
		productIDs = append(productIDs, product.ID)
	}

	type orderLinkCount struct {
		ProductID uuid.UUID
		Count     int64
	}

	var linked []orderLinkCount
	if err := r.db.Model(&models.OrderItem{}).
		Select("product_id, COUNT(*) as count").
		Where("product_id IN ?", productIDs).
		Group("product_id").
		Scan(&linked).Error; err != nil {
		return err
	}

	linkedMap := make(map[uuid.UUID]int64, len(linked))
	for _, item := range linked {
		linkedMap[item.ProductID] = item.Count
	}

	for i := range products {
		products[i].CanDelete = linkedMap[products[i].ID] == 0
	}

	return nil
}
