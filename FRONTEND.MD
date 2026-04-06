🖥️ Frontend — FMCG E-Commerce (Next.js App Router)

📦 Tech Stack
ToolPurposeNext.js latest (App Router)FrameworkTailwind CSSStylingZustandGlobal state (cart, auth)AxiosAPI callsReact Hook Form + ZodForm handling & validationnext/imageOptimized imagesjs-cookieJWT token storage

📁 Folder Structure
frontend/
├── app/
│   ├── layout.tsx                    # Root layout (Navbar + Footer)
│   ├── page.tsx                      # Home page
│   ├── products/
│   │   ├── page.tsx                  # Product listing + filters
│   │   └── [id]/
│   │       └── page.tsx              # Product detail
│   ├── cart/
│   │   └── page.tsx                  # Cart page
│   ├── checkout/
│   │   └── page.tsx                  # Checkout page
│   ├── auth/
│   │   ├── login/page.tsx            # Login (phone + OTP or password)
│   │   └── register/page.tsx         # Register
│   ├── dashboard/
│   │   ├── page.tsx                  # User dashboard
│   │   ├── orders/page.tsx           # Order history
│   │   └── profile/page.tsx          # Profile settings
│   └── admin/
│       ├── page.tsx                  # Admin dashboard
│       ├── products/page.tsx         # Manage products
│       ├── orders/page.tsx           # Manage orders
│       └── upload/page.tsx           # CSV bulk upload
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── home/
│   │   ├── Banner.tsx
│   │   ├── CategoryGrid.tsx
│   │   └── FeaturedProducts.tsx
│   ├── product/
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── FilterSidebar.tsx
│   │   └── ProductImageGallery.tsx
│   ├── cart/
│   │   ├── CartItem.tsx
│   │   └── CartSummary.tsx
│   ├── auth/
│   │   ├── PhoneInput.tsx
│   │   └── OtpInput.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Badge.tsx
│       └── Spinner.tsx
│
├── lib/
│   ├── api.ts                        # Axios instance with interceptors
│   ├── auth.ts                       # Token get/set/remove helpers
│   └── utils.ts                      # Price format, date format etc.
│
├── store/
│   ├── cartStore.ts                  # Zustand — cart state
│   └── authStore.ts                  # Zustand — user/auth state
│
├── hooks/
│   ├── useCart.ts
│   ├── useAuth.ts
│   └── useProducts.ts
│
├── types/
│   └── index.ts                      # TypeScript interfaces
│
└── public/
    └── images/                       # Static assets

🧭 Pages Breakdown
🏠 Home Page /

Hero banner (carousel)
Category icons grid (Grocery, Dairy, Beverages, etc.)
Featured / Deal of the day products
Brand spotlight section


🛍️ Product Listing /products
URL params supported:
/products?category=grocery&brand=tata&minPrice=10&maxPrice=500&page=1&limit=20
Filter Sidebar:

Category checkboxes
Brand checkboxes
Price range slider
Sort by: Price Low-High, High-Low, Newest

Product Card shows:

Image, Name, Brand
Price with discount badge (₹180 → ₹152)
Unit (1kg / 500ml / 1 piece)
Add to Cart button


📄 Product Detail /products/[id]

Image gallery
Name, Brand, Category
Price + Discount % badge
Stock indicator (In Stock / Low Stock / Out of Stock)
Unit info
Quantity selector + Add to Cart
Product description


🛒 Cart Page /cart

List of cart items with image, name, price, quantity
Increase / Decrease / Remove item
Subtotal per item
Cart total + discount summary
Proceed to Checkout button


💳 Checkout Page /checkout

Delivery address form (name, phone, address, pincode, city, state)
Order summary (items, subtotal, delivery fee, total)
Place Order button
(Optional) Razorpay / Stripe payment button


🔐 Auth Pages
Register /auth/register
Fields:
- Full Name
- Phone Number (10-digit Indian mobile)
- Password
- Confirm Password
Login /auth/login
Fields:
- Phone Number
- Password

⚠️ No email login. Users log in with phone number + password.


👤 User Dashboard /dashboard

Welcome message with name
Recent orders list → link to /dashboard/orders
Edit profile → /dashboard/profile

📦 Order History /dashboard/orders

Order ID, Date, Status badge, Total
Expand to see order items


🛠️ Admin Panel /admin
PageFeature/admin/productsAdd / Edit / Delete products/admin/ordersView all orders, change status/admin/uploadUpload CSV to bulk add/update products

🔄 State Management (Zustand)
Cart Store
ts// store/cartStore.ts
interface CartState {
  items: CartItem[]
  addItem: (product: Product, qty: number) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clearCart: () => void
  total: () => number
}
Auth Store
ts// store/authStore.ts
interface AuthState {
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  logout: () => void
  isAdmin: () => boolean
}

📡 API Client
ts// lib/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api

🧩 TypeScript Types
ts// types/index.ts

export interface User {
  id: string
  name: string
  phone: string        // Phone number, not email
  role: 'USER' | 'ADMIN'
}

export interface Product {
  id: string
  name: string
  description: string
  category: string
  brand: string
  price: number
  discount: number
  stock: number
  unit: string         // kg, litre, piece
  image_url: string
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Order {
  id: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  total: number
  created_at: string
  items: OrderItem[]
}

export interface OrderItem {
  product: Product
  quantity: number
  price: number
}

🌍 Environment Variables
env# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_RAZORPAY_KEY=rzp_test_xxxx   # optional

📱 Responsive Breakpoints (Tailwind)
ScreenLayoutMobile (< 640px)1 column, bottom navTablet (640–1024px)2 columns, sidebar hiddenDesktop (> 1024px)3–4 columns, sidebar visible

🔒 Protected Routes
ts// middleware.ts (Next.js)
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')
  const { pathname } = request.nextUrl

  const protectedRoutes = ['/cart', '/checkout', '/dashboard', '/admin']
  const adminRoutes = ['/admin']

  if (protectedRoutes.some(r => pathname.startsWith(r)) && !token) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  // Admin check handled server-side via API role validation
}

🚀 Run Locally
bashcd frontend
npm install
npm run dev       # http://localhost:3004
bash# Build for production
npm run build
npm start