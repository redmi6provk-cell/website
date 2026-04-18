"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Home,
  Layers,
  Landmark,
  ListOrdered,
  Lock,
  LogOut,
  Package,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  UploadCloud,
  Users,
  WalletCards,
} from "lucide-react";
import api from "@/lib/api";
import { canAccessAdmin, canAccessERP } from "@/lib/roles";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ADMIN_PANEL_SESSION_KEY = "admin-panel-unlocked";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth, logout } = useAuthStore();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsUnlocked(sessionStorage.getItem(ADMIN_PANEL_SESSION_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated || (user && !canAccessERP(user.role))) {
      router.replace("/");
      return;
    }

    if (pathname === "/admin" && user && canAccessERP(user.role)) {
      return;
    }
  }, [isInitialized, isAuthenticated, user, router, pathname]);

  const canEnterAdminArea = useMemo(() => canAccessERP(user?.role), [user?.role]);
  const navItems = useMemo(
    () =>
      [
        { title: "Home", icon: Home, link: "/admin", allowed: canAccessERP(user?.role) },
        { title: "Orders", icon: ListOrdered, link: "/admin/orders", allowed: canAccessAdmin(user?.role) },
        { title: "Sales", icon: Receipt, link: "/admin/offline-sell", allowed: canAccessAdmin(user?.role) },
        { title: "Purchases", icon: WalletCards, link: "/admin/purchases", allowed: canAccessAdmin(user?.role) },
        { title: "Payments", icon: ArrowLeftRight, link: "/admin/payments", allowed: canAccessERP(user?.role) },
        { title: "Expenses", icon: Landmark, link: "/admin/expenses", allowed: canAccessAdmin(user?.role) },
        { title: "Products", icon: Package, link: "/admin/products", allowed: canAccessAdmin(user?.role) },
        { title: "Upload", icon: UploadCloud, link: "/admin/upload", allowed: canAccessAdmin(user?.role) },
        { title: "Transactions", icon: BarChart3, link: "/admin/arp", allowed: canAccessERP(user?.role) },
        { title: "Parties", icon: Users, link: "/admin/parties", allowed: canAccessERP(user?.role) },
        { title: "Categories", icon: Layers, link: "/admin/categories", allowed: canAccessAdmin(user?.role) },
        { title: "Brands", icon: Tag, link: "/admin/brands", allowed: canAccessAdmin(user?.role) },
        { title: "Summary", icon: Receipt, link: "/admin/products-summary", allowed: canAccessAdmin(user?.role) },
        { title: "Settings", icon: Settings, link: "/admin/settings", allowed: canAccessAdmin(user?.role) },
        
        
        
      ].filter((item) => item.allowed),
    [user?.role]
  );

  const isActiveNavItem = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleVerifyPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsVerifying(true);
    setErrorMessage("");

    try {
      await api.post("/admin/panel-access/verify", { password });
      sessionStorage.setItem(ADMIN_PANEL_SESSION_KEY, "true");
      setIsUnlocked(true);
      setPassword("");
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || "Admin panel password verify nahi hua");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isInitialized) {
    return <div className="p-12 text-center">Checking admin access...</div>;
  }

  if (!isAuthenticated || !canEnterAdminArea) {
    return null;
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.1),_transparent_30%),linear-gradient(180deg,_#fafaf9_0%,_#f8fafc_100%)] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.4)] sm:p-10">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Extra Security</p>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Admin Panel Password</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Admin area kholne ke liye shared panel password dalo. Ye gate sab `/admin` pages par apply hoga.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleVerifyPassword}>
              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Panel Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter admin panel password"
                    className="h-14 rounded-2xl border-zinc-200 pl-11"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {errorMessage ? <p className="text-sm font-medium text-red-600">{errorMessage}</p> : null}

              <Button type="submit" className="h-14 w-full rounded-2xl text-base font-semibold" disabled={isVerifying}>
                {isVerifying ? "Checking..." : "Unlock Admin Panel"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#f4f4ef_100%)]">
      <div className="border-b border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto max-w-7xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-400">Admin Panel</p>
              <p className="text-sm font-semibold text-zinc-900">{user?.name || "Admin"}</p>
            </div>
            <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">
              {user?.role || "staff"}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map(({ title, icon: Icon, link }) => (
              <Link
                key={link}
                href={link}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] transition ${
                  isActiveNavItem(link)
                    ? "bg-zinc-950 text-white"
                    : "border border-zinc-200 bg-white text-zinc-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="relative">
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-72 lg:border-r lg:border-zinc-200/80 lg:bg-white/95 lg:px-5 lg:py-6 lg:backdrop-blur">
          <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.2)]">
            <div className="border-b border-zinc-100 pb-5">
              
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.26em] text-zinc-400">Admin Panel</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-950">Control Center</h2>
             
            </div>

            <div className="mt-5 flex-1 space-y-2 overflow-y-auto pr-1">
              {navItems.map(({ title, icon: Icon, link }) => (
                <Link
                  key={link}
                  href={link}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActiveNavItem(link)
                      ? "bg-zinc-950 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.55)]"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                  }`}
                >
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                      isActiveNavItem(link) ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{title}</span>
                </Link>
              ))}
            </div>

            
          </div>
        </aside>

        <main className="min-w-0 px-3 pt-0 pb-8 sm:px-6 lg:ml-72 lg:px-8 lg:pb-8">
          <div className="sticky top-4 z-30 mb-6 hidden items-center justify-between gap-4 rounded-[1.75rem] border border-zinc-200/80 bg-white/92 px-5 py-4 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.25)] backdrop-blur lg:flex">
            <div className="flex min-w-0 items-center gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Admin Workspace</p>
                <h1 className="truncate text-lg font-black tracking-tight text-zinc-950">
                  {pathname === "/admin" ? "Home Dashboard" : "Operations Panel"}
                </h1>
              </div>
            </div>

            <div className="flex min-w-1 flex-1 items-center justify-end gap-80">
              
              <Link
                href="/"
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
              >
                Store Home
              </Link>
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Profile</span>
                <span className="block font-semibold text-zinc-900">{user?.name || "Admin"}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
