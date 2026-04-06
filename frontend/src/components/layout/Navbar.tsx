"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { isStaffRole } from "@/lib/roles";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },

];

const subscribe = () => () => {};

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const { getTotalItems } = useCartStore();
  const { user, isAuthenticated, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isMobileSearchOpen) {
      mobileSearchInputRef.current?.focus();
    }
  }, [isMobileSearchOpen]);

  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const cartItemCount = isClient ? getTotalItems() : 0;
  const currentSearch = useMemo(() => searchParams.get("search") || "", [searchParams]);

  const isActiveLink = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    const [pathOnly] = href.split("#");
    return pathname === pathOnly;
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>, source: "desktop" | "mobile") => {
    event.preventDefault();

    const input = source === "desktop" ? searchInputRef.current : mobileSearchInputRef.current;
    const query = input?.value.trim() || "";
    const params = new URLSearchParams();

    if (query) {
      params.set("search", query);
    }

    setIsMenuOpen(false);
    setIsMobileSearchOpen(false);
    router.push(query ? `/products?${params.toString()}` : "/products");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-8">
          <Link href="/" className="flex items-center gap-3 text-zinc-950 transition-colors duration-200 hover:text-green-700">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 text-[11px] font-semibold tracking-[0.32em]">
              FM
            </span>
            <span className="text-base font-semibold tracking-[0.18em] uppercase">FMCG Store</span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`border-b pb-1 text-sm font-medium transition-all duration-200 ${
                  isActiveLink(href)
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-950"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 md:flex">
          <form
            onSubmit={(event) => handleSearchSubmit(event, "desktop")}
            className="relative hidden w-full max-w-xs lg:block"
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              key={currentSearch}
              ref={searchInputRef}
              type="search"
              defaultValue={currentSearch}
              placeholder="Search products"
              className="h-11 w-full rounded-full border border-zinc-200 bg-white pl-10 pr-4 text-sm text-zinc-900 outline-none transition-colors duration-200 placeholder:text-zinc-400 focus:border-zinc-900"
            />
          </form>

          <Link
            href="/products"
            aria-label="Search products"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950 lg:hidden"
          >
            <Search className="h-4 w-4" />
          </Link>

          <Link
            href="/cart"
            aria-label="View cart"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950"
          >
            <ShoppingCart className="h-4 w-4" />
            {cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-green-600 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                {cartItemCount}
              </span>
            )}
          </Link>

          {isStaffRole(user?.role) && (
            <Link
              href="/admin"
              className="hidden items-center gap-2 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950 xl:inline-flex"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Admin</span>
            </Link>
          )}

          {isAuthenticated ? (
            <Link
              href="/dashboard"
              aria-label="Profile"
              className="inline-flex items-center gap-3 rounded-full border border-zinc-200 px-2.5 py-2 transition-colors duration-200 hover:border-zinc-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden text-left xl:block">
                <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Profile</span>
                <span className="block max-w-32 truncate text-sm font-medium text-zinc-900">{user?.name || "User"}</span>
              </span>
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-zinc-800"
            >
              Login
            </Link>
          )}

          {isAuthenticated && (
            <button
              onClick={logout}
              className="hidden rounded-full px-2 py-2 text-sm font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-950 xl:inline-flex"
            >
              Logout
            </button>
          )}
        </div>

        <div className="flex flex-1 justify-end md:hidden">
          {isMobileSearchOpen ? (
            <form
              onSubmit={(event) => handleSearchSubmit(event, "mobile")}
              className="flex w-full items-center gap-2"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  key={`mobile-inline-${currentSearch}`}
                  ref={mobileSearchInputRef}
                  type="search"
                  defaultValue={currentSearch}
                  placeholder="Search products"
                  className="h-10 w-full rounded-full border border-zinc-200 bg-white pl-10 pr-4 text-sm text-zinc-900 outline-none transition-colors duration-200 placeholder:text-zinc-400 focus:border-zinc-900"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                aria-label="Close search"
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsMobileSearchOpen(true);
                }}
                aria-label="Open search"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950"
              >
                <Search className="h-4 w-4" />
              </button>
              <Link
                href="/cart"
                aria-label="View cart"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700"
              >
                <ShoppingCart className="h-4 w-4" />
                {cartItemCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-green-600 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                    {cartItemCount}
                  </span>
                )}
              </Link>
              <button
                onClick={() => setIsMenuOpen((value) => !value)}
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950"
              >
                {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden border-t border-zinc-200 bg-white transition-[max-height,opacity] duration-300 md:hidden ${
          isMenuOpen && !isMobileSearchOpen ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-6 px-4 py-5 sm:px-6">
          <nav className="space-y-3">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMenuOpen(false)}
                className={`block border-b pb-3 text-base font-medium transition-colors duration-200 ${
                  isActiveLink(href) ? "border-zinc-900 text-zinc-950" : "border-zinc-100 text-zinc-500 hover:text-zinc-950"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 text-sm font-medium text-zinc-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="max-w-36 truncate">{user?.name || "Profile"}</span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="text-sm font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-950"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-zinc-800"
              >
                Login
              </Link>
            )}
          </div>

          {isStaffRole(user?.role) && (
            <Link
              href="/admin"
              onClick={() => setIsMenuOpen(false)}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors duration-200 hover:text-zinc-950"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Open Admin</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
