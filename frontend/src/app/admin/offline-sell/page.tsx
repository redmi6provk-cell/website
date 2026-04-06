"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import api from "@/lib/api";
import { Order, Product } from "@/types";

type PaymentMode = string;
type SaleStatus = "paid" | "partial" | "due";
type BankAccount = { name: string; balance: number };
type SaleItem = { id: string; product_id: string; product_name: string; quantity: number; sell_price: number; discount_value: number; line_total: number };
type Sale = {
  id: string; bill_number: string; sale_date: string; customer_name: string; customer_phone: string; shop_name: string;
  payment_mode: PaymentMode; notes: string; subtotal: number; discount_total: number; final_total: number;
  amount_received: number; balance_due: number; status: SaleStatus; items: SaleItem[];
};
type HistoryEntry = {
  id: string;
  source: "offline_sale" | "confirmed_order";
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_phone: string;
  shop_name: string;
  payment_mode: string;
  status: string;
  total: number;
  amount_received: number;
  balance_due: number;
  item_count: number;
  notes: string;
  sale?: Sale;
  order?: Order;
};
type RawSaleItem = Partial<SaleItem> & { id?: string | number; product_id?: string | number; product?: { name?: string } };
type RawSale = Partial<Omit<Sale, "items">> & { id?: string | number; items?: RawSaleItem[] };
type FormLine = { id: string; product_id: string; quantity: string; sell_price: string; discount_value: string };
type Contact = { contact_type: string; contact_value: string };
type Party = { party_id: string; name: string; type: string; created_at: string; contacts?: Contact[] };
type FormState = {
  bill_number: string; sale_date: string; customer_name: string; customer_phone: string; shop_name: string; payment_mode: PaymentMode;
  notes: string; amount_received: string; items: FormLine[];
};

const todayValue = () => new Date().toISOString().slice(0, 10);
const newLine = (): FormLine => ({ id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, product_id: "", quantity: "1", sell_price: "", discount_value: "0" });
const emptyForm = (): FormState => ({ bill_number: "", sale_date: todayValue(), customer_name: "Walk-in Customer", customer_phone: "", shop_name: "", payment_mode: "cash", notes: "", amount_received: "", items: [newLine()] });
const money = (v: number) => `Rs. ${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateLabel = (v: string) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const formatPaymentLabel = (value: string) => value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return fallback;
};
const normalizeSale = (e: RawSale): Sale => ({
  id: String(e.id), bill_number: e.bill_number || "", sale_date: String(e.sale_date || "").slice(0, 10), customer_name: e.customer_name || "Walk-in Customer",
  customer_phone: e.customer_phone || "", shop_name: e.shop_name || "", payment_mode: (e.payment_mode || "cash") as PaymentMode, notes: e.notes || "",
  subtotal: Number(e.subtotal || 0), discount_total: Number(e.discount_total || 0), final_total: Number(e.final_total || 0), amount_received: Number(e.amount_received || 0),
  balance_due: Number(e.balance_due || 0), status: (e.status || "paid") as SaleStatus,
  items: Array.isArray(e.items) ? e.items.map((i: RawSaleItem) => ({ id: String(i.id), product_id: String(i.product_id), product_name: i.product_name || i.product?.name || "", quantity: Number(i.quantity || 0), sell_price: Number(i.sell_price || 0), discount_value: Number(i.discount_value || 0), line_total: Number(i.line_total || 0) })) : [],
});
const getOrderCustomerName = (order: Order) => order.customer_name || order.user?.name || "Customer";
const getOrderCustomerPhone = (order: Order) => order.customer_phone || order.user?.phone || "";
const getOrderShopName = (order: Order) => order.shop_name || order.user?.shop_name || "";
const getOrderInvoiceNumber = (order: Order) => order.invoice_number?.trim() || `ORD-${order.id.slice(0, 8).toUpperCase()}`;
const normalizeOrderToHistory = (order: Order): HistoryEntry => ({
  id: order.id,
  source: "confirmed_order",
  invoice_number: getOrderInvoiceNumber(order),
  date: String(order.created_at || "").slice(0, 10),
  customer_name: getOrderCustomerName(order),
  customer_phone: getOrderCustomerPhone(order),
  shop_name: getOrderShopName(order),
  payment_mode: order.payment_mode || "cod",
  status: order.status,
  total: Number(order.total || 0),
  amount_received: order.payment_status === "paid" ? Number(order.total || 0) : 0,
  balance_due: order.payment_status === "paid" ? 0 : Number(order.total || 0),
  item_count: Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0,
  notes: order.notes || "",
  order,
});
const normalizeSaleToHistory = (sale: Sale): HistoryEntry => ({
  id: sale.id,
  source: "offline_sale",
  invoice_number: sale.bill_number,
  date: sale.sale_date,
  customer_name: sale.customer_name,
  customer_phone: sale.customer_phone,
  shop_name: sale.shop_name,
  payment_mode: sale.payment_mode,
  status: sale.status,
  total: sale.final_total,
  amount_received: sale.amount_received,
  balance_due: sale.balance_due,
  item_count: sale.items.reduce((sum, item) => sum + item.quantity, 0),
  notes: sale.notes,
  sale,
});

export default function AdminOfflineSellPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<string[]>(["cash", "card", "mixed"]);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isPartySubmitting, setIsPartySubmitting] = useState(false);
  const [partyForm, setPartyForm] = useState({ name: "", phone: "", email: "" });

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const loadNextInvoiceNumber = async () => {
    try {
      const res = await api.get("/admin/offline-sales/next-invoice-number");
      const nextInvoiceNumber = res.data.data?.invoice_number || "";
      setForm((current) => current.bill_number ? current : { ...current, bill_number: nextInvoiceNumber });
    } catch (fetchError) {
      console.error("Failed to load next invoice number", fetchError);
    }
  };

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) router.push("/");
    const load = async () => {
      try {
        const [pRes, sRes, ordersRes, settingsRes, partiesRes] = await Promise.all([api.get("/products"), api.get("/admin/offline-sales"), api.get("/admin/orders"), api.get("/admin/settings"), api.get("/admin/arp/parties")]);
        setProducts(pRes.data.data?.items || []);
        setSales((sRes.data.data || []).map(normalizeSale));
        setConfirmedOrders((ordersRes.data.data || []).filter((order: Order) => order.status === "confirmed"));
        const bankAccounts: BankAccount[] = Array.isArray(settingsRes.data.data?.bank_accounts) ? settingsRes.data.data.bank_accounts : [];
        const bankOptions = bankAccounts.map((account) => account.name.trim()).filter(Boolean);
        setPaymentOptions(["cash", ...bankOptions, "card", "mixed"]);
        setCustomers(((partiesRes.data.data || []) as Party[]).filter((party) => party.type === "customer"));
      } catch (e) {
        console.error("Failed to load offline sales", e);
      } finally {
        setLoading(false);
      }
    };
    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) void load();
  }, [isInitialized, isAuthenticated, user, router]);

  useEffect(() => {
    if (!editingId) void loadNextInvoiceNumber();
  }, [editingId]);

  const linePreview = useMemo(() => form.items.map((line) => {
    const product = products.find((p) => p.id === line.product_id);
    const quantity = Number(line.quantity) || 0;
    const sellPrice = Number(line.sell_price) || 0;
    const discountValue = Math.max(0, Math.min(Number(line.discount_value) || 0, quantity * sellPrice));
    return { id: line.id, product, quantity, sellPrice, discountValue, lineTotal: quantity * sellPrice - discountValue, stockIssue: !!product && quantity > product.stock };
  }), [form.items, products]);

  const summary = useMemo(() => {
    const subtotal = linePreview.reduce((s, l) => s + l.quantity * l.sellPrice, 0);
    const discountTotal = linePreview.reduce((s, l) => s + l.discountValue, 0);
    const finalTotal = subtotal - discountTotal;
    const amountReceived = Math.max(0, Number(form.amount_received) || 0);
    return { subtotal, discountTotal, finalTotal, amountReceived, balanceDue: Math.max(0, finalTotal - amountReceived), stockIssue: linePreview.some((l) => l.stockIssue) };
  }, [linePreview, form.amount_received]);

  const historyEntries = useMemo(
    () =>
      [...sales.map(normalizeSaleToHistory), ...confirmedOrders.map(normalizeOrderToHistory)].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [sales, confirmedOrders]
  );

  const cards = [
    { label: "History Entries", value: historyEntries.length, tone: "text-zinc-900" },
    { label: "Total Sales", value: money(historyEntries.reduce((s, sale) => s + sale.total, 0)), tone: "text-emerald-700" },
    { label: "Pending / Due", value: historyEntries.filter((sale) => !["paid", "confirmed"].includes(sale.status)).length, tone: "text-amber-700" },
    { label: "Items Sold", value: historyEntries.reduce((s, sale) => s + sale.item_count, 0), tone: "text-blue-700" },
  ];

  const resetForm = () => {
    setEditingId(null);
    setError(null);
    setSelectedCustomerId("");
    setForm(emptyForm());
    void loadNextInvoiceNumber();
  };
  const getPartyContact = (party: Party, type: string) => party.contacts?.find((contact) => contact.contact_type === type)?.contact_value || "";
  const updateLine = (id: string, field: keyof FormLine, value: string) => setForm((c) => ({ ...c, items: c.items.map((i) => i.id === id ? { ...i, [field]: value } : i) }));
  const addLine = () => setForm((c) => ({ ...c, items: [...c.items, newLine()] }));
  const removeLine = (id: string) => setForm((c) => ({ ...c, items: c.items.length === 1 ? c.items : c.items.filter((i) => i.id !== id) }));
  const selectProduct = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    setForm((c) => ({ ...c, items: c.items.map((i) => i.id === id ? { ...i, product_id: productId, sell_price: product ? String(product.price) : "" } : i) }));
  };
  const refreshSales = async () => {
    const [salesRes, ordersRes] = await Promise.all([api.get("/admin/offline-sales"), api.get("/admin/orders")]);
    setSales((salesRes.data.data || []).map(normalizeSale));
    setConfirmedOrders((ordersRes.data.data || []).filter((order: Order) => order.status === "confirmed"));
  };
  const refreshCustomers = async () => {
    const res = await api.get("/admin/arp/parties");
    setCustomers(((res.data.data || []) as Party[]).filter((party) => party.type === "customer"));
  };
  const handleCustomerSelect = (value: string) => {
    if (value === "__add_new__") {
      setSelectedCustomerId("");
      setIsPartyModalOpen(true);
      return;
    }

    setSelectedCustomerId(value);
    const customer = customers.find((party) => party.party_id === value);
    if (!customer) {
      return;
    }

    setForm((current) => ({
      ...current,
      customer_name: customer.name || current.customer_name,
      customer_phone: getPartyContact(customer, "phone") || current.customer_phone,
    }));
  };
  const handleCreateParty = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsPartySubmitting(true);
    try {
      const payload = {
        name: partyForm.name.trim(),
        type: "customer",
        contacts: [
          { contact_type: "phone", contact_value: partyForm.phone.trim() },
          { contact_type: "email", contact_value: partyForm.email.trim() },
        ],
      };
      const res = await api.post("/admin/arp/parties", payload);
      const createdParty = res.data.data as Party;
      await refreshCustomers();
      setSelectedCustomerId(createdParty.party_id);
      setForm((current) => ({
        ...current,
        customer_name: createdParty.name || current.customer_name,
        customer_phone: getPartyContact(createdParty, "phone") || partyForm.phone.trim() || current.customer_phone,
      }));
      setPartyForm({ name: "", phone: "", email: "" });
      setIsPartyModalOpen(false);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to create customer party"));
    } finally {
      setIsPartySubmitting(false);
    }
  };

  const printSale = (sale: Sale) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const rows = sale.items.map((i) => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${money(i.sell_price)}</td><td>${money(i.line_total)}</td></tr>`).join("");
    w.document.write(`
      <html>
        <head>
          <title>${sale.bill_number}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; background: #ffffff; }
            .invoice { width: 100%; max-width: 794px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 18px; margin-bottom: 24px; }
            .logo-space { width: 84px; height: 84px; border: 1px dashed #9ca3af; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 12px; }
            .header h1 { margin: 0; font-size: 30px; letter-spacing: 0.04em; }
            .header h2 { margin: 8px 0 6px; font-size: 18px; font-weight: 600; }
            .header h3 { margin: 0; font-size: 13px; font-weight: 500; color: #4b5563; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
            .meta-card { border: 1px solid #d1d5db; padding: 14px 16px; min-height: 108px; }
            .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; margin-bottom: 6px; }
            .meta-value { font-size: 15px; font-weight: 700; margin-bottom: 10px; }
            .meta-text { font-size: 13px; line-height: 1.6; color: #374151; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 10px 12px; font-size: 13px; }
            th { background: #f3f4f6; text-align: left; }
            .summary { width: 320px; margin-left: auto; margin-top: 24px; border: 1px solid #d1d5db; }
            .summary-row { display: flex; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
            .summary-row:last-child { border-bottom: 0; }
            .summary-total { background: #111827; color: #ffffff; font-size: 16px; font-weight: 700; }
            .footer { margin-top: 36px; text-align: center; font-size: 13px; color: #4b5563; }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <div class="logo-space">Logo</div>      
              <h1>Shivshakti Traders</h1>
              <h2>Deals in Cosmetic & FMCG</h2>
              <h3>123 Main Market Road, BADALAPUR, THHANE, MAHARASTRA 421501</h3>
            </div>

            <div class="meta">
              <div class="meta-card">
                <div class="meta-label">Invoice Details</div>
                <div class="meta-value">${sale.bill_number}</div>
                <div class="meta-text"><strong>Date:</strong> ${dateLabel(sale.sale_date)}</div>
                <div class="meta-text"><strong>Customer Name:</strong> ${sale.customer_name}</div>
              </div>
              <div class="meta-card">
                <div class="meta-label">Customer Details</div>
                <div class="meta-text"><strong>Shop:</strong> ${sale.shop_name || "N/A"}</div>
                <div class="meta-text"><strong>Phone:</strong> ${sale.customer_phone || "N/A"}</div>
                <div class="meta-text"><strong>Payment Mode:</strong> ${formatPaymentLabel(sale.payment_mode)}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Quantity (Qty)</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <div class="summary">
              <div class="summary-row">
                <span>Subtotal</span>
                <strong>${money(sale.subtotal)}</strong>
              </div>
              <div class="summary-row">
                <span>Discount</span>
                <strong>${money(sale.discount_total)}</strong>
              </div>
              <div class="summary-row summary-total">
                <span>Total Amount</span>
                <span>${money(sale.final_total)}</span>
              </div>
            </div>

            <div class="footer">Thank You for Your Business</div>
          </div>
        </body>
      </html>
    `);
    w.document.close(); w.focus(); w.print();
  };

  const saveSale = async (printAfterSave: boolean) => {
    if (!form.sale_date) return setError("Sale date required");
    const items = linePreview.filter((l) => l.product && l.quantity > 0).map((l) => ({ product_id: l.product!.id, product_name: l.product!.name, quantity: l.quantity, sell_price: l.sellPrice, discount_value: l.discountValue, line_total: l.lineTotal }));
    if (items.length === 0) return setError("At least one valid item required");
    if (summary.stockIssue) return setError("One or more selected products do not have enough stock");
    const payload = { bill_number: form.bill_number.trim(), sale_date: form.sale_date, customer_name: form.customer_name.trim() || "Walk-in Customer", customer_phone: form.customer_phone.trim(), shop_name: form.shop_name.trim(), payment_mode: form.payment_mode, notes: form.notes.trim(), amount_received: summary.amountReceived, items };
    try {
      const res = editingId ? await api.put(`/admin/offline-sales/${editingId}`, payload) : await api.post("/admin/offline-sales", payload);
      const saved = normalizeSale(res.data.data);
      await refreshSales();
      resetForm();
      if (printAfterSave) printSale(saved);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to save offline sale"));
    }
  };

  if (!isInitialized || loading) return <div className="p-12 text-center">Loading OFFLINE Sale...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-6 md:py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="rounded-full"><ChevronLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl md:text-4xl">OFFLINE Sale</h1><p className="mt-1 text-sm text-zinc-500 md:mt-2 md:text-base">Walk-in billing, manual sale entry, stock reduction aur invoice print yahin se manage karo.</p></div>
          </div>
          <Button type="button" variant="outline" className="h-12 rounded-2xl px-6" onClick={() => router.push("/admin/offline-sell/history")}>
            Open Sales History
          </Button>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <div key={card.label} className="rounded-[1.6rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5"><div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{card.label}</div><div className={`mt-3 text-2xl font-black sm:text-3xl ${card.tone}`}>{card.value}</div></div>)}
        </div>

        <div className="space-y-8">
          <section className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div><h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">{editingId ? "Edit Offline Sale" : "Offline Billing Form"}</h2><p className="mt-1 text-sm text-zinc-500">Customer info, items, totals aur payment capture karo.</p></div>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={resetForm}>Cancel</Button>
            </div>

            <div className="space-y-5">
              {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Customer Party</label>
                  <div className="flex gap-2">
                    <select value={selectedCustomerId} onChange={(e) => handleCustomerSelect(e.target.value)} className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500">
                      <option value="">Select customer</option>
                      {customers.map((customer) => (
                        <option key={customer.party_id} value={customer.party_id}>
                          {customer.name}{getPartyContact(customer, "phone") ? ` - ${getPartyContact(customer, "phone")}` : ""}
                        </option>
                      ))}
                      <option value="__add_new__">+ Add New Party</option>
                    </select>
                    <Button type="button" variant="outline" className="h-12 rounded-2xl px-4" onClick={() => setIsPartyModalOpen(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Customer Phone</label><input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="Optional" className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Customer Name</label><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value, })} className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
                <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Shop Name</label><input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} placeholder="Optional" className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Invoice Number</label><input value={form.bill_number} onChange={(e) => setForm({ ...form, bill_number: e.target.value })} className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 outline-none focus:ring-2 focus:ring-green-500" /></div>
                <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Sale Date</label><input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
                <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Mode</label><select value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value as PaymentMode })} className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500">{paymentOptions.map((option) => <option key={option} value={option}>{formatPaymentLabel(option)}</option>)}</select></div>
              </div>

              <div className="rounded-[1.8rem] border border-zinc-100 bg-zinc-50/70 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div><h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-700">Items Section</h3><p className="mt-1 text-sm text-zinc-500">Product select, quantity, sell price, discount aur line total.</p></div>
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Add Item</Button>
                </div>

                <div className="space-y-4">
                  {form.items.map((line) => {
                    const preview = linePreview.find((item) => item.id === line.id);
                    return (
                      <div key={line.id} className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-100 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.95fr)_auto] xl:items-end">
                        <div className="flex h-full flex-col">
                          <label className="mb-2 block min-h-[2rem] text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Product</label>
                          <select value={line.product_id} onChange={(e) => selectProduct(line.id, e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-green-500">
                            <option value="">Select Product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <div className={`mt-2 min-h-[1rem] text-xs ${preview?.stockIssue ? "text-red-600" : "text-zinc-500"}`}>{preview?.product ? `Available stock: ${preview.product.stock}` : ""}</div>
                        </div>
                        <div className="flex h-full flex-col">
                          <label className="mb-2 block min-h-[2rem] text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Qty</label>
                          <input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.id, "quantity", e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div className="flex h-full flex-col">
                          <label className="mb-2 block min-h-[2rem] text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Sell Price</label>
                          <input type="number" min="0" step="0.01" value={line.sell_price} onChange={(e) => updateLine(line.id, "sell_price", e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div className="flex h-full flex-col">
                          <label className="mb-2 block min-h-[2rem] text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Discount</label>
                          <input type="number" min="0" step="0.01" value={line.discount_value} onChange={(e) => updateLine(line.id, "discount_value", e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div className="flex h-full flex-col">
                          <label className="mb-2 block min-h-[2rem] text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Line Total</label>
                          <div className="flex h-11 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900">{money(preview?.lineTotal || 0)}</div>
                        </div>
                        <div className="flex h-full items-end xl:justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(line.id)} className="h-11 w-full rounded-xl border border-zinc-100 p-0 text-red-500 hover:bg-red-50 sm:w-11"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Notes</label><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional sale notes" className="w-full rounded-2xl border border-zinc-200 p-4 text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Summary</div><div className="mt-4 space-y-2 text-sm text-zinc-600"><div className="flex items-center justify-between"><span>Subtotal</span><span className="font-semibold text-zinc-900">{money(summary.subtotal)}</span></div><div className="flex items-center justify-between"><span>Discount Total</span><span className="font-semibold text-zinc-900">{money(summary.discountTotal)}</span></div><div className="flex items-center justify-between"><span>Final Total</span><span className="font-bold text-green-700">{money(summary.finalTotal)}</span></div></div></div>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Amount Received</label><input type="number" min="0" step="0.01" value={form.amount_received} onChange={(e) => setForm({ ...form, amount_received: e.target.value })} placeholder="0" className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500" /><div className="mt-4 flex items-center justify-between text-sm"><span className="text-zinc-500">Balance / Due</span><span className={`font-bold ${summary.balanceDue > 0 ? "text-amber-700" : "text-emerald-700"}`}>{money(summary.balanceDue)}</span></div></div>
              </div>

              {summary.stockIssue && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">Selected quantity kisi product ke available stock se zyada hai.</div>}

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void saveSale(false)} className="h-12 rounded-2xl px-6">Save Sale</Button>
                <Button variant="outline" onClick={() => void saveSale(true)} className="h-12 rounded-2xl px-6">Save and Print Bill</Button>
                <Button variant="ghost" onClick={resetForm} className="h-12 rounded-2xl px-6">Cancel</Button>
              </div>
            </div>
          </section>
        </div>

        <Modal isOpen={isPartyModalOpen} onClose={() => setIsPartyModalOpen(false)} title="Add New Party">
          <form onSubmit={handleCreateParty} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Customer Name</label>
              <Input
                required
                value={partyForm.name}
                onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                placeholder="Customer name"
                className="h-12 rounded-2xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Phone Number</label>
              <Input
                required
                value={partyForm.phone}
                onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })}
                placeholder="10-digit phone"
                maxLength={10}
                className="h-12 rounded-2xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Email Address</label>
              <Input
                type="email"
                value={partyForm.email}
                onChange={(e) => setPartyForm({ ...partyForm, email: e.target.value })}
                placeholder="Optional email"
                className="h-12 rounded-2xl"
              />
            </div>
            <Button type="submit" className="h-12 w-full rounded-2xl" isLoading={isPartySubmitting}>
              Create Customer Party
            </Button>
          </form>
        </Modal>
      </div>
    </div>
  );
}
