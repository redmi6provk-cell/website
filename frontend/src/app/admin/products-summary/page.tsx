"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  ChevronLeft,
  PackageSearch,
  Search,
  TrendingUp,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Product } from "@/types";
import { formatDiscountLabel } from "@/lib/pricing";
import { getPurchaseSnapshotMap, normalizePurchaseEntry, PurchaseEntry } from "@/lib/purchases";

type StockStatusFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";

type SummaryProduct = Product & {
  buy_price?: number | null;
};

const LOW_STOCK_THRESHOLD = 10;

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getStockStatus(stock: number): StockStatusFilter {
  if (stock <= 0) return "out-of-stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low-stock";
  return "in-stock";
}

function getStockStatusLabel(stock: number) {
  const status = getStockStatus(stock);
  if (status === "out-of-stock") return "Out of Stock";
  if (status === "low-stock") return "Low Stock";
  return "In Stock";
}

function getStockStatusClasses(stock: number) {
  const status = getStockStatus(stock);
  if (status === "out-of-stock") return "bg-red-50 text-red-700";
  if (status === "low-stock") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export default function AdminProductsSummaryPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [products, setProducts] = useState<SummaryProduct[]>([]);
  const [purchaseSnapshotMap, setPurchaseSnapshotMap] = useState<Record<string, { weighted_avg_buy_price: number }>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockStatusFilter>("all");

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) {
      router.push("/");
      return;
    }

    const fetchProducts = async () => {
      try {
        const [productResponse, purchaseResponse] = await Promise.all([
          api.get("/products"),
          api.get("/admin/purchases"),
        ]);
        setProducts(productResponse.data.data?.items || []);
        setPurchaseSnapshotMap(
          getPurchaseSnapshotMap(((purchaseResponse.data.data || []) as PurchaseEntry[]).map(normalizePurchaseEntry))
        );
      } catch (error) {
        console.error("Failed to fetch product summary data", error);
      } finally {
        setLoading(false);
      }
    };

    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) {
      fetchProducts();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const enrichedProducts = useMemo(
    () =>
      products.map((product) => ({
        ...product,
        buy_price: purchaseSnapshotMap[product.id]?.weighted_avg_buy_price ?? null,
      })),
    [products, purchaseSnapshotMap]
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(enrichedProducts.map((product) => product.category_info?.name).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b)),
    [enrichedProducts]
  );

  const brands = useMemo(
    () =>
      Array.from(new Set(enrichedProducts.map((product) => product.brand_info?.name).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b)
      ),
    [enrichedProducts]
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return enrichedProducts.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.brand_info?.name || "").toLowerCase().includes(query) ||
        (product.category_info?.name || "").toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" || (product.category_info?.name || "Uncategorized") === categoryFilter;

      const matchesBrand = brandFilter === "all" || (product.brand_info?.name || "Unbranded") === brandFilter;

      const matchesStock = stockFilter === "all" || getStockStatus(product.stock) === stockFilter;

      return matchesSearch && matchesCategory && matchesBrand && matchesStock;
    });
  }, [enrichedProducts, searchTerm, categoryFilter, brandFilter, stockFilter]);

  const summary = useMemo(() => {
    const totalProducts = filteredProducts.length;
    const totalStockUnits = filteredProducts.reduce((sum, product) => sum + (product.stock || 0), 0);
    const totalStockValue = filteredProducts.reduce(
      (sum, product) => sum + (product.price || 0) * (product.stock || 0),
      0
    );
    const outOfStock = filteredProducts.filter((product) => product.stock <= 0).length;
    const lowStock = filteredProducts.filter(
      (product) => product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD
    ).length;
    const productsWithBuyPrice = filteredProducts.filter((product) => typeof product.buy_price === "number");
    const purchaseValue = productsWithBuyPrice.reduce(
      (sum, product) => sum + Number(product.buy_price || 0) * (product.stock || 0),
      0
    );
    const sellingValue = filteredProducts.reduce(
      (sum, product) => sum + (product.price || 0) * (product.stock || 0),
      0
    );
    const potentialProfit = sellingValue - purchaseValue;
    const averageMarginPerUnit =
      productsWithBuyPrice.length > 0
        ? productsWithBuyPrice.reduce(
            (sum, product) => sum + ((product.price || 0) - Number(product.buy_price || 0)),
            0
          ) / productsWithBuyPrice.length
        : 0;

    return {
      totalProducts,
      totalStockUnits,
      totalStockValue,
      outOfStock,
      lowStock,
      purchaseValue,
      sellingValue,
      potentialProfit,
      averageMarginPerUnit,
      syncedPurchaseCount: productsWithBuyPrice.length,
    };
  }, [filteredProducts]);

  const topExpensiveProducts = useMemo(
    () => [...filteredProducts].sort((a, b) => b.price - a.price).slice(0, 5),
    [filteredProducts]
  );

  const lowestStockProducts = useMemo(
    () => [...filteredProducts].sort((a, b) => a.stock - b.stock).slice(0, 5),
    [filteredProducts]
  );

  const categoryBreakdown = useMemo(() => {
    const grouped = filteredProducts.reduce<Record<string, { products: number; units: number; value: number }>>(
      (acc, product) => {
        const key = product.category_info?.name || "Uncategorized";
        if (!acc[key]) {
          acc[key] = { products: 0, units: 0, value: 0 };
        }

        acc[key].products += 1;
        acc[key].units += product.stock || 0;
        acc[key].value += (product.price || 0) * (product.stock || 0);
        return acc;
      },
      {}
    );

    return Object.entries(grouped)
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.value - a.value);
  }, [filteredProducts]);

  const brandBreakdown = useMemo(() => {
    const grouped = filteredProducts.reduce<Record<string, number>>((acc, product) => {
      const key = product.brand_info?.name || "Unbranded";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredProducts]);

  if (!isInitialized || loading) {
    return <div className="p-12 text-center">Loading Products Summary...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-900">PRODUCTS SUMMARY</h1>
              <p className="mt-2 max-w-3xl text-zinc-500">
                Inventory, stock value, selling snapshot, aur future purchase-price sync ko ek jagah se dekho.
              </p>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Buy price ab ab <span className="font-bold">Add Purchase</span> entries se weighted average ke through sync
            hota hai.
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Products", value: summary.totalProducts, tone: "text-zinc-900", icon: Boxes },
            { label: "Total Stock Units", value: summary.totalStockUnits, tone: "text-blue-700", icon: PackageSearch },
            { label: "Total Stock Value", value: formatCurrency(summary.totalStockValue), tone: "text-green-700", icon: TrendingUp },
            { label: "Out Of Stock", value: summary.outOfStock, tone: "text-red-700", icon: AlertTriangle },
            { label: "Low Stock Count", value: summary.lowStock, tone: "text-amber-700", icon: AlertTriangle },
            {
              label: "Purchase Value",
              value: summary.syncedPurchaseCount > 0 ? formatCurrency(summary.purchaseValue) : "Awaiting Add Purchase",
              tone: "text-zinc-900",
              icon: ArrowRightLeft,
            },
            { label: "Selling Value", value: formatCurrency(summary.sellingValue), tone: "text-emerald-700", icon: TrendingUp },
            {
              label: "Potential Profit",
              value: summary.syncedPurchaseCount > 0 ? formatCurrency(summary.potentialProfit) : "Pending buy prices",
              tone: "text-violet-700",
              icon: TrendingUp,
            },
            {
              label: "Avg Margin / Unit",
              value:
                summary.syncedPurchaseCount > 0
                  ? formatCurrency(summary.averageMarginPerUnit)
                  : "Pending buy prices",
              tone: "text-indigo-700",
              icon: TrendingUp,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-[2rem] border border-zinc-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{card.label}</div>
                <card.icon className="h-4 w-4 text-zinc-400" />
              </div>
              <div className={`mt-4 text-2xl font-black tracking-tight ${card.tone}`}>{card.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-[2rem] border border-zinc-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.8fr_repeat(3,minmax(0,1fr))]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product, category, brand..."
                className="h-12 w-full rounded-2xl border border-zinc-200 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-12 rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="h-12 rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Brands</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockStatusFilter)}
              className="h-12 rounded-2xl border border-zinc-200 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Stock Status</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out Of Stock</option>
            </select>
          </div>
        </div>

        <div className="mb-8 overflow-hidden rounded-[2.2rem] border border-zinc-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Inventory Snapshot Table</h2>
              <p className="mt-1 text-sm text-zinc-500">{filteredProducts.length} products matched the current filters</p>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-zinc-500">
              Filters ke hisaab se koi product match nahi hua.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Product</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Brand</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Category</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Buy Price</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Sell Price</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Stock</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Purchase Value</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Selling Value</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Margin / Unit</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Expected Margin</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">MOQ</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Discount Slabs</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredProducts.map((product) => {
                    const hasBuyPrice = typeof product.buy_price === "number";
                    const purchaseValue = hasBuyPrice ? Number(product.buy_price) * (product.stock || 0) : null;
                    const sellingValue = (product.price || 0) * (product.stock || 0);
                    const marginPerUnit = hasBuyPrice ? (product.price || 0) - Number(product.buy_price) : null;
                    const expectedMargin = hasBuyPrice ? (marginPerUnit || 0) * (product.stock || 0) : null;

                    return (
                      <tr key={product.id} className="hover:bg-zinc-50/60">
                        <td className="px-6 py-5">
                          <div>
                            <div className="font-semibold text-zinc-900">{product.name}</div>
                            <div className="text-xs text-zinc-400">{product.unit || "unit not set"}</div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-zinc-700">{product.brand_info?.name || "Unbranded"}</td>
                        <td className="px-6 py-5 text-sm text-zinc-700">{product.category_info?.name || "Uncategorized"}</td>
                        <td className="px-6 py-5 text-sm font-semibold text-zinc-900">
                          {hasBuyPrice ? (
                            formatCurrency(Number(product.buy_price))
                          ) : (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                              Add Purchase se aayega
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-sm font-semibold text-zinc-900">{formatCurrency(product.price)}</td>
                        <td className="px-6 py-5 text-sm font-semibold text-zinc-900">{product.stock}</td>
                        <td className="px-6 py-5 text-sm text-zinc-700">
                          {purchaseValue == null ? "Pending sync" : formatCurrency(purchaseValue)}
                        </td>
                        <td className="px-6 py-5 text-sm font-semibold text-green-700">{formatCurrency(sellingValue)}</td>
                        <td className="px-6 py-5 text-sm font-semibold text-indigo-700">
                          {marginPerUnit == null ? "Pending sync" : formatCurrency(marginPerUnit)}
                        </td>
                        <td className="px-6 py-5 text-sm font-semibold text-violet-700">
                          {expectedMargin == null ? "Pending sync" : formatCurrency(expectedMargin)}
                        </td>
                        <td className="px-6 py-5 text-sm text-zinc-700">{product.minimum_order_quantity || 1}</td>
                        <td className="px-6 py-5 text-sm text-zinc-700">
                          <div className="max-w-[240px] space-y-1">
                            {(product.quantity_discounts || []).length > 0 ? (
                              product.quantity_discounts
                                ?.slice(0, 2)
                                .map((discount, index) => (
                                  <div key={`${product.id}-${index}`} className="text-xs text-zinc-600">
                                    {formatDiscountLabel(discount)}
                                  </div>
                                ))
                            ) : (
                              <span className="text-xs text-zinc-400">No bulk slab</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStockStatusClasses(product.stock)}`}>
                            {getStockStatusLabel(product.stock)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900">Top Expensive Products</h2>
            <div className="mt-5 space-y-3">
              {topExpensiveProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/70 px-4 py-4">
                  <div>
                    <div className="font-semibold text-zinc-900">{product.name}</div>
                    <div className="text-xs text-zinc-500">{product.brand_info?.name || "Unbranded"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-zinc-900">{formatCurrency(product.price)}</div>
                    <div className="text-xs text-zinc-500">Sell price</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900">Lowest Stock Products</h2>
            <div className="mt-5 space-y-3">
              {lowestStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/70 px-4 py-4">
                  <div>
                    <div className="font-semibold text-zinc-900">{product.name}</div>
                    <div className="text-xs text-zinc-500">{product.category_info?.name || "Uncategorized"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-zinc-900">{product.stock} units</div>
                    <div className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStockStatusClasses(product.stock)}`}>
                      {getStockStatusLabel(product.stock)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900">Category-wise Stock Distribution</h2>
            <div className="mt-5 space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.name} className="rounded-2xl border border-zinc-100 bg-zinc-50/70 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-zinc-900">{item.name}</div>
                    <div className="text-sm font-bold text-zinc-900">{formatCurrency(item.value)}</div>
                  </div>
                  <div className="mt-2 text-sm text-zinc-500">
                    {item.products} products | {item.units} units
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900">Brand-wise Product Count</h2>
            <div className="mt-5 space-y-3">
              {brandBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/70 px-4 py-4">
                  <div className="font-semibold text-zinc-900">{item.name}</div>
                  <div className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white">
                    {item.count} products
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
