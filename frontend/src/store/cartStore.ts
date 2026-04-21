import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem, Product } from "@/types";
import { getCartPricing } from "@/lib/pricing";
import api from "@/lib/api";

const GUEST_CART_KEY = "guest";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clampQuantityToStock(product: Product, quantity: number) {
  return Math.max(0, Math.min(quantity, Math.max(0, product.stock)));
}

function getSyncableItems(items: CartItem[]) {
  return items
    .filter((item) => item?.product?.id && uuidPattern.test(item.product.id) && Number(item.quantity) > 0)
    .map((item) => ({
      product_id: item.product.id,
      quantity: Math.max(1, Math.floor(Number(item.quantity))),
    }));
}

async function syncServerCart(ownerId: string, items: CartItem[]) {
  if (!ownerId || ownerId === GUEST_CART_KEY) {
    return;
  }

  try {
    const syncableItems = getSyncableItems(items);
    await api.post("/cart/sync", {
      items: syncableItems,
    });
  } catch (error) {
    console.error("Failed to sync cart to server", error);
  }
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
        const ownerId = get().activeCartOwner;
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
        void syncServerCart(ownerId, nextItems);
      },

      removeItem: (productId) => {
        const nextItems = get().items.filter((item) => item.product.id !== productId);
        const ownerId = get().activeCartOwner;

        set((state) => ({
          items: nextItems,
          cartsByOwner: {
            ...state.cartsByOwner,
            [state.activeCartOwner]: nextItems,
          },
        }));
        void syncServerCart(ownerId, nextItems);
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
        const ownerId = get().activeCartOwner;

        set((state) => ({
          items: nextItems,
          cartsByOwner: {
            ...state.cartsByOwner,
            [state.activeCartOwner]: nextItems,
          },
        }));
        void syncServerCart(ownerId, nextItems);
      },

      clearCart: () => {
        const ownerId = get().activeCartOwner;

        set((state) => ({
          items: [],
          cartNotice: null,
          cartsByOwner: {
            ...state.cartsByOwner,
            [state.activeCartOwner]: [],
          },
        }));
        void syncServerCart(ownerId, []);
      },

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
