"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, Landmark, Pencil, Search, Trash2, Wallet } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";
import type { AxiosError } from "axios";

type ExpensePaymentMethod = string;
type BankAccount = { name: string; balance: number };

type ExpenseEntry = {
  id: string;
  date: string;
  description: string;
  category: string;
  paymentMethod: ExpensePaymentMethod;
  amount: number;
  note: string;
};

type ExpenseForm = {
  date: string;
  description: string;
  category: string;
  paymentMethod: ExpensePaymentMethod;
  amount: string;
  note: string;
};

const todayValue = () => new Date().toISOString().slice(0, 10);
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

const emptyForm = (): ExpenseForm => ({
  date: todayValue(),
  description: "",
  category: "",
  paymentMethod: "cash",
  amount: "",
  note: "",
});

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

type ExpenseApiEntry = {
  id?: string | number;
  date?: string;
  description?: string;
  category?: string;
  payment_method?: string;
  amount?: number | string;
  note?: string;
};

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

export default function AdminExpensesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentOptions, setPaymentOptions] = useState<string[]>(["cash"]);
  const [loading, setLoading] = useState(true);

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
      } catch (error) {
        console.error("Failed to load expenses page data", error);
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

  const summary = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      cash: expenses.filter((expense) => expense.paymentMethod === "cash").reduce((sum, expense) => sum + expense.amount, 0),
      bank: expenses.filter((expense) => expense.paymentMethod !== "cash").reduce((sum, expense) => sum + expense.amount, 0),
      today: expenses.filter((expense) => new Date(expense.date) >= startOfToday).reduce((sum, expense) => sum + expense.amount, 0),
      month: expenses.filter((expense) => new Date(expense.date) >= startOfMonth).reduce((sum, expense) => sum + expense.amount, 0),
    };
  }, [expenses]);

  const resetForm = () => {
    setEditingId(null);
    setFormError(null);
    setForm(emptyForm());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);

    if (!form.date) {
      setFormError("Date required");
      return;
    }
    if (!form.description.trim()) {
      setFormError("Description required");
      return;
    }
    if (!form.category.trim()) {
      setFormError("Category required");
      return;
    }
    if (!form.paymentMethod) {
      setFormError("Payment method required");
      return;
    }
    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      setFormError("Amount must be a positive number");
      return;
    }

    setFormError(null);

    const payload = {
      date: form.date,
      description: form.description.trim(),
      category: form.category.trim(),
      payment_method: form.paymentMethod,
      amount,
      note: form.note.trim(),
    };

    try {
      if (editingId) {
        await api.put(`/admin/expenses/${editingId}`, payload);
      } else {
        await api.post("/admin/expenses", payload);
      }

      const expensesRes = await api.get("/admin/expenses");
      setExpenses((expensesRes.data.data || []).map(normalizeExpense));
      resetForm();
    } catch (error: unknown) {
      const message =
        (error as AxiosError<{ error?: string }>)?.response?.data?.error ||
        "Failed to save expense";
      setFormError(message);
    }
  };

  const handleEdit = (expense: ExpenseEntry) => {
    setEditingId(expense.id);
    setFormError(null);
    setForm({
      date: expense.date,
      description: expense.description,
      category: expense.category,
      paymentMethod: expense.paymentMethod,
      amount: String(expense.amount),
      note: expense.note,
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/expenses/${id}`);
      const expensesRes = await api.get("/admin/expenses");
      setExpenses((expensesRes.data.data || []).map(normalizeExpense));
      if (editingId === id) {
        resetForm();
      }
    } catch (error: unknown) {
      const message =
        (error as AxiosError<{ error?: string }>)?.response?.data?.error ||
        "Failed to delete expense";
      setFormError(message);
    }
  };

  if (!isInitialized || loading) {
    return <div className="p-12 text-center">Loading expenses page...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-6 md:py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl md:text-4xl">EXPENSE MANAGEMENT</h1>
              <p className="mt-1 text-sm text-zinc-500 md:mt-2 md:text-base">Daily kharcha track karo, filter karo, aur edit/delete bhi yahin se.</p>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total Expenses", value: formatCurrency(summary.total), tone: "text-zinc-900", icon: Wallet },
            { label: "Cash Expenses Total", value: formatCurrency(summary.cash), tone: "text-green-700", icon: Landmark },
            { label: "Bank Expenses Total", value: formatCurrency(summary.bank), tone: "text-blue-700", icon: Landmark },
            { label: "Today Expenses", value: formatCurrency(summary.today), tone: "text-rose-700", icon: CalendarDays },
            { label: "This Month Expenses", value: formatCurrency(summary.month), tone: "text-amber-700", icon: CalendarDays },
          ].map((card) => (
            <div key={card.label} className="rounded-[1.6rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{card.label}</div>
                <card.icon className="h-4 w-4 text-zinc-400" />
              </div>
              <div className={`mt-3 text-2xl font-black ${card.tone} sm:text-3xl`}>{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">{editingId ? "Edit Expense" : "Expense Form"}</h2>
              <p className="mt-1 text-sm text-zinc-500">Date, description, amount, payment method aur note fill karo.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Kis cheez par kharcha hua"
                  className="w-full rounded-2xl border border-zinc-200 p-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="Kitna kharcha hua"
                    className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as ExpensePaymentMethod })}
                    className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {paymentOptions.map((option) => (
                      <option key={option} value={option}>{formatPaymentLabel(option)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Note</label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Optional note"
                  className="w-full rounded-2xl border border-zinc-200 p-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="h-12 flex-1 rounded-2xl">
                  {editingId ? "Update Expense" : "Save Expense"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" className="h-12 rounded-2xl px-4" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">Expense List</h2>
                <p className="mt-1 text-sm text-zinc-500">Search aur filters ke saath table view.</p>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by description"
                  className="h-12 w-full rounded-2xl border border-zinc-200 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-12 rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Filter by Date</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="h-12 rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Filter by Payment</option>
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>{formatPaymentLabel(option)}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-12 rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
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
                    <Button variant="outline" size="sm" onClick={() => handleEdit(expense)} className="flex-1 rounded-xl">
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
                  Expense entries abhi nahi hain. Left side form se pehla expense add kar sakte ho.
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
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(expense)} className="h-10 w-10 rounded-xl border border-zinc-100 p-0">
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
                        Expense entries abhi nahi hain. Left side form se pehla expense add kar sakte ho.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
