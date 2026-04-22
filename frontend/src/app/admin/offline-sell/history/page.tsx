"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, Printer, Receipt, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";
import { Order } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";

type SaleStatus = "paid" | "partial" | "due";
type PaymentMode = string;
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

const money = (v: number) => `Rs. ${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dateLabel = (v: string) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const statusClasses = (s: SaleStatus) => s === "paid" ? "bg-emerald-50 text-emerald-700" : s === "partial" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
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
const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return fallback;
};

export default function OfflineSellHistoryPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) router.push("/");
    const load = async () => {
      try {
        const [salesRes, ordersRes] = await Promise.all([api.get("/admin/offline-sales"), api.get("/admin/orders")]);
        setSales((salesRes.data.data || []).map(normalizeSale));
        setConfirmedOrders((ordersRes.data.data || []).filter((order: Order) => order.status === "confirmed"));
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Failed to load sales history"));
      } finally {
        setLoading(false);
      }
    };
    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) void load();
  }, [isInitialized, isAuthenticated, user, router]);

  const historyEntries = useMemo(
    () => [...sales.map(normalizeSaleToHistory), ...confirmedOrders.map(normalizeOrderToHistory)].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [sales, confirmedOrders]
  );

  const filteredEntries = useMemo(() => historyEntries.filter((entry) => {
    const q = search.trim().toLowerCase();
    const searchOk = !q || entry.invoice_number.toLowerCase().includes(q) || entry.customer_name.toLowerCase().includes(q) || entry.customer_phone.toLowerCase().includes(q);
    const statusOk = statusFilter === "all" || entry.status === statusFilter;
    return searchOk && statusOk;
  }), [historyEntries, search, statusFilter]);

  const selectedSale = useMemo(() => filteredEntries.find((entry) => entry.id === selectedSaleId) || historyEntries.find((entry) => entry.id === selectedSaleId) || null, [filteredEntries, historyEntries, selectedSaleId]);

  const cards = [
    { label: "History Entries", value: historyEntries.length, tone: "text-zinc-900" },
    { label: "Total Sales", value: money(historyEntries.reduce((sum, entry) => sum + entry.total, 0)), tone: "text-emerald-700" },
    { label: "Pending / Due", value: historyEntries.filter((entry) => !["paid", "confirmed"].includes(entry.status)).length, tone: "text-amber-700" },
    { label: "Items Sold", value: historyEntries.reduce((sum, entry) => sum + entry.item_count, 0), tone: "text-blue-700" },
  ];

  const printSale = (sale: Sale) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const rows = sale.items.map((i) => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${money(i.sell_price)}</td><td>${money(i.line_total)}</td></tr>`).join("");
    w.document.write(`<html><head><title>${sale.bill_number}</title></head><body><table>${rows}</table></body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const deleteSale = async (id: string) => {
    try {
      await api.delete(`/admin/offline-sales/${id}`);
      setSales((current) => current.filter((sale) => sale.id !== id));
      if (selectedSaleId === id) setSelectedSaleId(null);
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, "Failed to delete offline sale"));
    }
  };

  if (!isInitialized || loading) return <div className="p-12 text-center">Loading sales history...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-6 md:py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/offline-sell")} className="rounded-full"><ChevronLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl md:text-4xl">Sales History</h1><p className="mt-1 text-sm text-zinc-500 md:mt-2 md:text-base">Offline bills aur confirmed orders alag page par clean list view mein.</p></div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <div key={card.label} className="rounded-[1.6rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5"><div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{card.label}</div><div className={`mt-3 text-2xl font-black sm:text-3xl ${card.tone}`}>{card.value}</div></div>)}
        </div>

        <section className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
          <div className="mb-5 flex flex-col gap-4">
            <div><h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">Sales & Confirmed Orders History</h2><p className="mt-1 text-sm text-zinc-500">Ab list billing form ke sath squeeze nahi hogi.</p></div>
            <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
              <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, customer, phone..." className="h-12 w-full rounded-2xl border border-zinc-200 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"><option value="all">All Status</option><option value="confirmed">Confirmed</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="due">Due</option></select>
            </div>
          </div>

          {error ? <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{dateLabel(entry.date)}</span><span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${entry.source === "confirmed_order" ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>{entry.source === "confirmed_order" ? "Confirmed Order" : "Offline Sale"}</span><span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${entry.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : statusClasses(entry.status as SaleStatus)}`}>{entry.status}</span></div><div className="mt-3 text-lg font-bold text-zinc-900">{entry.invoice_number}</div><div className="mt-1 text-sm text-zinc-500">{entry.customer_name}</div><div className="mt-1 text-xs text-zinc-400">{entry.item_count} items | {entry.payment_mode}</div></div>
                  <div className="text-right"><div className="text-xl font-black text-zinc-900">{money(entry.total)}</div><div className="mt-1 text-xs text-zinc-500">Received {money(entry.amount_received)}</div></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedSaleId(entry.id)} className="rounded-xl"><Eye className="mr-2 h-4 w-4" />View</Button>
                  {entry.source === "offline_sale" ? <Button variant="outline" size="sm" onClick={() => router.push(`/admin/offline-sell?edit=${entry.id}`)} className="rounded-xl">Open in Billing Form</Button> : null}
                  {entry.source === "offline_sale" && entry.sale ? <Button variant="outline" size="sm" onClick={() => printSale(entry.sale!)} className="rounded-xl"><Printer className="mr-2 h-4 w-4" />Print</Button> : null}
                  {entry.source === "offline_sale" ? <Button variant="ghost" size="sm" onClick={() => void deleteSale(entry.id)} className="rounded-xl text-red-500 hover:bg-red-50"><Trash2 className="mr-2 h-4 w-4" />Delete</Button> : null}
                  {entry.source === "confirmed_order" ? <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/orders?orderId=${entry.id}`)} className="rounded-xl">Open Orders</Button> : null}
                </div>
              </div>
            ))}
            {filteredEntries.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500"><Receipt className="mx-auto mb-3 h-10 w-10 text-zinc-300" />Abhi koi history record nahi mila.</div> : null}
          </div>
        </section>

        {selectedSale ? (
          <div className="fixed inset-0 z-[90]">
            <div className="absolute inset-0 bg-zinc-950/35 backdrop-blur-sm" onClick={() => setSelectedSaleId(null)} />
            <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
              <div className="sticky top-0 border-b border-zinc-100 bg-white px-6 py-5"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{selectedSale.source === "confirmed_order" ? "Confirmed Order" : "Offline Bill"}</div><h2 className="mt-2 text-2xl font-black text-zinc-900">{selectedSale.invoice_number}</h2><p className="mt-1 text-sm text-zinc-500">{dateLabel(selectedSale.date)}</p></div><Button variant="ghost" onClick={() => setSelectedSaleId(null)} className="rounded-full">Close</Button></div></div>
              <div className="space-y-6 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Customer</div><div className="mt-2 font-bold text-zinc-900">{selectedSale.customer_name}</div><div className="mt-1 text-sm text-zinc-500">{selectedSale.customer_phone || "No phone"}</div></div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Payment</div><div className="mt-2 font-bold text-zinc-900">{selectedSale.payment_mode}</div><div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${selectedSale.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : statusClasses(selectedSale.status as SaleStatus)}`}>{selectedSale.status}</div></div>
                </div>
                <div className="space-y-3">{selectedSale.source === "offline_sale" && selectedSale.sale ? selectedSale.sale.items.map((item) => <div key={item.id} className="grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-4 sm:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr] sm:items-center"><div><div className="font-semibold text-zinc-900">{item.product_name}</div></div><div className="text-sm text-zinc-700">Qty: {item.quantity}</div><div className="text-sm text-zinc-700">Price: {money(item.sell_price)}</div><div className="text-sm font-bold text-zinc-900">{money(item.line_total)}</div></div>) : selectedSale.order?.items.map((item) => <div key={item.id} className="grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-4 sm:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr] sm:items-center"><div><div className="font-semibold text-zinc-900">{item.product?.name || "Product"}</div></div><div className="text-sm text-zinc-700">Qty: {item.quantity}</div><div className="text-sm text-zinc-700">Price: {money(item.price)}</div><div className="text-sm font-bold text-zinc-900">{money(item.quantity * item.price)}</div></div>)}</div>
                <div className="grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-2"><div><div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Subtotal</div><div className="mt-2 text-lg font-bold text-zinc-900">{money(selectedSale.sale?.subtotal || selectedSale.order?.subtotal || selectedSale.total)}</div></div><div><div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Discount</div><div className="mt-2 text-lg font-bold text-zinc-900">{money(selectedSale.sale?.discount_total || 0)}</div></div><div><div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Final Total</div><div className="mt-2 text-lg font-bold text-green-700">{money(selectedSale.total)}</div></div><div><div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Balance Due</div><div className="mt-2 text-lg font-bold text-amber-700">{money(selectedSale.balance_due)}</div></div></div>
                {selectedSale.notes ? <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-600">{selectedSale.notes}</div> : null}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
