import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem, Product } from "@/types";
import { getCartPricing } from "@/lib/pricing";

const GUEST_CART_KEY = "guest";

function clampQuantityToStock(product: Product, quantity: number) {
  return Math.max(0, Math.min(quantity, Math.max(0, product.stock)));
}

interface CartState {
  items: CartItem[];
  cartsByOwner: Record<string, CartItem[]>;
  activeCartOwner: string;
  cartNotice: {
    message: string;
    productName: string;
    productImage?: string;
    addedQuantity: number;
    totalQuantity: number;
  } | null;
  setCartOwner: (ownerId: string | null) => void;
  addItem: (product: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clearCartNotice: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getOwnerItems: (ownerId: string | null) => CartItem[];
  setOwnerItems: (ownerId: string | null, items: CartItem[]) => void;
  clearOwnerItems: (ownerId: string | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartsByOwner: {},
      activeCartOwner: GUEST_CART_KEY,
      cartNotice: null,

      setCartOwner: (ownerId) => {
        const nextOwner = ownerId || GUEST_CART_KEY;
        const ownerItems = get().cartsByOwner[nextOwner] || [];

        set({
          activeCartOwner: nextOwner,
          items: ownerItems,
        });
      },

      addItem: (product, quantity) => {
        const items = get().items;
        const existingItem = items.find((item) => item.product.id === product.id);
        const currentQuantity = existingItem?.quantity || 0;
        const nextQuantity = clampQuantityToStock(product, currentQuantity + quantity);
        if (nextQuantity <= 0) {
          return;
        }
        const nextItems = existingItem
          ? items.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: nextQuantity }
                : item
            )
          : [...items, { product, quantity: clampQuantityToStock(product, quantity) }];

        set((state) => ({
          items: nextItems,
          cartNotice:
            nextQuantity > currentQuantity
              ? {
                  message: `${product.name} added to cart`,
                  productName: product.name,
                  productImage: product.image_url,
                  addedQuantity: quantity,
                  totalQuantity: nextQuantity,
                }
              : {
                  message: `${product.name} updated in cart`,
                  productName: product.name,
                  productImage: product.image_url,
                  addedQuantity: quantity,
                  totalQuantity: nextQuantity,
                },
          cartsByOwner: {
            ...state.cartsByOwner,
            [state.activeCartOwner]: nextItems,
          },
        }));
      },

      removeItem: (productId) => {
        const nextItems = get().items.filter((item) => item.product.id !== productId);

        set((state) => ({
          items: nextItems,
          cartsByOwner: {
            ...state.cartsByOwner,
            [state.activeCartOwner]: nextItems,
          },
        }));
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        const nextItems = get().items.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: clampQuantityToStock(item.product, quantity) }
            : item
        );

        set((state) => ({
          items: nextItems,
          cartsByOwner: {
            ...state.cartsByOwner,
            [state.activeCartOwner]: nextItems,
          },
        }));
      },

      clearCart: () =>
        set((state) => ({
          items: [],
          cartNotice: null,
          cartsByOwner: {
            ...state.cartsByOwner,
            [state.activeCartOwner]: [],
          },
        })),

      clearCartNotice: () => set({ cartNotice: null }),

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return getCartPricing(get().items).subtotal;
      },

      getOwnerItems: (ownerId) => {
        const key = ownerId || GUEST_CART_KEY;
        return get().cartsByOwner[key] || [];
      },

      setOwnerItems: (ownerId, items) => {
        const key = ownerId || GUEST_CART_KEY;
        set((state) => ({
          items: state.activeCartOwner === key ? items : state.items,
          cartsByOwner: {
            ...state.cartsByOwner,
            [key]: items,
          },
        }));
      },

      clearOwnerItems: (ownerId) => {
        const key = ownerId || GUEST_CART_KEY;
        set((state) => ({
          items: state.activeCartOwner === key ? [] : state.items,
          cartsByOwner: {
            ...state.cartsByOwner,
            [key]: [],
          },
        }));
      },
    }),
    {
      name: "cart-storage",
    }
  )
);
