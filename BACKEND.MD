⚙️ Backend — FMCG E-Commerce (Go + Gin)

## 📦 Tech Stack
 
| Tool | Purpose |
|---|---|
| Go 1.22 | Language |
| Gin | HTTP framework |
| PostgreSQL 18 | Primary database |
| GORM | ORM for DB queries |
| golang-jwt/jwt v5 | JWT auth |
| bcrypt | Password hashing |
| encoding/csv | CSV parsing |
| godotenv / viper | Env config |
| Redis *(optional)* | Caching |
| Zap *(optional)* | Structured logging |
 
--

📁 Folder Structure
backend/
├── cmd/
│   └── main.go                       # Entry point — starts server
│
├── config/
│   └── config.go                     # Load .env, DB connection
│
├── internal/
│   ├── models/                       # Data structs (GORM models)
│   │   ├── user.go
│   │   ├── product.go
│   │   ├── cart.go
│   │   └── order.go
│   │
│   ├── repository/                   # Raw DB queries
│   │   ├── user_repo.go
│   │   ├── product_repo.go
│   │   ├── cart_repo.go
│   │   └── order_repo.go
│   │
│   ├── services/                     # Business logic
│   │   ├── auth_service.go
│   │   ├── product_service.go
│   │   ├── cart_service.go
│   │   └── order_service.go
│   │
│   ├── handlers/                     # Gin controllers
│   │   ├── auth_handler.go
│   │   ├── product_handler.go
│   │   ├── cart_handler.go
│   │   └── order_handler.go
│   │
│   └── middleware/
│       ├── auth_middleware.go        # JWT validation
│       └── role_middleware.go        # Admin-only guard
│
├── pkg/
│   ├── jwt/
│   │   └── jwt.go                   # GenerateToken, ValidateToken
│   ├── csv/
│   │   └── parser.go                # CSV upload parser
│   ├── hash/
│   │   └── bcrypt.go                # Hash & compare passwords
│   └── response/
│       └── response.go              # Standard API response format
│
├── routes/
│   └── routes.go                    # All route registrations
│
├── .env
├── go.mod
├── go.sum
└── Dockerfile

🗄️ Database Schema

⚠️ No email column. Users register and login with phone number.

sql-- Users
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(15) UNIQUE NOT NULL,   -- Phone number login
    password    TEXT NOT NULL,                 -- bcrypt hashed
    role        VARCHAR(10) DEFAULT 'USER',    -- USER | ADMIN
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    brand       VARCHAR(100),
    price       NUMERIC(10, 2) NOT NULL,
    discount    NUMERIC(5, 2) DEFAULT 0,
    stock       INT DEFAULT 0,
    unit        VARCHAR(20),                   -- kg, litre, piece
    image_url   TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Carts
CREATE TABLE carts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity    INT DEFAULT 1,
    UNIQUE(user_id, product_id)
);

-- Orders
CREATE TABLE orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    total       NUMERIC(10, 2),
    status      VARCHAR(50) DEFAULT 'pending', -- pending | confirmed | shipped | delivered | cancelled
    address     TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id  UUID REFERENCES products(id),
    quantity    INT,
    price       NUMERIC(10, 2)
);

🧩 Models (Go Structs)
go// internal/models/user.go
type User struct {
    ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
    Name      string    `json:"name"`
    Phone     string    `gorm:"unique;not null" json:"phone"`  // phone, not email
    Password  string    `json:"-"`                             // never expose
    Role      string    `gorm:"default:USER" json:"role"`
    CreatedAt time.Time `json:"created_at"`
}
go// internal/models/product.go
type Product struct {
    ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    Category    string    `json:"category"`
    Brand       string    `json:"brand"`
    Price       float64   `json:"price"`
    Discount    float64   `json:"discount"`
    Stock       int       `json:"stock"`
    Unit        string    `json:"unit"`       // kg, litre, piece
    ImageURL    string    `json:"image_url"`
    CreatedAt   time.Time `json:"created_at"`
}
go// internal/models/cart.go
type Cart struct {
    ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
    UserID    uuid.UUID `json:"user_id"`
    ProductID uuid.UUID `json:"product_id"`
    Product   Product   `gorm:"foreignKey:ProductID" json:"product"`
    Quantity  int       `json:"quantity"`
}
go// internal/models/order.go
type Order struct {
    ID         uuid.UUID   `gorm:"type:uuid;primaryKey" json:"id"`
    UserID     uuid.UUID   `json:"user_id"`
    Total      float64     `json:"total"`
    Status     string      `json:"status"`
    Address    string      `json:"address"`
    Items      []OrderItem `gorm:"foreignKey:OrderID" json:"items"`
    CreatedAt  time.Time   `json:"created_at"`
}

type OrderItem struct {
    ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
    OrderID   uuid.UUID `json:"order_id"`
    ProductID uuid.UUID `json:"product_id"`
    Product   Product   `gorm:"foreignKey:ProductID" json:"product"`
    Quantity  int       `json:"quantity"`
    Price     float64   `json:"price"`
}

🔐 Authentication (Phone + Password)
Register Request
jsonPOST /auth/register
{
  "name": "ASHUTOSH",
  "phone": "9876543210",
  "password": "secret123"
}
Login Request
jsonPOST /auth/login
{
  "phone": "9876543210",
  "password": "secret123"
}
Login Response
json{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "role": "USER"
  }
}
auth_service.go
gofunc (s *AuthService) Register(name, phone, password string) (*models.User, error) {
    // Check if phone already exists
    existing, _ := s.repo.FindByPhone(phone)
    if existing != nil {
        return nil, errors.New("phone number already registered")
    }
    hashed, _ := bcrypt.GenerateFromPassword([]byte(password), 12)
    user := &models.User{Name: name, Phone: phone, Password: string(hashed)}
    return s.repo.Create(user)
}

func (s *AuthService) Login(phone, password string) (string, *models.User, error) {
    user, err := s.repo.FindByPhone(phone)
    if err != nil {
        return "", nil, errors.New("user not found")
    }
    if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
        return "", nil, errors.New("invalid password")
    }
    token, _ := jwt.GenerateToken(user.ID, user.Role)
    return token, user, nil
}

🛡️ Middleware
JWT Auth Middleware
go// internal/middleware/auth_middleware.go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.AbortWithStatusJSON(401, gin.H{"error": "missing token"})
            return
        }
        tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
        claims, err := jwt.ValidateToken(tokenStr)
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "invalid token"})
            return
        }
        c.Set("userID", claims.UserID)
        c.Set("role", claims.Role)
        c.Next()
    }
}
Admin Role Middleware
go// internal/middleware/role_middleware.go
func AdminOnly() gin.HandlerFunc {
    return func(c *gin.Context) {
        role := c.GetString("role")
        if role != "ADMIN" {
            c.AbortWithStatusJSON(403, gin.H{"error": "admin access required"})
            return
        }
        c.Next()
    }
}

🌐 API Routes
go// routes/routes.go
func SetupRoutes(r *gin.Engine) {
    api := r.Group("/api")

    // Public
    auth := api.Group("/auth")
    {
        auth.POST("/register", handlers.Register)
        auth.POST("/login", handlers.Login)
    }

    products := api.Group("/products")
    {
        products.GET("", handlers.GetProducts)          // list + filter
        products.GET("/:id", handlers.GetProductByID)
    }

    // Protected — logged in user
    protected := api.Group("")
    protected.Use(middleware.AuthMiddleware())
    {
        protected.GET("/cart", handlers.GetCart)
        protected.POST("/cart/add", handlers.AddToCart)
        protected.PUT("/cart/update", handlers.UpdateCart)
        protected.DELETE("/cart/remove/:id", handlers.RemoveFromCart)

        protected.POST("/orders", handlers.CreateOrder)
        protected.GET("/orders", handlers.GetMyOrders)

        protected.GET("/profile", handlers.GetProfile)
        protected.PUT("/profile", handlers.UpdateProfile)
    }

    // Admin only
    admin := api.Group("/admin")
    admin.Use(middleware.AuthMiddleware(), middleware.AdminOnly())
    {
        admin.POST("/products", handlers.CreateProduct)
        admin.PUT("/products/:id", handlers.UpdateProduct)
        admin.DELETE("/products/:id", handlers.DeleteProduct)
        admin.PUT("/products/:id/stock", handlers.UpdateStock)

        admin.GET("/orders", handlers.GetAllOrders)
        admin.PUT("/orders/:id/status", handlers.UpdateOrderStatus)

        admin.POST("/products/csv", handlers.BulkUploadCSV)
    }
}

📋 API Reference
Products — GET /api/products
Query params:
?category=grocery&brand=tata&minPrice=10&maxPrice=500&page=1&limit=20&sort=price_asc
Response:
json{
  "data": [ {...}, {...} ],
  "total": 120,
  "page": 1,
  "limit": 20
}

Cart — POST /api/cart/add
json{ "product_id": "uuid", "quantity": 2 }

Create Order — POST /api/orders
json{
  "address": "123, MG Road, Mumbai, Maharashtra, 400001"
}

Backend will pull cart items, calculate total, create order, then clear cart.


Update Order Status (Admin) — PUT /api/admin/orders/:id/status
json{ "status": "shipped" }

📤 CSV Bulk Upload
Endpoint: POST /api/admin/products/csv
Content-Type: multipart/form-data
Field name: file
CSV Format:
csvname,price,stock,category,brand,unit,discount,description
Tata Salt,20.00,500,Grocery,Tata,kg,0,Premium iodized salt
Fortune Oil,180.00,200,Edible Oil,Fortune,litre,5,Refined sunflower oil
Parser Logic:
go// pkg/csv/parser.go
func ParseProductCSV(file multipart.File) ([]models.Product, []string) {
    reader := csv.NewReader(file)
    records, _ := reader.ReadAll()
    var products []models.Product
    var errors []string

    for i, row := range records[1:] { // skip header
        price, err := strconv.ParseFloat(row[1], 64)
        if err != nil {
            errors = append(errors, fmt.Sprintf("row %d: invalid price", i+2))
            continue
        }
        // ... parse other fields
        products = append(products, models.Product{
            Name: row[0], Price: price, ...
        })
    }
    return products, errors
}
DB Upsert:
sqlINSERT INTO products (name, price, stock, category, brand, unit, discount)
VALUES (...)
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  stock = EXCLUDED.stock;

📬 Standard API Response Format
go// pkg/response/response.go
type APIResponse struct {
    Success bool        `json:"success"`
    Message string      `json:"message"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
}

func OK(c *gin.Context, msg string, data interface{}) {
    c.JSON(200, APIResponse{Success: true, Message: msg, Data: data})
}

func Fail(c *gin.Context, status int, err string) {
    c.JSON(status, APIResponse{Success: false, Error: err})
}

🔑 JWT Helpers
go// pkg/jwt/jwt.go
type Claims struct {
    UserID uuid.UUID `json:"user_id"`
    Role   string    `json:"role"`
    jwt.RegisteredClaims
}

func GenerateToken(userID uuid.UUID, role string) (string, error) {
    claims := Claims{
        UserID: userID,
        Role:   role,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

🌍 Environment Variables
env# .env
PORT=8080
DATABASE_URL=postgres://admin:secret@localhost:5432/fmcg_db
JWT_SECRET=your_super_secret_key_here
REDIS_URL=redis://localhost:6379       # optional

🐳 Dockerfile
dockerfileFROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd/main.go

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/server .
COPY .env .
EXPOSE 8080
CMD ["./server"]

🚀 Run Locally
bashcd backend
go mod tidy
go run cmd/main.go      # http://localhost:8080

📊 Order Status Flow
pending → confirmed → shipped → delivered
                              ↘ cancelled
Admin changes status via PUT /api/admin/orders/:id/status

✅ Security Checklist

 Passwords hashed with bcrypt (cost 12)
 JWT tokens expire in 7 days
 Phone number validated (10-digit) before save
 Admin routes double-guarded (Auth + Role middleware)
 SQL injection safe via GORM parameterized queries
 .env never committed to git
 Passwords never returned in JSON responses