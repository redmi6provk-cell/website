"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import { BarChart3, ChevronLeft, Package, Search, ShoppingCart, Truck } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/PageLoader";
import { SuccessPopup } from "@/components/ui/SuccessPopup";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import type { Order } from "@/types";

type ProductDetails = {
  id: string;
  name: string;
  brand_info?: {
    name?: string;
  };
  category_info?: {
    name?: string;
  };
};

type ProductTransaction = {
  type: string;
  reference_no: string;
  name: string;
  date: string;
  quantity: number;
  price_per_unit: number;
  line_total: number;
  invoice_total: number;
  received_amount: number;
  payment_status: string;
  payment_mode: string;
  source_module: string;
  source_id: string;
};

type PurchaseItemPayload = {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  buy_price: number;
  line_total: number;
};

type PurchasePayload = {
  id: string;
  date: string;
  invoice_number: string;
  supplier_party_id?: string;
  supplier_name: string;
  payment_status: string;
  payment_method: string;
  notes: string;
  total_amount: number;
  items: PurchaseItemPayload[];
};

type PaymentBreakdownEntry = {
  mode: string;
  amount: number;
};

type OfflineSaleItemPayload = {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  sell_price: number;
  discount_value: number;
  line_total: number;
};

type OfflineSalePayload = {
  id: string;
  bill_number: string;
  sale_date: string;
  customer_party_id?: string;
  customer_name: string;
  customer_phone: string;
  shop_name: string;
  payment_mode: string;
  notes: string;
  final_total: number;
  amount_received: number;
  payment_breakdown_json?: string;
  items: OfflineSaleItemPayload[];
};

type OrderPaymentPayload = Order & {
  payment_breakdown_json?: string;
};

type PaymentRow = {
  id: string;
  mode: string;
  amount: string;
};

type BankAccount = {
  name?: string;
};

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatStatusLabel(value: string) {
  const normalized = (value || "pending").replaceAll("_", " ").trim();
  if (!normalized) return "Pending";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStatusTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "paid") return "bg-emerald-50 text-emerald-700";
  if (normalized === "partial" || normalized === "partially paid" || normalized === "partially_paid") {
    return "bg-amber-50 text-amber-700";
  }
  if (normalized === "unpaid" || normalized === "due" || normalized === "pending") {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-zinc-100 text-zinc-700";
}

function getTypeTone(value: string) {
  return value.toLowerCase() === "purchase" ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700";
}

function formatModeLabel(value: string) {
  const normalized = (value || "cash").replaceAll("_", " ").trim();
  if (!normalized) return "Cash";
  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parsePaymentBreakdownJSON(raw?: string | null): PaymentBreakdownEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PaymentBreakdownEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && entry.mode && Number(entry.amount) > 0);
  } catch {
    return [];
  }
}

function createPaymentRow(mode = "cash", amount = ""): PaymentRow {
  return {
    id: `payment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    mode,
    amount,
  };
}

export default function ProductTransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [productId, setProductId] = useState("");
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [transactions, setTransactions] = useState<ProductTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingTransactionKey, setUpdatingTransactionKey] = useState<string | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<string[]>(["cash", "QR"]);
  const [selectedTransaction, setSelectedTransaction] = useState<ProductTransaction | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([createPaymentRow()]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    void params.then((resolved) => setProductId(resolved.id));
  }, [params]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) {
      router.replace("/");
    }
  }, [isInitialized, isAuthenticated, user, router]);

  useEffect(() => {
    if (!productId || !isInitialized || !isAuthenticated || !user || !canAccessAdmin(user.role)) {
      return;
    }

    const loadPage = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [transactionsRes, settingsRes] = await Promise.all([
          api.get(`/admin/products/${productId}/transactions`),
          api.get("/admin/settings"),
        ]);
        setProduct(transactionsRes.data.data?.product || null);
        setTransactions(transactionsRes.data.data?.transactions || []);
        const bankAccounts: BankAccount[] = Array.isArray(settingsRes.data.data?.bank_accounts)
          ? settingsRes.data.data.bank_accounts
          : [];
        const bankOptions = bankAccounts
          .map((account) => account.name?.trim())
          .filter((name): name is string => Boolean(name));
        setPaymentOptions(["cash", "QR", ...bankOptions, "card", "credit", "mixed"]);
      } catch (error) {
        const message =
          (error as AxiosError<{ error?: string }>)?.response?.data?.error || "Product transactions fetch nahi ho paaye.";
        setErrorMessage(message);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [productId, isInitialized, isAuthenticated, user]);

  const refreshTransactions = async () => {
    const response = await api.get(`/admin/products/${productId}/transactions`);
    setProduct(response.data.data?.product || null);
    setTransactions(response.data.data?.transactions || []);
  };

  const handleOpenPaymentModal = async (transaction: ProductTransaction) => {
    setSelectedTransaction(transaction);
    setErrorMessage(null);
    let rows = [createPaymentRow(transaction.payment_mode || "cash", transaction.received_amount ? String(transaction.received_amount) : "")];

    try {
      if (transaction.source_module === "order") {
        const response = await api.get("/admin/orders");
        const orders = (response.data.data || []) as OrderPaymentPayload[];
        const order = orders.find((entry) => entry.id === transaction.source_id);
        const breakdown = parsePaymentBreakdownJSON(order?.payment_breakdown_json);
        if (breakdown.length > 0) {
          rows = breakdown.map((entry) => createPaymentRow(entry.mode, String(entry.amount)));
        }
      } else if (transaction.source_module === "offline_sale") {
        const response = await api.get("/admin/offline-sales");
        const sales = (response.data.data || []) as OfflineSalePayload[];
        const sale = sales.find((entry) => entry.id === transaction.source_id);
        const breakdown = parsePaymentBreakdownJSON(sale?.payment_breakdown_json);
        if (breakdown.length > 0) {
          rows = breakdown.map((entry) => createPaymentRow(entry.mode, String(entry.amount)));
        }
      }
    } catch {
      // Fallback to a single row if payment breakdown fetch fails.
    }

    setPaymentRows(rows);
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPaymentEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTransaction) {
      return;
    }

    const transaction = selectedTransaction;
    const rowKey = `${transaction.source_module}-${transaction.source_id}`;
    const normalizedBreakdown = paymentRows
      .map((row) => ({
        mode: row.mode,
        amount: Math.max(0, Number(row.amount) || 0),
      }))
      .filter((entry) => entry.mode && entry.amount > 0);
    const parsedAmount = normalizedBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
    setUpdatingTransactionKey(rowKey);
    setErrorMessage(null);

    try {
      if (transaction.source_module === "purchase") {
        const response = await api.get("/admin/purchases");
        const purchases = (response.data.data || []) as PurchasePayload[];
        const purchase = purchases.find((entry) => entry.id === transaction.source_id);

        if (!purchase) {
          throw new Error("Purchase record nahi mila.");
        }

        await api.put(`/admin/purchases/${purchase.id}`, {
          date: purchase.date,
          invoice_number: purchase.invoice_number,
          supplier_party_id: purchase.supplier_party_id || "",
          supplier_name: purchase.supplier_name,
          payment_status: parsedAmount >= purchase.total_amount ? "paid" : parsedAmount > 0 ? "partial" : "pending",
          payment_method: normalizedBreakdown[0]?.mode || transaction.payment_mode || "cash",
          notes: purchase.notes || "",
          items: purchase.items.map((item) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            buy_price: item.buy_price,
            line_total: item.line_total,
          })),
        });
      } else if (transaction.source_module === "offline_sale") {
        await api.put(`/admin/offline-sales/${transaction.source_id}/payment-breakdown`, {
          payment_breakdown: normalizedBreakdown,
        });
      } else if (transaction.source_module === "order") {
        await api.put(`/admin/orders/${transaction.source_id}/payment-breakdown`, {
          payment_breakdown: normalizedBreakdown,
        });
      } else {
        throw new Error("Is transaction type ke liye quick edit supported nahi hai.");
      }

      await refreshTransactions();
      setSuccessMessage("Payment details update ho gayi.");
      setIsPaymentModalOpen(false);
      setSelectedTransaction(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : (error as AxiosError<{ error?: string }>)?.response?.data?.error || "Status update nahi ho paya.";
      setErrorMessage(message);
    } finally {
      setUpdatingTransactionKey(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    const value = searchTerm.toLowerCase().trim();
    if (!value) {
      return transactions;
    }

    return transactions.filter((transaction) =>
      [
        transaction.type,
        transaction.reference_no,
        transaction.name,
        transaction.date,
        transaction.payment_status,
        transaction.source_module,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [transactions, searchTerm]);

  const summary = useMemo(() => {
    const sales = transactions.filter((item) => item.type.toLowerCase() === "sale");
    const purchases = transactions.filter((item) => item.type.toLowerCase() === "purchase");
    const unpaidCount = transactions.filter((item) => {
      const status = item.payment_status.toLowerCase();
      return status === "unpaid" || status === "pending" || status === "due" || status === "partial";
    }).length;

    return {
      salesQty: sales.reduce((sum, item) => sum + item.quantity, 0),
      purchaseQty: purchases.reduce((sum, item) => sum + item.quantity, 0),
      unpaidCount,
      totalEntries: transactions.length,
    };
  }, [transactions]);

  const paymentSummary = useMemo(() => {
    const received = paymentRows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0);
    const invoiceTotal = Number(selectedTransaction?.invoice_total || 0);
    return {
      received,
      remaining: Math.max(0, invoiceTotal - received),
    };
  }, [paymentRows, selectedTransaction?.invoice_total]);

  if (!isInitialized || loading) {
    return <PageLoader title="Loading product transactions" subtitle="Sale aur purchase history ready ki ja rahi hai." />;
  }

  return (
    <div className="min-h-screen bg-transparent py-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/products")}
              className="mt-1 h-10 w-10 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">Product Ledger</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-[2.5rem]">
                {product?.name || "Transactions"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 sm:text-base">
                Is product ka sale, purchase, customer/supplier naam, quantity, rate, aur paid/unpaid status yahan show ho raha hai.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.75rem] border border-zinc-200/80 bg-white px-5 py-4 shadow-[0_18px_50px_-45px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-zinc-500">Sales Qty</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{summary.salesQty}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ShoppingCart className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-zinc-200/80 bg-white px-5 py-4 shadow-[0_18px_50px_-45px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-zinc-500">Purchase Qty</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{summary.purchaseQty}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
                <Truck className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-zinc-200/80 bg-white px-5 py-4 shadow-[0_18px_50px_-45px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-zinc-500">Pending / Unpaid</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{summary.unpaidCount}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                <BarChart3 className="h-4 w-4" />
              </span>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-zinc-200/80 bg-white px-5 py-4 shadow-[0_18px_50px_-45px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-zinc-500">Entries</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{summary.totalEntries}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                <Package className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_24px_70px_-55px_rgba(15,23,42,0.35)]">
          <div className="border-b border-zinc-100 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-950">Transactions</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {product?.brand_info?.name || "No brand"} / {product?.category_info?.name || "No category"}
                </p>
              </div>

              <div className="relative min-w-0 sm:w-[22rem]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search name, invoice, status"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-11 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="border-t border-zinc-100 px-6 py-10 text-center text-sm font-medium text-red-600">{errorMessage}</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="border-t border-zinc-100 px-6 py-16 text-center">
              <div className="mx-auto max-w-md">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-900">No transactions found</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Is product ke liye abhi koi sale ya purchase entry nahi mili, ya search match nahi hua.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Type</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Invoice / Ref</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Name</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Date</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Qty</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Price / Unit</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Total</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Paid Via</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredTransactions.map((transaction) => (
                      <tr key={`${transaction.source_module}-${transaction.source_id}-${transaction.reference_no}`} className="transition-colors hover:bg-zinc-50/70">
                        <td className="px-6 py-5">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getTypeTone(transaction.type)}`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-6 py-5 font-semibold text-zinc-900">{transaction.reference_no || "-"}</td>
                        <td className="px-6 py-5 text-sm font-medium text-zinc-700">{transaction.name || "-"}</td>
                        <td className="px-6 py-5 text-sm text-zinc-600">{transaction.date}</td>
                        <td className="px-6 py-5 text-right text-sm font-medium text-zinc-700">{transaction.quantity}</td>
                        <td className="px-6 py-5 text-right text-sm font-medium text-zinc-700">{formatCurrency(transaction.price_per_unit)}</td>
                        <td className="px-6 py-5 text-right font-semibold text-zinc-900">{formatCurrency(transaction.line_total)}</td>
                        <td className="px-6 py-5 text-sm font-medium text-zinc-700">{formatModeLabel(transaction.payment_mode)}</td>
                        <td className="px-6 py-5">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(transaction.payment_status)}`}>
                            {formatStatusLabel(transaction.payment_status)}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={updatingTransactionKey === `${transaction.source_module}-${transaction.source_id}`}
                        onClick={() => handleOpenPaymentModal(transaction)}
                        className="h-10 rounded-full border border-zinc-200 px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        {updatingTransactionKey === `${transaction.source_module}-${transaction.source_id}`
                          ? "Updating..."
                          : "Edit Payment"}
                      </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 md:hidden">
                {filteredTransactions.map((transaction) => (
                  <article
                    key={`${transaction.source_module}-${transaction.source_id}-${transaction.reference_no}`}
                    className="rounded-[1.5rem] border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getTypeTone(transaction.type)}`}>
                          {transaction.type}
                        </span>
                        <p className="mt-3 text-sm font-semibold text-zinc-900">{transaction.name || "-"}</p>
                        <p className="mt-1 text-xs text-zinc-500">{transaction.reference_no || "-"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(transaction.payment_status)}`}>
                        {formatStatusLabel(transaction.payment_status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3 text-sm">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Date</div>
                        <div className="mt-1 font-semibold text-zinc-900">{transaction.date}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Quantity</div>
                        <div className="mt-1 font-semibold text-zinc-900">{transaction.quantity}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Price / Unit</div>
                        <div className="mt-1 font-semibold text-zinc-900">{formatCurrency(transaction.price_per_unit)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Total</div>
                        <div className="mt-1 font-semibold text-zinc-900">{formatCurrency(transaction.line_total)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Paid Via</div>
                        <div className="mt-1 font-semibold text-zinc-900">{formatModeLabel(transaction.payment_mode)}</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={updatingTransactionKey === `${transaction.source_module}-${transaction.source_id}`}
                        onClick={() => handleOpenPaymentModal(transaction)}
                        className="h-11 w-full rounded-2xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      >
                        {updatingTransactionKey === `${transaction.source_module}-${transaction.source_id}`
                          ? "Updating..."
                          : "Edit Payment"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedTransaction(null);
          setPaymentRows([createPaymentRow()]);
        }}
        title="Edit Payment"
        size="md"
      >
        {selectedTransaction ? (
          <form onSubmit={handleSubmitPaymentEdit} className="space-y-5">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Transaction</div>
              <div className="mt-2 text-lg font-bold text-zinc-900">{selectedTransaction.reference_no || "-"}</div>
              <div className="mt-1 text-sm text-zinc-500">{selectedTransaction.name || "-"}</div>
              <div className="mt-1 text-sm text-zinc-500">Invoice Total {formatCurrency(selectedTransaction.invoice_total || selectedTransaction.line_total)}</div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Rows</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={selectedTransaction.source_module === "purchase"}
                  onClick={() => setPaymentRows((current) => [...current, createPaymentRow(paymentOptions[0] || "cash")])}
                  className="rounded-full border border-zinc-200 px-3 text-xs"
                >
                  Add Row
                </Button>
              </div>

              {paymentRows.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto]">
                  <select
                    value={row.mode}
                    onChange={(event) =>
                      setPaymentRows((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, mode: event.target.value } : entry))
                      )
                    }
                    className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {paymentOptions.map((option) => (
                      <option key={`${row.id}-${option}`} value={option}>
                        {formatModeLabel(option)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(event) =>
                      setPaymentRows((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, amount: event.target.value } : entry))
                      )
                    }
                    className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Amount"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={paymentRows.length === 1}
                    onClick={() => setPaymentRows((current) => current.filter((entry) => entry.id !== row.id))}
                    className="h-12 rounded-2xl border border-zinc-200 px-4 text-xs"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Received Total</div>
                <div className="mt-2 text-lg font-bold text-zinc-900">{formatCurrency(paymentSummary.received)}</div>
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Remaining</div>
                <div className="mt-2 text-lg font-bold text-amber-700">{formatCurrency(paymentSummary.remaining)}</div>
              </div>
            </div>

            <p className="text-xs text-zinc-500">
              Jitna amount yahan fill karoge, utna hi received maana jayega. Baaki amount automatically due / remaining rahega.
              {selectedTransaction.source_module === "purchase" ? " Purchase abhi single payment mode fallback par hi chalega." : ""}
            </p>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsPaymentModalOpen(false)} className="rounded-2xl border border-zinc-200">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updatingTransactionKey === `${selectedTransaction.source_module}-${selectedTransaction.source_id}`}
                className="rounded-2xl"
              >
                {updatingTransactionKey === `${selectedTransaction.source_module}-${selectedTransaction.source_id}` ? "Saving..." : "Save Payment"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
      <SuccessPopup
        message={successMessage || ""}
        isVisible={Boolean(successMessage)}
        onClose={() => setSuccessMessage(null)}
      />
    </div>
  );
}
