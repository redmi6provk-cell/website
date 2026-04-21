import { create } from "zustand";
import Cookies from "js-cookie";
import { CartItem, Product, User } from "@/types";
import { useCartStore } from "@/store/cartStore";
import api from "@/lib/api";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => void;
  checkAuth: () => void;
}

type ServerCartItem = {
  product: Product;
  quantity: number;
};

function normalizeCartItems(items: CartItem[]) {
  return items
    .filter((item) => item?.product?.id && item.quantity > 0)
    .map((item) => ({
      product: item.product,
      quantity: Math.max(0, Math.min(item.quantity, Math.max(0, item.product.stock))),
    }))
    .filter((item) => item.quantity > 0);
}

function getSyncableItems(items: CartItem[]) {
  return items
    .filter((item) => item?.product?.id && uuidPattern.test(item.product.id) && Number(item.quantity) > 0)
    .map((item) => ({
      product_id: item.product.id,
      quantity: Math.max(1, Math.floor(Number(item.quantity))),
    }));
}

async function syncCartAfterAuth(userId: string) {
  const cartStore = useCartStore.getState();
  const guestItems = normalizeCartItems(cartStore.getOwnerItems(null));
  let serverItems: CartItem[] = [];
  try {
    const response = await api.get("/cart");
    const serverCart = Array.isArray(response.data?.data) ? (response.data.data as ServerCartItem[]) : [];
    serverItems = normalizeCartItems(
      serverCart
        .filter((item) => item?.product?.id)
        .map((item) => ({
          product: item.product,
          quantity: item.quantity,
        }))
    );
  } catch (error) {
    console.error("Failed to fetch server cart after auth", error);
  }

  const mergedByProduct = new Map<string, CartItem>();

  for (const item of [...serverItems, ...guestItems]) {
    const existing = mergedByProduct.get(item.product.id);
    const nextQuantity = Math.max(0, Math.min(item.product.stock, (existing?.quantity || 0) + item.quantity));
    if (nextQuantity <= 0) {
      mergedByProduct.delete(item.product.id);
      continue;
    }

    mergedByProduct.set(item.product.id, {
      product: item.product,
      quantity: nextQuantity,
    });
  }

  const mergedItems = Array.from(mergedByProduct.values());
  cartStore.setOwnerItems(userId, mergedItems);
  cartStore.clearOwnerItems(null);
  cartStore.setCartOwner(userId);

  if (guestItems.length === 0) {
    return;
  }

  try {
    const syncableItems = getSyncableItems(mergedItems);
    await api.post("/cart/sync", {
      items: syncableItems,
    });
  } catch (error) {
    console.error("Failed to sync merged cart after auth", error);
  }
}

function getCookieDomain() {
  if (typeof window === "undefined") return undefined;
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;
  const segments = hostname.split(".").filter(Boolean);
  if (segments.length < 2) return undefined;
  return `.${segments.slice(-2).join(".")}`;
}

function persistToken(token: string) {
  const domain = getCookieDomain();
  Cookies.set("token", token, {
    expires: 7,
    sameSite: "lax",
    secure: typeof window !== "undefined" ? window.location.protocol === "https:" : false,
    domain,
  });
  localStorage.setItem("token", token);
}

function clearPersistedAuth() {
  const domain = getCookieDomain();
  Cookies.remove("token");
  if (domain) {
    Cookies.remove("token", { domain });
  }
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,

  setAuth: async (user, token) => {
    persistToken(token);
    localStorage.setItem("user", JSON.stringify(user));
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("admin-panel-unlocked");
    }
    set({ user, token, isAuthenticated: true, isInitialized: true });
    await syncCartAfterAuth(user.id);
  },

  updateUser: (user) => {
    localStorage.setItem("user", JSON.stringify(user));
    set((state) => ({ user, token: state.token, isAuthenticated: state.isAuthenticated, isInitialized: true }));
  },

  logout: () => {
    clearPersistedAuth();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("admin-panel-unlocked");
    }
    useCartStore.getState().setCartOwner(null);
    set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
  },

  checkAuth: () => {
    const token = Cookies.get("token") || localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    const { isAuthenticated, user: currentUser } = useAuthStore.getState();
    
    if (token && userStr && userStr !== "undefined") {
      try {
        const parsedUser = JSON.parse(userStr);
        // Only update if not already authenticated or if user data is missing/different
        if (!isAuthenticated || !currentUser || currentUser.id !== parsedUser.id) {
          useCartStore.getState().setCartOwner(parsedUser.id);
          set({
            user: parsedUser,
            token,
            isAuthenticated: true,
            isInitialized: true,
          });
          void syncCartAfterAuth(parsedUser.id);
        } else {
          // If already authenticated and user data matches, just set initialized
          useCartStore.getState().setCartOwner(parsedUser.id);
          set({ isInitialized: true });
          void syncCartAfterAuth(parsedUser.id);
        }
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        clearPersistedAuth();
        useCartStore.getState().setCartOwner(null);
        set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
      }
    } else {
      // If no token or user in localStorage, ensure state is cleared and initialized
      useCartStore.getState().setCartOwner(null);
      set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
    }
  },
}));
