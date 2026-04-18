"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, Landmark, Wallet } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { SuccessPopup } from "@/components/ui/SuccessPopup";
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
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<string[]>(["cash"]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    router.replace("/admin/expenses");
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
      setSuccessMessage(editingId ? "Expense updated successfully." : "Expense saved successfully.");
      resetForm();
    } catch (error: unknown) {
      const message =
        (error as AxiosError<{ error?: string }>)?.response?.data?.error ||
        "Failed to save expense";
      setFormError(message);
    }
  };

  useEffect(() => {
    const editExpenseId = searchParams.get("edit");
    if (!editExpenseId || expenses.length === 0) return;

    const expense = expenses.find((entry) => entry.id === editExpenseId);
    if (!expense) return;

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
  }, [expenses, searchParams]);

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
          <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={() => router.push("/admin/expenses/list")}>
            Open Expense List
          </Button>
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

        <div className="mx-auto max-w-3xl">
          <section className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">{editingId ? "Edit Expense" : "Expense Form"}</h2>
              <p className="mt-1 text-sm text-zinc-500">Date, description, amount, payment method aur note fill karo. Expense history alag page par khulega.</p>
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
                  min="2000-01-01"
                  max="2099-12-31"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Kis cheez par kharcha hua"
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
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
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as ExpensePaymentMethod })}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
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
        </div>
        <SuccessPopup
          isOpen={Boolean(successMessage)}
          message={successMessage || ""}
          onClose={() => setSuccessMessage(null)}
          title="Form Submitted"
        />
      </div>
    </div>
  );
}
