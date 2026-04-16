"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil, Plus, ReceiptText, Search, Trash2, Truck } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { AxiosError } from "axios";
import { Product } from "@/types";
import {
  PurchaseEntry,
  PurchaseLineItem,
  PurchasePaymentMethod,
  PurchasePaymentStatus,
  normalizePurchaseEntry,
} from "@/lib/purchases";

type BankAccount = {
  name: string;
  balance: number;
};

type PartyOption = {
  party_id: string;
  name: string;
  type: string;
  contacts?: { contact_type: string; contact_value: string }[];
};

type PurchaseFormLine = {
  id: string;
  product_id: string;
  quantity: string;
  buy_price: string;
};

type PurchaseForm = {
  date: string;
  invoice_number: string;
  supplier_party_id: string;
  supplier_name: string;
  payment_status: PurchasePaymentStatus;
  payment_method: PurchasePaymentMethod;
  notes: string;
  items: PurchaseFormLine[];
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const createLine = (): PurchaseFormLine => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product_id: "",
  quantity: "",
  buy_price: "",
});

const emptyForm = (): PurchaseForm => ({
  date: todayValue(),
  invoice_number: "",
  supplier_party_id: "",
  supplier_name: "",
  payment_status: "paid",
  payment_method: "cash",
  notes: "",
  items: [createLine()],
});

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getPaymentStatusClasses(status: PurchasePaymentStatus) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700";
  if (status === "partial") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function formatPaymentLabel(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function AdminPurchasesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<PartyOption[]>([]);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PurchaseForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<string[]>(["cash", "credit"]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isSupplierSubmitting, setIsSupplierSubmitting] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "" });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) {
      router.push("/");
      return;
    }

    const fetchData = async () => {
      try {
        const [productRes, supplierRes, purchaseRes, settingsRes] = await Promise.allSettled([
          api.get("/admin/products"),
          api.get("/admin/arp/parties"),
          api.get("/admin/purchases"),
          api.get("/admin/settings"),
        ]);

        if (productRes.status === "fulfilled") {
          setProducts(productRes.value.data.data?.items || []);
        }

        if (supplierRes.status === "fulfilled") {
          const parties = supplierRes.value.data.data || [];
          setSuppliers(parties.filter((party: PartyOption) => party.type === "supplier"));
        }

        if (purchaseRes.status === "fulfilled") {
          setPurchases(
            (purchaseRes.value.data.data || [])
              .map(normalizePurchaseEntry)
              .sort((a: PurchaseEntry, b: PurchaseEntry) => b.date.localeCompare(a.date))
          );
        }

        if (settingsRes.status === "fulfilled") {
          const bankAccounts: BankAccount[] = Array.isArray(settingsRes.value.data.data?.bank_accounts) ? settingsRes.value.data.data.bank_accounts : [];
          setPaymentMethodOptions(["cash", ...bankAccounts.map((account) => account.name.trim()).filter(Boolean), "credit"]);
        }
      } catch (error) {
        console.error("Failed to initialize purchase page", error);
      } finally {
        setLoading(false);
      }
    };

    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) {
      fetchData();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const supplierOptions = useMemo(() => {
    return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers]);

  const getSupplierContact = (supplier: PartyOption, type: string) =>
    supplier.contacts?.find((contact) => contact.contact_type === type)?.contact_value || "";

  const purchaseTotal = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const buyPrice = Number(item.buy_price);
        return sum + (Number.isNaN(quantity) || Number.isNaN(buyPrice) ? 0 : quantity * buyPrice);
      }, 0),
    [form.items]
  );

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return purchases.filter((purchase) => {
      const matchesSearch =
        !query ||
        purchase.invoice_number.toLowerCase().includes(query) ||
        purchase.supplier_name.toLowerCase().includes(query) ||
        purchase.items.some((item) => item.product_name.toLowerCase().includes(query));

      const matchesSupplier = supplierFilter === "all" || purchase.supplier_name === supplierFilter;
      const matchesPayment = paymentFilter === "all" || purchase.payment_status === paymentFilter;

      const purchaseDate = new Date(purchase.date);
      const matchesDate =
        dateFilter === "all" ||
        (dateFilter === "today" && purchaseDate >= startOfToday) ||
        (dateFilter === "week" && purchaseDate >= startOfWeek) ||
        (dateFilter === "month" && purchaseDate >= startOfMonth);

      return matchesSearch && matchesSupplier && matchesPayment && matchesDate;
    });
  }, [purchases, search, supplierFilter, paymentFilter, dateFilter]);

  const summary = useMemo(() => {
    const totalAmount = purchases.reduce((sum, purchase) => sum + purchase.total_amount, 0);
    const totalUnits = purchases.reduce(
      (sum, purchase) => sum + purchase.items.reduce((innerSum, item) => innerSum + item.quantity, 0),
      0
    );
    const pendingPayments = purchases.filter((purchase) => purchase.payment_status !== "paid").length;
    const suppliersCovered = new Set(purchases.map((purchase) => purchase.supplier_name).filter(Boolean)).size;

    return {
      totalPurchases: purchases.length,
      totalAmount,
      totalUnits,
      pendingPayments,
      suppliersCovered,
    };
  }, [purchases]);

  const resetForm = () => {
    setEditingId(null);
    setFormError(null);
    setForm(emptyForm());
  };

  const refreshSuppliers = async () => {
    const res = await api.get("/admin/arp/parties");
    const parties = res.data.data || [];
    setSuppliers(parties.filter((party: PartyOption) => party.type === "supplier"));
  };

  const handleSupplierSelect = (value: string) => {
    if (value === "__add_new__") {
      setIsSupplierModalOpen(true);
      return;
    }

    const selectedSupplier = suppliers.find((supplier) => supplier.party_id === value);
    setForm((current) => ({
      ...current,
      supplier_party_id: value,
      supplier_name: selectedSupplier?.name || current.supplier_name,
    }));
  };

  const handleCreateSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSupplierSubmitting(true);
    setSupplierFormError(null);
    try {
      const payload = {
        name: supplierForm.name.trim(),
        type: "supplier",
        contacts: [
          { contact_type: "phone", contact_value: supplierForm.phone.trim() },
          { contact_type: "email", contact_value: supplierForm.email.trim() },
        ],
      };

      const res = await api.post("/admin/arp/parties", payload);
      const createdSupplier = res.data.data as PartyOption;
      await refreshSuppliers();
      setForm((current) => ({
        ...current,
        supplier_party_id: createdSupplier.party_id,
        supplier_name: createdSupplier.name || current.supplier_name,
      }));
      setSupplierForm({ name: "", phone: "", email: "" });
      setIsSupplierModalOpen(false);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as { response?: { data?: { error?: string } } }).response?.data?.error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to create supplier"
          : "Failed to create supplier";
      setSupplierFormError(message);
    } finally {
      setIsSupplierSubmitting(false);
    }
  };

  const updateLine = (lineId: string, field: keyof PurchaseFormLine, value: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === lineId ? { ...item, [field]: value } : item)),
    }));
  };

  const addLine = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, createLine()],
    }));
  };

  const removeLine = (lineId: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((item) => item.id !== lineId),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.date) {
      setFormError("Purchase date required");
      return;
    }

    if (!form.supplier_party_id) {
      setFormError("Supplier selection required");
      return;
    }

    const validItems: PurchaseLineItem[] = form.items
      .map((item) => {
        const product = products.find((entry) => entry.id === item.product_id);
        const quantity = Number(item.quantity);
        const buyPrice = Number(item.buy_price);

        if (!product || Number.isNaN(quantity) || quantity <= 0 || Number.isNaN(buyPrice) || buyPrice <= 0) {
          return null;
        }

        return {
          id: item.id,
          product_id: product.id,
          product_name: product.name,
          quantity,
          buy_price: buyPrice,
          line_total: quantity * buyPrice,
        };
      })
      .filter(Boolean) as PurchaseLineItem[];

    if (validItems.length === 0) {
      setFormError("At least one valid product line required");
      return;
    }

    const entry = {
      date: form.date,
      invoice_number: form.invoice_number.trim(),
      supplier_party_id: form.supplier_party_id,
      supplier_name: suppliers.find((supplier) => supplier.party_id === form.supplier_party_id)?.name || "",
      payment_status: form.payment_status,
      payment_method: form.payment_method,
      notes: form.notes.trim(),
      items: validItems,
      total_amount: validItems.reduce((sum, item) => sum + item.line_total, 0),
    };

    try {
      if (editingId) {
        await api.put(`/admin/purchases/${editingId}`, entry);
      } else {
        await api.post("/admin/purchases", entry);
      }

      const purchaseRes = await api.get("/admin/purchases");
      setPurchases(
        (purchaseRes.data.data || [])
          .map(normalizePurchaseEntry)
          .sort((a: PurchaseEntry, b: PurchaseEntry) => b.date.localeCompare(a.date))
      );
      resetForm();
    } catch (error: unknown) {
      const message =
        (error as AxiosError<{ error?: string }>)?.response?.data?.error ||
        "Failed to save purchase";
      setFormError(message);
    }
  };

  const handleEdit = (purchase: PurchaseEntry) => {
    setEditingId(purchase.id);
    setFormError(null);
    setForm({
      date: purchase.date,
      invoice_number: purchase.invoice_number,
      supplier_party_id: purchase.supplier_party_id || "",
      supplier_name: purchase.supplier_name,
      payment_status: purchase.payment_status,
      payment_method: purchase.payment_method,
      notes: purchase.notes,
      items: purchase.items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: String(item.quantity),
        buy_price: String(item.buy_price),
      })),
    });
  };

  const handleDelete = async (purchaseId: string) => {
    try {
      await api.delete(`/admin/purchases/${purchaseId}`);
      const purchaseRes = await api.get("/admin/purchases");
      setPurchases(
        (purchaseRes.data.data || [])
          .map(normalizePurchaseEntry)
          .sort((a: PurchaseEntry, b: PurchaseEntry) => b.date.localeCompare(a.date))
      );

      if (editingId === purchaseId) {
        resetForm();
      }
    } catch (error: unknown) {
      const message =
        (error as AxiosError<{ error?: string }>)?.response?.data?.error ||
        "Failed to delete purchase";
      setFormError(message);
    }
  };

  if (!isInitialized || loading) {
    return <div className="p-12 text-center">Loading Add Purchase...</div>;
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
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl md:text-4xl">ADD PURCHASE</h1>
              <p className="mt-1 text-sm text-zinc-500 md:mt-2 md:text-base">
                Supplier se liya gaya stock, buy price, bill reference aur payment status yahin capture karo.
              </p>
            </div>
          </div>
          
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total Purchases", value: summary.totalPurchases },
            { label: "Total Purchase Amount", value: formatCurrency(summary.totalAmount) },
            { label: "Total Units Purchased", value: summary.totalUnits },
            { label: "Pending Payments", value: summary.pendingPayments },
            { label: "Suppliers Covered", value: summary.suppliersCovered },
          ].map((card) => (
            <div key={card.label} className="rounded-[1.6rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{card.label}</div>
              <div className="mt-3 text-2xl font-black text-zinc-900 sm:text-3xl">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">{editingId ? "Edit Purchase" : "Purchase Entry Form"}</h2>
                <p className="mt-1 text-sm text-zinc-500">Ek bill mein multiple products add kar sakte ho.</p>
              </div>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={resetForm}>
                Reset
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {formError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {formError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Purchase Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Invoice / Bill Number</label>
                  <input
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="INV-2026-001"
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
  
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Supplier</label>
                  <div className="flex gap-2">
                    <select
                      value={form.supplier_party_id}
                      onChange={(e) => handleSupplierSelect(e.target.value)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select Supplier</option>
                      {supplierOptions.map((supplier) => (
                        <option key={supplier.party_id} value={supplier.party_id}>
                          {supplier.name}{getSupplierContact(supplier, "phone") ? ` - ${getSupplierContact(supplier, "phone")}` : ""}
                        </option>
                      ))}
                      <option value="__add_new__">+ Add New Supplier</option>
                    </select>
                    <Button type="button" variant="outline" className="h-12 rounded-2xl px-4" onClick={() => setIsSupplierModalOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Status</label>
                  <select
                    value={form.payment_status}
                    onChange={(e) => setForm({ ...form, payment_status: e.target.value as PurchasePaymentStatus })}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value as PurchasePaymentMethod })}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {paymentMethodOptions.map((option) => (
                      <option key={option} value={option}>{formatPaymentLabel(option)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Supplier Name</label>
                  <input
                    value={form.supplier_name}
                    onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                  {form.supplier_party_id
                    ? "Selected supplier purchase history aur reporting ke saath linked rahega."
                    : "Supplier select karte hi form us party record ke saath connect ho jayega."}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-zinc-100 bg-zinc-50/70 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-700">Purchase Items</h3>
                    <p className="mt-1 text-sm text-zinc-500">Product, quantity aur buy price fill karo.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Line
                  </Button>
                </div>

                <div className="space-y-4">
                  {form.items.map((item, index) => {
                    const quantity = Number(item.quantity);
                    const buyPrice = Number(item.buy_price);
                    const lineTotal =
                      Number.isNaN(quantity) || Number.isNaN(buyPrice) ? 0 : Math.max(0, quantity * buyPrice);

                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-100 bg-white p-4 md:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_auto]"
                      >
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                            Product {index + 1}
                          </label>
                          <select
                            value={item.product_id}
                            onChange={(e) => updateLine(item.id, "product_id", e.target.value)}
                            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">Select Product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLine(item.id, "quantity", e.target.value)}
                            placeholder="10"
                            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Buy Price</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.buy_price}
                            onChange={(e) => updateLine(item.id, "buy_price", e.target.value)}
                            placeholder="85"
                            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Line Total</label>
                          <div className="flex h-11 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900">
                            {formatCurrency(lineTotal)}
                          </div>
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(item.id)}
                            className="h-11 w-11 rounded-xl border border-zinc-100 p-0 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional remarks for this purchase"
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-4">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Purchase Total</div>
                <div className="mt-2 text-3xl font-black text-zinc-900">{formatCurrency(purchaseTotal)}</div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="h-12 flex-1 rounded-2xl">
                  {editingId ? "Update Purchase" : "Save Purchase"}
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
            <div className="mb-5 flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">Purchase History</h2>
                <p className="mt-1 text-sm text-zinc-500">Yahin se purane purchase records dekh, filter aur edit kar sakte ho.</p>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search invoice, supplier, product..."
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Suppliers</option>
                {supplierOptions.map((supplier) => (
                  <option key={supplier.party_id} value={supplier.name}>
                    {supplier.name}
                  </option>
                ))}
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Payment Status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            <div className="space-y-4">
              {filteredPurchases.map((purchase) => (
                <div key={purchase.id} className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                          {formatDate(purchase.date)}
                        </span>
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${getPaymentStatusClasses(purchase.payment_status)}`}>
                          {purchase.payment_status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-lg font-bold text-zinc-900">
                        <Truck className="h-4 w-4 text-zinc-400" />
                        {purchase.supplier_name}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500">
                        {purchase.invoice_number ? `Invoice: ${purchase.invoice_number}` : "No invoice number"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-zinc-900">{formatCurrency(purchase.total_amount)}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">{purchase.payment_method}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {purchase.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-sm">
                        <div>
                          <div className="font-semibold text-zinc-900">{item.product_name}</div>
                          <div className="text-xs text-zinc-500">
                            Qty {item.quantity} x {formatCurrency(item.buy_price)}
                          </div>
                        </div>
                        <div className="font-semibold text-zinc-900">{formatCurrency(item.line_total)}</div>
                      </div>
                    ))}
                  </div>

                  {purchase.notes && (
                    <div className="mt-4 rounded-xl border border-zinc-100 bg-white px-3 py-3 text-sm text-zinc-600">
                      {purchase.notes}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(purchase)} className="rounded-xl">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(purchase.id)} className="rounded-xl text-red-500 hover:bg-red-50">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}

              {filteredPurchases.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
                  <ReceiptText className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
                  Purchase records abhi nahi hain. Left side form se pehla purchase add kar sakte ho.
                </div>
              )}
            </div>
          </section>
        </div>

        <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title="Add New Supplier">
          <form onSubmit={handleCreateSupplier} className="space-y-5">
            {supplierFormError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {supplierFormError}
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Supplier Name</label>
              <Input
                required
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="Supplier name"
                className="h-12 rounded-2xl"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Phone Number</label>
              <Input
                required
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                placeholder="10-digit phone"
                maxLength={10}
                className="h-12 rounded-2xl"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Email Address</label>
              <Input
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                placeholder="Optional email"
                className="h-12 rounded-2xl"
              />
            </div>

            <Button type="submit" className="h-12 w-full rounded-2xl" isLoading={isSupplierSubmitting}>
              Create Supplier
            </Button>
          </form>
        </Modal>
      </div>
    </div>
  );
}
