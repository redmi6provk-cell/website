export type PurchasePaymentStatus = "paid" | "partial" | "pending";

export type PurchasePaymentMethod = string;

export type PurchaseLineItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  buy_price: number;
  line_total: number;
};

export type PurchaseEntry = {
  id: string;
  date: string;
  invoice_number: string;
  supplier_party_id?: string | null;
  supplier_name: string;
  payment_status: PurchasePaymentStatus;
  payment_method: PurchasePaymentMethod;
  notes: string;
  items: PurchaseLineItem[];
  total_amount: number;
  created_at: string;
  updated_at?: string;
};

export function normalizePurchaseEntry(entry: any): PurchaseEntry {
  return {
    id: String(entry.id),
    date: String(entry.date || "").slice(0, 10),
    invoice_number: entry.invoice_number || "",
    supplier_party_id: entry.supplier_party_id || entry.supplier_party?.party_id || null,
    supplier_name: entry.supplier_name || entry.supplier_party?.name || "",
    payment_status: entry.payment_status,
    payment_method: entry.payment_method,
    notes: entry.notes || "",
    items: Array.isArray(entry.items)
      ? entry.items.map((item: any) => ({
          id: String(item.id),
          product_id: String(item.product_id),
          product_name: item.product_name || item.product?.name || "",
          quantity: Number(item.quantity || 0),
          buy_price: Number(item.buy_price || 0),
          line_total: Number(item.line_total || 0),
        }))
      : [],
    total_amount: Number(entry.total_amount || 0),
    created_at: entry.created_at || "",
    updated_at: entry.updated_at || undefined,
  };
}

export type ProductPurchaseSnapshot = {
  product_id: string;
  total_quantity: number;
  total_amount: number;
  weighted_avg_buy_price: number;
  latest_buy_price: number;
  last_purchase_date: string;
};

export function calculatePurchaseSnapshots(entries: PurchaseEntry[]) {
  const grouped = entries.reduce<Record<string, ProductPurchaseSnapshot>>((acc, entry) => {
    entry.items.forEach((item) => {
      if (!acc[item.product_id]) {
        acc[item.product_id] = {
          product_id: item.product_id,
          total_quantity: 0,
          total_amount: 0,
          weighted_avg_buy_price: 0,
          latest_buy_price: item.buy_price,
          last_purchase_date: entry.date,
        };
      }

      acc[item.product_id].total_quantity += item.quantity;
      acc[item.product_id].total_amount += item.line_total;

      if (entry.date >= acc[item.product_id].last_purchase_date) {
        acc[item.product_id].latest_buy_price = item.buy_price;
        acc[item.product_id].last_purchase_date = entry.date;
      }
    });

    return acc;
  }, {});

  return Object.values(grouped).map((snapshot) => ({
    ...snapshot,
    weighted_avg_buy_price:
      snapshot.total_quantity > 0 ? snapshot.total_amount / snapshot.total_quantity : 0,
  }));
}

export function getPurchaseSnapshotMap(entries: PurchaseEntry[]) {
  return calculatePurchaseSnapshots(entries).reduce<Record<string, ProductPurchaseSnapshot>>((acc, snapshot) => {
    acc[snapshot.product_id] = snapshot;
    return acc;
  }, {});
}
