"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin, canAccessERP } from "@/lib/roles";
import api from "@/lib/api";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Landmark,
  ListOrdered,
  Package,
  Receipt,
  Users,
  WalletCards,
} from "lucide-react";

interface ARPSummary {
  total_receivable: number;
  total_payable: number;
  cash_total: number;
  bank_accounts: { name: string; balance: number }[];
}

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [stats, setStats] = useState({ products: 0, orders: 0, parties: 0 });
  const [arpSummary, setArpSummary] = useState<ARPSummary>({
    total_receivable: 0,
    total_payable: 0,
    cash_total: 0,
    bank_accounts: [],
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role) && !canAccessERP(user.role)))) {
      router.push("/");
    }
  }, [isInitialized, isAuthenticated, user, router]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let products = 0;
        let orders = 0;
        let parties = 0;
        let summary = {
          total_receivable: 0,
          total_payable: 0,
          cash_total: 0,
          bank_accounts: [],
        };

        if (canAccessAdmin(user?.role)) {
          const [productRes, orderRes] = await Promise.all([
            api.get("/admin/products"),
            api.get("/admin/orders"),
          ]);
          products = productRes.data.data?.total || 0;
          orders = orderRes.data.data?.length || 0;
        }

        if (canAccessERP(user?.role)) {
          const [partiesRes, summaryRes] = await Promise.all([
            api.get("/admin/arp/parties"),
            api.get("/admin/arp/summary"),
          ]);
          parties = Array.isArray(partiesRes.data.data) ? partiesRes.data.data.length : 0;
          summary = summaryRes.data.data || summary;
        }

        setStats({ products, orders, parties });
        setArpSummary(summary);
      } catch {
        console.error("Failed to fetch admin stats");
      }
    };

    if (isInitialized && isAuthenticated && user && (canAccessAdmin(user.role) || canAccessERP(user.role))) {
      void fetchStats();
    }
  }, [isInitialized, isAuthenticated, user]);

  const highlightCards = useMemo(
    () =>
      [
        {
          title: "Catalog Coverage",
          value: stats.products,
          detail: "products live in system",
          tone: "border-blue-100 bg-blue-50/70 text-blue-700",
          textTone: "text-zinc-950",
          allowed: canAccessAdmin(user?.role),
        },
        {
          title: "Order Queue",
          value: stats.orders,
          detail: "orders waiting to review",
          tone: "border-amber-100 bg-amber-50/70 text-amber-700",
          textTone: "text-zinc-950",
          allowed: canAccessAdmin(user?.role),
        },
        {
          title: "Party Network",
          value: stats.parties,
          detail: "customers and suppliers",
          tone: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
          textTone: "text-zinc-950",
          allowed: canAccessERP(user?.role),
        },
      ].filter((card) => card.allowed),
    [stats.orders, stats.parties, stats.products, user?.role]
  );

 

  const paymentModeCards = [
    { label: "Cash", value: arpSummary.cash_total, tone: "bg-emerald-50 text-emerald-700", mode: "cash" },
    ...arpSummary.bank_accounts.map((account, index) => ({
      label: account.name.trim(),
      value: account.balance,
      tone: index % 2 === 0 ? "bg-blue-50 text-blue-700" : "bg-cyan-50 text-cyan-700",
      mode: account.name.trim(),
    })),
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
              Home Dashboard
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">Admin Home</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
              Welcome back, {user?.name}. Left sidebar se modules open karo, aur yahan se current store activity ka quick pulse dekh lo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {highlightCards.map((card) => (
              <div
                key={card.title}
                className={`min-w-[220px] rounded-[1.6rem] border p-5 shadow-sm ${card.tone}`}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.22em]">{card.title}</p>
                <p className={`mt-3 text-4xl font-black tracking-tight ${card.textTone}`}>{card.value}</p>
                <p className="mt-2 text-sm font-medium text-zinc-500">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


        
    

      {canAccessERP(user?.role) && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-zinc-100 bg-white p-8 shadow-sm">
              <div className="absolute right-0 top-0 p-8">
                <ArrowUpRight className="h-8 w-8 text-green-100 transition-colors group-hover:text-green-500" />
              </div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Receivables</p>
              <h2 className="text-4xl font-black text-zinc-900">{formatCurrency(arpSummary.total_receivable)}</h2>
              <div className="mt-6 flex items-center gap-2">
                <span className="rounded-full bg-green-50 px-3 py-1 text-[10px] font-black uppercase text-green-600">
                  Due from Customers
                </span>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-[2.5rem] border border-zinc-100 bg-white p-8 shadow-sm">
              <div className="absolute right-0 top-0 p-8">
                <ArrowDownLeft className="h-8 w-8 text-red-100 transition-colors group-hover:text-red-500" />
              </div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Payables</p>
              <h2 className="text-4xl font-black text-zinc-900">{formatCurrency(arpSummary.total_payable)}</h2>
              <div className="mt-6 flex items-center gap-2">
                <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase text-red-600">
                  Due to Suppliers
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2.5rem] border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Net Balance</p>
              <h2 className="text-4xl font-black text-white">
                {formatCurrency(arpSummary.total_receivable - arpSummary.total_payable)}
              </h2>
              <div className="mt-6 flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase text-white">
                  Overall Position
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Payment Mode Overview</h3>
              <p className="mt-2 text-sm font-medium text-zinc-500">
                Kisi bhi mode par click karke uski saari payment transactions dekh sakte ho.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {paymentModeCards.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(`/admin/arp/payment-modes?mode=${encodeURIComponent(item.mode)}`)}
                  className="rounded-[1.75rem] border border-zinc-100 bg-zinc-50/70 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white"
                >
                  <div
                    className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${item.tone}`}
                  >
                    {item.label}
                  </div>
                  <div className="mt-4 text-3xl font-black tracking-tight text-zinc-900">
                    {formatCurrency(item.value)}
                  </div>
                  <div className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                    Click To View Transactions
                  </div>
                </button>
              ))}
            </div>
            {arpSummary.bank_accounts.length === 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                Bank cards dikhane ke liye settings me bank account add karo.
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {canAccessERP(user?.role) && (
          <Link
            href="/admin/parties"
            className="rounded-[1.8rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] transition hover:border-zinc-300"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-black tracking-tight text-zinc-950">Manage Parties</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Customer aur supplier records ko clean, searchable aur billing-ready rakho.</p>
          </Link>
        )}

        {canAccessAdmin(user?.role) && (
          <Link
            href="/admin/expenses"
            className="rounded-[1.8rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] transition hover:border-zinc-300"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Landmark className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-black tracking-tight text-zinc-950">Track Expenses</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Daily kharcha aur payment outflow ko separate record karke profitability monitor karo.</p>
          </Link>
        )}

        {canAccessAdmin(user?.role) && (
          <Link
            href="/admin/products-summary"
            className="rounded-[1.8rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] transition hover:border-zinc-300"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Receipt className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-xl font-black tracking-tight text-zinc-950">Product Summary</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Margin, catalog snapshot aur stock-facing overview ko quick audit mode me dekh lo.</p>
          </Link>
        )}
      </section>
    </div>
  );
}
