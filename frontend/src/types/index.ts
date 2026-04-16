export interface User {
  id: string;
  name: string;
  shop_name: string;
  phone: string;
  address_line?: string;
  pincode?: string;
  city?: string;
  state?: string;
  role: "USER" | "ACCOUNTANT" | "ADMIN" | "SUPERADMIN";
  created_at: string;
  last_login_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
}

export interface Brand {
  id: string;
  name: string;
  logo_url: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category_id: string;
  brand_id: string;
  category_info?: Category;
  brand_info?: Brand;
  price: number;
  discount: number;
  minimum_order_quantity?: number;
  quantity_discounts?: QuantityDiscount[];
  stock: number;
  unit: string;
  image_url: string;
  secondary_image_url?: string;
  is_active: boolean;
  can_delete?: boolean;
  created_at: string;
}

export interface QuantityDiscount {
  min_quantity: number;
  max_quantity?: number | null;
  discount_type: "PERCENT" | "FIXED";
  discount_value: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  user_id: string;
  user?: User;
  customer_name?: string;
  customer_phone?: string;
  shop_name?: string;
  invoice_number?: string;
  subtotal?: number;
  delivery_charge?: number;
  total: number;
  status: "pending" | "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
  delivery_type?: "delivery" | "pickup";
  payment_mode?: "cod" | "qr";
  payment_status?: string;
  address: string;
  notes?: string;
  items: OrderItem[];
  status_events?: OrderStatusEvent[];
  created_at: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product: Product;
  quantity: number;
  price: number;
}

export interface OrderStatusEvent {
  id: string;
  order_id: string;
  status: string;
  note?: string;
  changed_by?: string;
  changed_by_user?: User;
  created_at: string;
}

export interface Party {
  party_id: string;
  name: string;
  type: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
