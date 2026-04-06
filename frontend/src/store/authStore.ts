import { create } from "zustand";
import Cookies from "js-cookie";
import { User } from "@/types";
import { useCartStore } from "@/store/cartStore";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  checkAuth: () => void;
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

  setAuth: (user, token) => {
    persistToken(token);
    localStorage.setItem("user", JSON.stringify(user));
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("admin-panel-unlocked");
    }
    useCartStore.getState().setCartOwner(user.id);
    set({ user, token, isAuthenticated: true, isInitialized: true });
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
        } else {
          // If already authenticated and user data matches, just set initialized
          useCartStore.getState().setCartOwner(parsedUser.id);
          set({ isInitialized: true });
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
