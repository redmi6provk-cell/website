"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil, Search, Trash2 } from "lucide-react";
import type { AxiosError } from "axios";
import { canAccessAdmin } from "@/lib/roles";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";

type ExpensePaymentMethod = string;

type ExpenseEntry = {
  id: string;
  date: string;
  description: string;
  category: string;
  paymentMethod: ExpensePaymentMethod;
  amount: number;
  note: string;
};

type BankAccount = { name: string; balance: number };

type ExpenseApiEntry = {
  id?: string | number;
  date?: string;
  description?: string;
  category?: string;
  payment_method?: string;
  amount?: number | string;
  note?: string;
};

const expenseCategoryOptions = [
  "Transport",
  "Rent",
  "Salary",
  "Utilities",
  "Maintenance",
  "Packaging",
  "Office Expense",
  "Marketing",
  "Internet",
  "Fuel",
  "Miscellaneous",
];

function normalizeExpense(entry: ExpenseApiEntry): ExpenseEntry {
  return {
    id: String(entry.id),
    date: String(entry.date || "").slice(0, 10),
    description: entry.description || "",
    category: entry.category || "",
    paymentMethod: entry.payment_method || "cash",
    amount: Number(entry.amount || 0),
    note: entry.note || "",
  };
}

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPaymentLabel(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function AdminExpensesListPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentOptions, setPaymentOptions] = useState<string[]>(["cash"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) {
      router.push("/");
    }
  }, [isInitialized, isAuthenticated, user, router]);

  useEffect(() => {
    const loadPage = async () => {
      try {
        const [settingsRes, expensesRes] = await Promise.allSettled([
          api.get("/admin/settings"),
          api.get("/admin/expenses"),
        ]);

        if (settingsRes.status === "fulfilled") {
          const bankAccounts: BankAccount[] = Array.isArray(settingsRes.value.data.data?.bank_accounts)
            ? settingsRes.value.data.data.bank_accounts
            : [];
          setPaymentOptions(["cash", ...bankAccounts.map((account) => account.name.trim()).filter(Boolean)]);
        }

        if (expensesRes.status === "fulfilled") {
          setExpenses((expensesRes.value.data.data || []).map(normalizeExpense));
        }
      } catch (loadError) {
        console.error("Failed to load expenses list", loadError);
        setError("Expense list load nahi ho payi.");
      } finally {
        setLoading(false);
      }
    };

    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) {
      void loadPage();
    }
  }, [isInitialized, isAuthenticated, user]);

  const categories = useMemo(
    () => Array.from(new Set([...expenseCategoryOptions, ...expenses.map((expense) => expense.category).filter(Boolean)])).sort(),
    [expenses]
  );

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.date);
      const matchesSearch =
        !query || expense.description.toLowerCase().includes(query) || expense.note.toLowerCase().includes(query);
      const matchesPayment = paymentFilter === "all" || expense.paymentMethod === paymentFilter;
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
      const matchesDate =
        dateFilter === "all" ||
        (dateFilter === "today" && expenseDate >= startOfToday) ||
        (dateFilter === "week" && expenseDate >= startOfWeek) ||
        (dateFilter === "month" && expenseDate >= startOfMonth);

      return matchesSearch && matchesPayment && matchesCategory && matchesDate;
    });
  }, [expenses, search, paymentFilter, categoryFilter, dateFilter]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/expenses/${id}`);
      const expensesRes = await api.get("/admin/expenses");
      setExpenses((expensesRes.data.data || []).map(normalizeExpense));
    } catch (deleteError: unknown) {
      const message =
        (deleteError as AxiosError<{ error?: string }>)?.response?.data?.error ||
        "Expense delete nahi ho payi";
      setError(message);
    }
  };

  if (!isInitialized || loading) {
    return <div className="p-12 text-center">Loading expense list...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-6 md:py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/expenses")} className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl md:text-4xl">EXPENSE LIST</h1>
              <p className="mt-1 text-sm text-zinc-500 md:mt-2 md:text-base">Search, filter, edit aur delete ke liye dedicated page.</p>
            </div>
          </div>
          <Button type="button" className="rounded-2xl px-5" onClick={() => router.push("/admin/expenses")}>
            Open Expense Form
          </Button>
        </div>

        <section className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
          {error ? (
            <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">Expense Records</h2>
              <p className="mt-1 text-sm text-zinc-500">Search aur filters ke saath table view.</p>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by description"
                className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Filter by Date</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Filter by Payment</option>
              {paymentOptions.map((option) => (
                <option key={option} value={option}>{formatPaymentLabel(option)}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Filter by Category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4 md:hidden">
            {filteredExpenses.map((expense) => (
              <div key={expense.id} className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{formatDate(expense.date)}</div>
                    <div className="mt-2 text-base font-bold text-zinc-900">{expense.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-zinc-900">{formatCurrency(expense.amount)}</div>
                    <div className="mt-1 text-xs capitalize text-zinc-500">{expense.paymentMethod}</div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 rounded-2xl bg-white p-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Category</div>
                    <div className="mt-1 text-sm font-medium text-zinc-700">{expense.category}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Note</div>
                    <div className="mt-1 text-sm text-zinc-600">{expense.note || "-"}</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/admin/expenses?edit=${expense.id}`)} className="flex-1 rounded-xl">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)} className="flex-1 rounded-xl text-red-500 hover:bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {filteredExpenses.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
                Expense entries abhi nahi hain. Expense form page se pehla expense add kar sakte ho.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Date</th>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Description</th>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Category</th>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Payment Method</th>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Amount</th>
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Note</th>
                  <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-4 py-4 text-sm text-zinc-700">{formatDate(expense.date)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-zinc-900">{expense.description}</td>
                    <td className="px-4 py-4 text-sm text-zinc-700">{expense.category}</td>
                    <td className="px-4 py-4 text-sm capitalize text-zinc-700">{expense.paymentMethod}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-zinc-900">{formatCurrency(expense.amount)}</td>
                    <td className="max-w-[240px] px-4 py-4 text-sm text-zinc-600">
                      <div className="line-clamp-2">{expense.note || "-"}</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/expenses?edit=${expense.id}`)} className="h-10 w-10 rounded-xl border border-zinc-100 p-0">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)} className="h-10 w-10 rounded-xl border border-zinc-100 p-0 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                      Expense entries abhi nahi hain. Expense form page se pehla expense add kar sakte ho.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
