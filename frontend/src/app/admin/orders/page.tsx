"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { canAccessAdmin } from "@/lib/roles";
import { useAuthStore } from "@/store/authStore";
import { Order } from "@/types";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import { SuccessPopup } from "@/components/ui/SuccessPopup";
import {
  ChevronLeft,
  Download,
  FileText,
  Filter,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Truck,
  X,
} from "lucide-react";

const ORDER_STATUSES = ["pending", "confirmed", "packed", "out_for_delivery", "delivered", "cancelled"] as const;
type BankAccount = { name: string; balance: number };
type EditableOrderItem = Order["items"][number];

function getShortReference(orderId: string) {
  return `ORD-${orderId.slice(0, 8).toUpperCase()}`;
}

function getInvoiceReference(order: Order) {
  return order.invoice_number?.trim() || getShortReference(order.id);
}

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) {
      return response.data.error;
    }
  }
  return fallback;
}

function formatDateTime(value?: string) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatusLabel(value?: string) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClasses(status?: string) {
  switch (status) {
    case "confirmed":
      return "bg-blue-50 text-blue-700";
    case "packed":
      return "bg-violet-50 text-violet-700";
    case "out_for_delivery":
      return "bg-amber-50 text-amber-700";
    case "delivered":
      return "bg-green-50 text-green-700";
    case "cancelled":
      return "bg-red-50 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function inferLegacyCustomer(address: string) {
  const pickupMatch = address.match(/Customer:\s*([^,|]+),\s*(\d{10})/i);
  if (pickupMatch) {
    return { name: pickupMatch[1].trim(), phone: pickupMatch[2].trim() };
  }

  const deliveryMatch = address.match(/^([^,|]+),\s*(\d{10})/);
  if (deliveryMatch) {
    return { name: deliveryMatch[1].trim(), phone: deliveryMatch[2].trim() };
  }

  return { name: "", phone: "" };
}

function getCustomerName(order: Order) {
  return order.customer_name || order.user?.name || inferLegacyCustomer(order.address).name || "Customer";
}

function getCustomerPhone(order: Order) {
  return order.customer_phone || order.user?.phone || inferLegacyCustomer(order.address).phone || "";
}

function getShopName(order: Order) {
  return order.shop_name || order.user?.shop_name || "Walk-in";
}

function getDeliveryType(order: Order) {
  if (order.delivery_type) return order.delivery_type;
  return order.address.includes("Store Pickup") ? "pickup" : "delivery";
}

function getPaymentMode(order: Order) {
  if (order.payment_mode) return order.payment_mode;
  return order.address.includes("QR") ? "qr" : "cod";
}

function getPaymentStatus(order: Order) {
  return order.payment_status || "pending";
}

function getSubtotal(order: Order) {
  if (typeof order.subtotal === "number" && !Number.isNaN(order.subtotal)) {
    return order.subtotal;
  }
  return order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
}

function getDeliveryCharge(order: Order) {
  if (typeof order.delivery_charge === "number" && !Number.isNaN(order.delivery_charge)) {
    return order.delivery_charge;
  }
  return Math.max(0, order.total - getSubtotal(order));
}

function getItemCount(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function getItemCountFromItems(items: EditableOrderItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function getSubtotalFromItems(items: EditableOrderItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
}

function getAddressPreview(order: Order) {
  if (getDeliveryType(order) === "pickup") {
    return "Store Pickup";
  }

  const normalized = order.address.replace(/\s+/g, " ").trim();
  return normalized || "Address not available";
}

function matchesDateFilter(order: Order, dateFilter: string) {
  if (dateFilter === "all") return true;
  const createdAt = new Date(order.created_at);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dateFilter === "today") {
    return createdAt >= startOfToday;
  }

  if (dateFilter === "week") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    return createdAt >= start;
  }

  if (dateFilter === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return createdAt >= start;
  }

  return true;
}

function buildWhatsappLink(phone: string, order: Order) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const message = encodeURIComponent(
    `Namaste ${getCustomerName(order)}, aapke order ${getShortReference(order.id)} ke baare mein baat karni thi.`
  );
  return `https://wa.me/91${digits}?text=${message}`;
}

function getStockHint(item: EditableOrderItem) {
  const availableExtra = Math.max(0, Number(item.product?.stock || 0));
  return `Available extra stock: ${availableExtra}`;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [codCollectionMethod, setCodCollectionMethod] = useState("cash");
  const [codCollectionOptions, setCodCollectionOptions] = useState<string[]>(["cash"]);
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSavingInvoiceNumber, setIsSavingInvoiceNumber] = useState(false);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) {
      router.push("/");
      return;
    }

    const fetchOrders = async () => {
      try {
        const [ordersRes, settingsRes] = await Promise.all([
          api.get("/admin/orders"),
          api.get("/admin/settings"),
        ]);
        setOrders(ordersRes.data.data || []);
        const bankAccounts: BankAccount[] = Array.isArray(settingsRes.data.data?.bank_accounts)
          ? settingsRes.data.data.bank_accounts
          : [];
        const bankOptions = bankAccounts
          .map((account) => account.name?.trim())
          .filter((name): name is string => Boolean(name));
        setCodCollectionOptions(["cash", ...bankOptions]);
      } catch (fetchError) {
        console.error("Failed to fetch admin orders", fetchError);
        setError("Orders load nahi ho pa rahe hain.");
      } finally {
        setLoading(false);
      }
    };

    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) {
      fetchOrders();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (!selectedOrder) return;
    setConfirmNote("");
    setInvoiceNumber(getInvoiceReference(selectedOrder));
    setEditableItems(selectedOrder.items.map((item) => ({ ...item })));
    setReceivedAmount(
      getPaymentMode(selectedOrder) === "cod"
        ? String(selectedOrder.received_amount ?? selectedOrder.total)
        : ""
    );
  }, [selectedOrder]);

  useEffect(() => {
    if (!selectedOrder) return;
    setCodCollectionMethod(codCollectionOptions[0] || "cash");
  }, [selectedOrder, codCollectionOptions]);

  useEffect(() => {
    const orderIdFromQuery = searchParams.get("orderId");
    if (!orderIdFromQuery || orders.length === 0) return;
    const matchedOrder = orders.find((order) => order.id === orderIdFromQuery);
    if (matchedOrder) {
      setSelectedOrderId(matchedOrder.id);
    }
  }, [orders, searchParams]);

  const editedSubtotal = useMemo(() => getSubtotalFromItems(editableItems), [editableItems]);
  const editedDeliveryCharge = selectedOrder ? getDeliveryCharge(selectedOrder) : 0;
  const editedTotal = editedSubtotal + editedDeliveryCharge;
  const hasItemChanges = useMemo(() => {
    if (!selectedOrder || editableItems.length !== selectedOrder.items.length) return false;
    return editableItems.some((item) => {
      const original = selectedOrder.items.find((entry) => entry.id === item.id);
      return !original || original.quantity !== item.quantity;
    });
  }, [editableItems, selectedOrder]);

  const closeOrderModal = () => {
    setSelectedOrderId(null);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("orderId")) {
      params.delete("orderId");
      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl);
    }
  };

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const result = orders.filter((order) => {
      const orderId = order.id.toLowerCase();
      const shortRef = getShortReference(order.id).toLowerCase();
      const customerName = getCustomerName(order).toLowerCase();
      const phone = getCustomerPhone(order).toLowerCase();

      const searchMatch =
        !normalizedSearch ||
        orderId.includes(normalizedSearch) ||
        shortRef.includes(normalizedSearch) ||
        customerName.includes(normalizedSearch) ||
        phone.includes(normalizedSearch);

      const statusMatch = statusFilter === "all" || order.status === statusFilter;
      const deliveryMatch = deliveryFilter === "all" || getDeliveryType(order) === deliveryFilter;

      return searchMatch && statusMatch && deliveryMatch && matchesDateFilter(order, dateFilter);
    });

    result.sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "highest") {
        return b.total - a.total;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [orders, searchTerm, statusFilter, deliveryFilter, dateFilter, sortBy]);

  const summary = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return {
      pending: orders.filter((order) => order.status === "pending").length,
      confirmed: orders.filter((order) => order.status === "confirmed").length,
      deliveredToday: orders.filter(
        (order) => order.status === "delivered" && new Date(order.created_at) >= startOfToday
      ).length,
      cancelled: orders.filter((order) => order.status === "cancelled").length,
      totalSales: orders
        .filter((order) => order.status !== "cancelled")
        .reduce((sum, order) => sum + order.total, 0),
    };
  }, [orders]);

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    if (selectedOrder.status === "confirmed") return;
    setIsUpdatingStatus(true);
    try {
      const nextInvoiceNumber = invoiceNumber.trim() || getInvoiceReference(selectedOrder);

      if (nextInvoiceNumber !== getInvoiceReference(selectedOrder)) {
        await api.put(`/admin/orders/${selectedOrder.id}/invoice-number`, {
          invoice_number: nextInvoiceNumber,
        });
      }

      const paymentCollectionNote =
        getPaymentMode(selectedOrder) === "cod"
          ? `COD payment received via ${codCollectionMethod}.`
          : "";
      const normalizedReceivedAmount = Math.max(0, Number(receivedAmount || 0));
      const derivedPaymentStatus =
        getPaymentMode(selectedOrder) === "cod"
          ? normalizedReceivedAmount >= selectedOrder.total
            ? "paid"
            : "unpaid"
          : undefined;
      const paymentAmountNote =
        getPaymentMode(selectedOrder) === "cod" && receivedAmount.trim()
          ? `Received amount: Rs. ${Number(receivedAmount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}.`
          : "";
      const composedNote = [confirmNote.trim(), paymentCollectionNote, paymentAmountNote].filter(Boolean).join(" ");
      const composedOrderNotes = [selectedOrder.notes?.trim(), paymentCollectionNote, paymentAmountNote].filter(Boolean).join("\n");

      await api.put(`/admin/orders/${selectedOrder.id}/status`, {
        status: "confirmed",
        note: composedNote || "Order confirmed by admin.",
        payment_status: derivedPaymentStatus,
        notes: composedOrderNotes || undefined,
        payment_collection_method: getPaymentMode(selectedOrder) === "cod" ? codCollectionMethod : undefined,
        received_amount: getPaymentMode(selectedOrder) === "cod" ? normalizedReceivedAmount : undefined,
      });

      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                invoice_number: nextInvoiceNumber,
                status: "confirmed",
                payment_status: getPaymentMode(order) === "cod" ? derivedPaymentStatus : order.payment_status,
                received_amount: getPaymentMode(order) === "cod" ? normalizedReceivedAmount : order.received_amount,
                payment_collection_method: getPaymentMode(order) === "cod" ? codCollectionMethod : order.payment_collection_method,
                notes: composedOrderNotes || order.notes,
                status_events: [
                  ...(order.status_events || []),
                  {
                    id: `temp-${Date.now()}`,
                    order_id: order.id,
                    status: "confirmed",
                    note: composedNote || "Order confirmed by admin.",
                    created_at: new Date().toISOString(),
                    changed_by_user: user || undefined,
                  },
                ],
              }
            : order
        )
      );
      setInvoiceNumber(nextInvoiceNumber);
      setConfirmNote("");
      setReceivedAmount(getPaymentMode(selectedOrder) === "cod" ? String(normalizedReceivedAmount) : "");
      setSuccessMessage("Order updated successfully.");
    } catch (updateError: unknown) {
      alert(getApiErrorMessage(updateError, "Order confirm failed"));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveInvoiceNumber = async () => {
    if (!selectedOrder) return;
    setIsSavingInvoiceNumber(true);
    try {
      await api.put(`/admin/orders/${selectedOrder.id}/invoice-number`, {
        invoice_number: invoiceNumber.trim(),
      });

      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                invoice_number: invoiceNumber.trim(),
              }
            : order
        )
      );
      setSuccessMessage("Invoice number saved successfully.");
    } catch (saveError: unknown) {
      alert(getApiErrorMessage(saveError, "Invoice number save failed"));
    } finally {
      setIsSavingInvoiceNumber(false);
    }
  };

  const updateEditableItemQuantity = (itemId: string, nextQuantity: number) => {
    setEditableItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.max(1, Number.isFinite(nextQuantity) ? Math.floor(nextQuantity) : 1),
            }
          : item
      )
    );
  };

  const handleSaveItems = async () => {
    if (!selectedOrder || !hasItemChanges) return;
    setIsSavingItems(true);
    try {
      const response = await api.put(`/admin/orders/${selectedOrder.id}/items`, {
        items: editableItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      });

      const updatedOrder: Order = response.data.data;
      setOrders((current) =>
        current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
      );
      setEditableItems(updatedOrder.items.map((item) => ({ ...item })));
      setReceivedAmount(
        getPaymentMode(updatedOrder) === "cod"
          ? String(updatedOrder.received_amount ?? updatedOrder.total)
          : ""
      );
      setSuccessMessage("Order items updated successfully.");
    } catch (saveError: unknown) {
      alert(getApiErrorMessage(saveError, "Order items save failed"));
    } finally {
      setIsSavingItems(false);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      [
        "Order Ref",
        "Customer Name",
        "Shop Name",
        "Phone",
        "Status",
        "Delivery Type",
        "Payment Mode",
        "Payment Status",
        "Total Amount",
        "Item Count",
        "Created At",
      ],
      ...filteredOrders.map((order) => [
        getInvoiceReference(order),
        getCustomerName(order),
        getShopName(order),
        getCustomerPhone(order),
        formatStatusLabel(order.status),
        formatStatusLabel(getDeliveryType(order)),
        formatStatusLabel(getPaymentMode(order)),
        formatStatusLabel(getPaymentStatus(order)),
        String(order.total),
        String(getItemCount(order)),
        formatDateTime(order.created_at),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!selectedOrder) return;
    const customerPhone = getCustomerPhone(selectedOrder);
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const itemsMarkup = selectedOrder.items
      .map(
        (item) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${item.product?.name || "Product"}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${item.quantity}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${formatCurrency(item.price)}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${formatCurrency(item.price * item.quantity)}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${getInvoiceReference(selectedOrder)}</title>
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
                <div class="meta-value">${getInvoiceReference(selectedOrder)}</div>
                <div class="meta-text"><strong>Date:</strong> ${formatDateTime(selectedOrder.created_at)}</div>
                <div class="meta-text"><strong>Customer Name:</strong> ${getCustomerName(selectedOrder)}</div>
              </div>
              <div class="meta-card">
                <div class="meta-label">Customer Details</div>
                <div class="meta-text"><strong>Shop:</strong> ${getShopName(selectedOrder)}</div>
                <div class="meta-text"><strong>Phone:</strong> ${customerPhone || "N/A"}</div>
                <div class="meta-text"><strong>Address:</strong> ${selectedOrder.address}</div>
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
            <tbody>${itemsMarkup}</tbody>
          </div>
            </table>

            <div class="summary">
              <div class="summary-row">
                <span>Subtotal</span>
                <strong>${formatCurrency(getSubtotal(selectedOrder))}</strong>
              </div>
              <div class="summary-row">
                <span>Delivery Charge</span>
                <strong>${formatCurrency(getDeliveryCharge(selectedOrder))}</strong>
              </div>
              <div class="summary-row summary-total">
                <span>Total Amount</span>
                <span>${formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            <div class="footer">Thank You for Your Business</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (!isInitialized || loading) {
    return (
      <PageLoader
        compact
        title="Loading Orders"
        subtitle="Order list aur customer details fetch ho rahi hain."
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">ORDERS CONTROL ROOM</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-500 sm:text-base">
                Search, filter, print, aur order status ko ek jagah se manage karo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExportCsv} leftIcon={Download} className="rounded-2xl">
              Export CSV
            </Button>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Pending Orders", value: summary.pending, tone: "bg-amber-50 text-amber-700" },
            { label: "Confirmed Orders", value: summary.confirmed, tone: "bg-blue-50 text-blue-700" },
            { label: "Delivered Today", value: summary.deliveredToday, tone: "bg-green-50 text-green-700" },
            { label: "Cancelled Orders", value: summary.cancelled, tone: "bg-red-50 text-red-700" },
            { label: "Total Sales", value: formatCurrency(summary.totalSales), tone: "bg-zinc-900 text-white" },
          ].map((card) => (
            <div key={card.label} className="rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-sm">
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${card.tone}`}>
                {card.label}
              </div>
              <div className="mt-4 text-3xl font-black text-zinc-900">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-[2rem] border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by order ID, customer, phone..."
                className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500">
              <option value="all">All Status</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>{formatStatusLabel(status)}</option>
              ))}
            </select>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <select value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500">
              <option value="all">All Delivery Types</option>
              <option value="delivery">Home Delivery</option>
              <option value="pickup">Store Pickup</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2.2rem] border border-zinc-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Orders Table</h2>
              <p className="mt-1 text-sm text-zinc-500">{filteredOrders.length} records matched</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-600 md:flex">
              <Filter className="h-4 w-4" />
              Live filters active
            </div>
          </div>

          {error ? (
            <div className="p-8 text-sm text-red-600">{error}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <ShoppingBag className="h-12 w-12 text-zinc-300" />
              <p className="mt-4 text-lg font-semibold text-zinc-900">No orders found</p>
              <p className="mt-2 text-sm text-zinc-500">Search ya filters ko thoda relax karke dekho.</p>
            </div>
          ) : (
            <>
              <div className="md:hidden">
                <div className="space-y-4 p-4">
                  {filteredOrders.map((order) => (
                    <article key={order.id} className="rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-zinc-900">{getInvoiceReference(order)}</div>
                          <div className="mt-1 text-xs text-zinc-400">{formatDateTime(order.created_at)}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusClasses(order.status)}`}>
                          {formatStatusLabel(order.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Customer</div>
                          <div className="mt-1 font-semibold leading-5 text-zinc-900">{getCustomerName(order)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Phone</div>
                          <div className="mt-1 break-all leading-5 text-zinc-700">{getCustomerPhone(order) || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Amount</div>
                          <div className="mt-1 font-bold leading-5 text-zinc-900">{formatCurrency(order.total)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Items</div>
                          <div className="mt-1 leading-5 text-zinc-700">{getItemCount(order)}</div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3 rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Delivery</span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                            {getDeliveryType(order) === "pickup" ? <Store className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                            {getDeliveryType(order) === "pickup" ? "Pickup" : "Delivery"}
                          </span>
                        </div>
                        <div className="text-sm leading-5 text-zinc-600">{getAddressPreview(order)}</div>
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Shop</div>
                          <div className="mt-1 leading-5 text-zinc-700">{getShopName(order)}</div>
                        </div>
                      </div>

                      <Button
                        variant={order.status === "confirmed" ? "secondary" : "primary"}
                        size="sm"
                        onClick={() => setSelectedOrderId(order.id)}
                        className="mt-4 h-11 w-full rounded-2xl px-4 text-sm font-bold"
                      >
                        {order.status === "confirmed" ? "Order Confirmed" : "Order Confirm"}
                      </Button>
                    </article>
                  ))}
                </div>
              </div>

              <div className="hidden overflow-hidden md:block">
                <table className="w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[6%]" />
                  <col className="w-[8%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="bg-zinc-50/60">
                  <tr>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Order</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Customer</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Shop</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Phone</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Amount</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Items</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Date</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Status</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Delivery</th>
                    <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Address / Pickup</th>
                    <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-4 align-top">
                        <div className="break-words text-[13px] font-semibold leading-5 text-zinc-900">{getInvoiceReference(order)}</div>
                        <div className="mt-1 break-all text-[11px] text-zinc-400">{order.id.slice(0, 10)}...</div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-medium text-zinc-800"><div className="line-clamp-2 break-words leading-5">{getCustomerName(order)}</div></td>
                      <td className="px-4 py-4 align-top text-sm text-zinc-700"><div className="line-clamp-2 break-words leading-5">{getShopName(order)}</div></td>
                      <td className="px-4 py-4 align-top text-sm text-zinc-700"><div className="break-all leading-5">{getCustomerPhone(order) || "N/A"}</div></td>
                      <td className="px-4 py-4 align-top text-sm font-bold leading-5 text-zinc-900">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-4 align-top text-sm leading-5 text-zinc-700">{getItemCount(order)}</td>
                      <td className="px-4 py-4 align-top text-sm leading-5 text-zinc-700">{formatDateTime(order.created_at)}</td>
                      <td className="px-4 py-4 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 ${getStatusClasses(order.status)}`}>{formatStatusLabel(order.status)}</span></td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold leading-4 text-zinc-700">
                          {getDeliveryType(order) === "pickup" ? <Store className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                          {getDeliveryType(order) === "pickup" ? "Pickup" : "Delivery"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-zinc-600">
                        <div className="line-clamp-3 break-words leading-5">{getAddressPreview(order)}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-right">
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            variant={order.status === "confirmed" ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="h-9 min-w-[128px] rounded-xl px-3 text-xs font-bold"
                          >
                            {order.status === "confirmed" ? "Order Confirmed" : "Order Confirm"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-zinc-950/35 backdrop-blur-sm" onClick={closeOrderModal} />
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
              <div className="w-full overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_30px_120px_rgba(24,24,27,0.24)]">
                <div className="border-b border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_38%),linear-gradient(135deg,#f7fee7_0%,#ffffff_55%,#ecfeff_100%)] px-6 py-6 sm:px-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Order Confirmation Form</div>
                      <h2 className="mt-2 text-2xl font-black text-zinc-900 sm:text-3xl">{getInvoiceReference(selectedOrder)}</h2>
                      <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                        Order Billing Form ko editable popup me update kiya gaya hai. Yahin se item quantity, totals aur confirmation manage karo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeOrderModal}
                      className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 backdrop-blur">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Editable Total</div>
                      <div className="mt-3 text-2xl font-black text-zinc-900">{formatCurrency(editedTotal)}</div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 backdrop-blur">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Items Count</div>
                      <div className="mt-3 text-2xl font-black text-zinc-900">{getItemCountFromItems(editableItems)}</div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 backdrop-blur">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Status</div>
                      <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(selectedOrder.status)}`}>
                        {formatStatusLabel(selectedOrder.status)}
                      </div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 backdrop-blur">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Delivery</div>
                      <div className="mt-3 text-lg font-bold text-zinc-900">
                        {getDeliveryType(selectedOrder) === "pickup" ? "Store Pickup" : "Home Delivery"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
                  <div className="space-y-6">
                    <section className="rounded-[1.8rem] border border-zinc-100 bg-white p-5">
                      <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold text-zinc-900">Order Billing Form</h3>
                          <p className="mt-1 text-sm text-zinc-500">Customer info aur billing references yahan locked view me hain.</p>
                        </div>
                        <Button type="button" variant="outline" className="rounded-2xl" onClick={closeOrderModal}>
                          Close
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Customer Name</label>
                          <input value={getCustomerName(selectedOrder)} readOnly className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none" />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Customer Phone</label>
                          <input value={getCustomerPhone(selectedOrder) || ""} readOnly className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none" />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Invoice Number</label>
                          <input
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Shop Name</label>
                          <input value={getShopName(selectedOrder)} readOnly className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none" />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Status</label>
                          <input value={formatStatusLabel(getPaymentStatus(selectedOrder))} readOnly className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none" />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Mode</label>
                          <input value={formatStatusLabel(getPaymentMode(selectedOrder))} readOnly className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none" />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                          {getDeliveryType(selectedOrder) === "pickup" ? "Pickup Label" : "Address"}
                        </label>
                        <textarea value={selectedOrder.address} readOnly rows={3} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-900 outline-none" />
                      </div>
                    </section>

                    <section className="rounded-[1.8rem] border border-emerald-100 bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_100%)] p-5">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Items Section</h3>
                          <p className="mt-1 text-sm text-zinc-600">Ab yahan quantity editable hai. Offline sale ki wajah se stock change ho gaya ho to direct adjust karke save kar sakte ho.</p>
                        </div>
                        <div className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                          {hasItemChanges ? "Unsaved changes" : "Synced"}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {editableItems.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-1 gap-4 rounded-[1.6rem] border border-white bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1.5fr)_minmax(160px,0.7fr)_minmax(0,0.9fr)_minmax(0,0.95fr)] lg:items-end"
                          >
                            <div className="flex flex-col">
                              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Product</label>
                              <div className="flex min-h-[56px] items-center rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold text-zinc-900">
                                {item.product?.name || "Product"}
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Qty</label>
                              <div className="flex h-14 items-center rounded-2xl border border-zinc-200 bg-white px-2">
                                <button
                                  type="button"
                                  onClick={() => updateEditableItemQuantity(item.id, item.quantity - 1)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-100"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateEditableItemQuantity(item.id, Number(e.target.value))}
                                  className="h-10 flex-1 border-0 bg-transparent text-center text-base font-bold text-zinc-900 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateEditableItemQuantity(item.id, item.quantity + 1)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-100"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="mt-2 text-xs font-medium text-zinc-500">{getStockHint(item)}</div>
                            </div>
                            <div className="flex flex-col">
                              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Unit Price</label>
                              <div className="flex h-14 items-center rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-900">
                                {formatCurrency(item.price)}
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Line Total</label>
                              <div className="flex h-14 items-center rounded-2xl border border-zinc-200 bg-zinc-900 px-4 text-sm font-semibold text-white">
                                {formatCurrency(item.price * item.quantity)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[1.8rem] border border-zinc-100 p-5">
                      <h3 className="text-lg font-bold text-zinc-900">Timeline of Status Updates</h3>
                      <div className="mt-5 space-y-4">
                        {(selectedOrder.status_events && selectedOrder.status_events.length > 0 ? selectedOrder.status_events : [{ id: selectedOrder.id, order_id: selectedOrder.id, status: selectedOrder.status, created_at: selectedOrder.created_at }]).map((event, index, list) => (
                          <div key={`${event.id}-${index}`} className="flex gap-4">
                            <div className="mt-1 flex flex-col items-center">
                              <div className={`h-3 w-3 rounded-full ${index === list.length - 1 ? "bg-green-600" : "bg-zinc-300"}`} />
                              {index !== list.length - 1 && <div className="mt-2 h-full w-px bg-zinc-200" />}
                            </div>
                            <div className="flex-1 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(event.status)}`}>{formatStatusLabel(event.status)}</div>
                                <div className="text-xs font-medium text-zinc-500">{formatDateTime(event.created_at)}</div>
                              </div>
                              {event.note && <p className="mt-3 text-sm leading-6 text-zinc-700">{event.note}</p>}
                              {event.changed_by_user?.name && <p className="mt-2 text-xs font-medium text-zinc-500">Updated by {event.changed_by_user.name}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section className="rounded-[1.8rem] border border-zinc-100 bg-zinc-50 p-5">
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Order Summary</div>
                      <div className="mt-4 space-y-3 text-sm text-zinc-600">
                        <div className="flex items-center justify-between">
                          <span>Subtotal</span>
                          <span className="font-semibold text-zinc-900">{formatCurrency(editedSubtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Delivery Charge</span>
                          <span className="font-semibold text-zinc-900">{formatCurrency(editedDeliveryCharge)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Total Items</span>
                          <span className="font-semibold text-zinc-900">{getItemCountFromItems(editableItems)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                          <span className="font-semibold text-zinc-900">Final Total</span>
                          <span className="text-lg font-black text-emerald-700">{formatCurrency(editedTotal)}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          type="button"
                          onClick={handleSaveItems}
                          isLoading={isSavingItems}
                          className="h-12 rounded-2xl px-6"
                          disabled={!hasItemChanges}
                        >
                          Save Items
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleSaveInvoiceNumber}
                          isLoading={isSavingInvoiceNumber}
                          className="h-12 rounded-2xl px-6"
                        >
                          Save Invoice
                        </Button>
                      </div>
                      {hasItemChanges && (
                        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                          Warning: quantity change karne se stock aur order total dono update honge.
                        </p>
                      )}
                    </section>

                    <section className="rounded-[1.8rem] border border-zinc-100 bg-zinc-50 p-5">
                      <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Confirmation Note</label>
                      <textarea
                        rows={4}
                        value={confirmNote}
                        onChange={(e) => setConfirmNote(e.target.value)}
                        placeholder="Optional order confirmation note"
                        className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                      />
                      {getPaymentMode(selectedOrder) === "cod" && (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">COD Payment Received In</label>
                            <select
                              value={codCollectionMethod}
                              onChange={(e) => setCodCollectionMethod(e.target.value)}
                              className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                            >
                              {codCollectionOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option === "cash" ? "Cash" : option}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Received Amount</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={receivedAmount}
                              onChange={(e) => setReceivedAmount(e.target.value)}
                              placeholder="Enter received amount"
                              className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500"
                            />
                            <div className="mt-2 text-xs text-zinc-500">
                              Outstanding after confirm: {formatCurrency(Math.max(0, editedTotal - Number(receivedAmount || 0)))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          onClick={handleConfirmOrder}
                          isLoading={isUpdatingStatus}
                          className="h-12 rounded-2xl px-6"
                          disabled={selectedOrder.status === "confirmed" || hasItemChanges}
                        >
                          {selectedOrder.status === "confirmed" ? "Order Confirmed" : "Order Confirm"}
                        </Button>
                        <button
                          type="button"
                          onClick={handlePrint}
                          className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                        >
                          <FileText className="mr-2 h-4 w-4" />Print Invoice
                        </button>
                      </div>
                      {hasItemChanges && (
                        <p className="mt-3 text-xs font-medium text-amber-700">
                          Quantity update save karne ke baad hi order confirm karein, taki totals aur stock sahi rahein.
                        </p>
                      )}
                    </section>

                    <section className="rounded-[1.8rem] border border-zinc-100 bg-white p-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        {getCustomerPhone(selectedOrder) && (
                          <>
                            <a href={`tel:${getCustomerPhone(selectedOrder)}`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50">
                              <Phone className="mr-2 h-4 w-4" />Call
                            </a>
                            <a href={buildWhatsappLink(getCustomerPhone(selectedOrder), selectedOrder)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50">
                              WhatsApp
                            </a>
                          </>
                        )}
                        <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold text-zinc-700">
                          {formatStatusLabel(getPaymentMode(selectedOrder))}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <SuccessPopup
        isOpen={Boolean(successMessage)}
        message={successMessage || ""}
        onClose={() => setSuccessMessage(null)}
        title="Form Submitted"
      />
    </div>
  );
}
