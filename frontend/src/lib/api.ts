import axios from "axios";
import Cookies from "js-cookie";
function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isPrivateIPv4(hostname: string) {
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);
}

function getStoredToken() {
  if (typeof window === "undefined") {
    return Cookies.get("token");
  }
  return Cookies.get("token") || localStorage.getItem("token");
}

function getCookieDomain() {
  if (typeof window === "undefined") return undefined;
  const hostname = window.location.hostname;
  if (isLocalHostname(hostname)) return undefined;
  const segments = hostname.split(".").filter(Boolean);
  if (segments.length < 2) return undefined;
  return `.${segments.slice(-2).join(".")}`;
}

function clearPersistedAuth() {
  const domain = getCookieDomain();
  Cookies.remove("token");
  if (domain) {
    Cookies.remove("token", { domain });
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("admin-panel-unlocked");
    void import("@/store/cartStore").then(({ useCartStore }) => {
      useCartStore.getState().setCartOwner(null);
    });
  }
}

function getBaseURL() {
  const envURL = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined") {
    const currentHost = window.location.hostname;

    // Always use the active browser host on local/private networks.
    if (isLocalHostname(currentHost) || isPrivateIPv4(currentHost)) {
      return `http://${currentHost}:8081/api`;
    }

    // Deployment domain fallback.
    if (currentHost.includes("vkshivshakti.in")) {
      const isHTTPS = window.location.protocol === "https:";
      const baseDomain = currentHost.split(".").slice(-2).join("."); // vkshivshakti.in
      return `${isHTTPS ? "https" : "http"}://api.${baseDomain}/api`;
    }

    // Browser env fallback for non-local custom hosts.
    if (envURL) {
      return envURL;
    }

    // Final fallback.
    return "/api";
  }

  return envURL || "http://localhost:8081/api";
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token to every request from persisted auth state
api.interceptors.request.use((config) => {
  config.baseURL = getBaseURL();
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle unauthorized responses (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearPersistedAuth();
      // Optional: window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  }
);

export default api;
