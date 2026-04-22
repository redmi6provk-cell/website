"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SuccessPopup } from "@/components/ui/SuccessPopup";
import ImageUploader from "@/components/ui/ImageUploader";
import { QuantityDiscount } from "@/types";
import { formatDiscountLabel } from "@/lib/pricing";
import {
  Archive,
  BarChart3,
  ChevronLeft,
  CircleDot,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: string;
  brand_id: string;
  minimum_order_quantity?: number;
  quantity_discounts?: QuantityDiscount[];
  category_info?: Category;
  brand_info?: Brand;
  image_url: string;
  secondary_image_url?: string;
  is_active: boolean;
  can_delete?: boolean;
}

interface ProductDraft {
  name: string;
  description: string;
  price: string;
  stock: string;
  category_id: string;
  brand_id: string;
  image_url: string;
  secondary_image_url: string;
  minimum_order_quantity: string;
  quantity_discounts: Array<{
    min_quantity: string;
    max_quantity: string;
    discount_type: "PERCENT" | "FIXED";
    discount_value: string;
  }>;
}

const emptyDraft = (): ProductDraft => ({
  name: "",
  description: "",
  price: "",
  stock: "",
  category_id: "",
  brand_id: "",
  image_url: "",
  secondary_image_url: "",
  minimum_order_quantity: "1",
  quantity_discounts: [
    {
      min_quantity: "",
      max_quantity: "",
      discount_type: "PERCENT",
      discount_value: "",
    },
  ],
});

function formatPrice(price: number) {
  return `Rs. ${Number(price || 0).toLocaleString("en-IN")}`;
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

function getStockTone(stock: number) {
  if (stock <= 0) return "text-red-600";
  if (stock <= 10) return "text-amber-600";
  return "text-zinc-700";
}

export default function AdminProductsPage() {
  const ADD_NEW_CATEGORY_VALUE = "__add_new_category__";
  const ADD_NEW_BRAND_VALUE = "__add_new_brand__";
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showNewCategoryField, setShowNewCategoryField] = useState(false);
  const [showNewBrandField, setShowNewBrandField] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [newProduct, setNewProduct] = useState<ProductDraft>(emptyDraft());

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) {
      router.push("/");
      return;
    }

    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) {
      fetchData();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const fetchData = async () => {
    try {
      const [pRes, cRes, bRes] = await Promise.all([
        api.get("/admin/products"),
        api.get("/admin/categories"),
        api.get("/admin/brands"),
      ]);
      setProducts(pRes.data.data?.items || []);
      setCategories(cRes.data.data || []);
      setBrands(bRes.data.data || []);
    } catch (error) {
      console.error("Failed to fetch products/categories/brands", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSlab = (
    index: number,
    field: "min_quantity" | "max_quantity" | "discount_type" | "discount_value",
    value: string
  ) => {
    setNewProduct((current) => ({
      ...current,
      quantity_discounts: current.quantity_discounts.map((slab, slabIndex) =>
        slabIndex === index ? { ...slab, [field]: value } : slab
      ),
    }));
  };

  const addSlabRow = () => {
    setNewProduct((current) => ({
      ...current,
      quantity_discounts: [
        ...current.quantity_discounts,
        {
          min_quantity: "",
          max_quantity: "",
          discount_type: "PERCENT",
          discount_value: "",
        },
      ],
    }));
  };

  const removeSlabRow = (index: number) => {
    setNewProduct((current) => ({
      ...current,
      quantity_discounts:
        current.quantity_discounts.length === 1
          ? current.quantity_discounts.map((slab, slabIndex) =>
              slabIndex === index
                ? { min_quantity: "", max_quantity: "", discount_type: "PERCENT", discount_value: "" }
                : slab
            )
          : current.quantity_discounts.filter((_, slabIndex) => slabIndex !== index),
    }));
  };

  const buildProductPayload = () => ({
    ...newProduct,
    price: parseFloat(newProduct.price),
    stock: parseInt(newProduct.stock, 10),
    minimum_order_quantity: parseInt(newProduct.minimum_order_quantity, 10),
    quantity_discounts: newProduct.quantity_discounts
      .filter((slab) => slab.min_quantity && slab.discount_value)
      .map((slab) => ({
        min_quantity: parseInt(slab.min_quantity, 10),
        max_quantity: slab.max_quantity ? parseInt(slab.max_quantity, 10) : null,
        discount_type: slab.discount_type,
        discount_value: parseFloat(slab.discount_value),
      })),
  });

  const resetModalState = () => {
    setEditingProductId(null);
    setFormError(null);
    setShowNewCategoryField(false);
    setShowNewBrandField(false);
    setNewCategoryName("");
    setNewBrandName("");
    setNewProduct(emptyDraft());
  };

  const openCreateModal = () => {
    resetModalState();
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (!newProduct.category_id) {
        setFormError("Category select ya create karni zaroori hai.");
        return;
      }

      if (!newProduct.brand_id) {
        setFormError("Brand select ya create karna zaroori hai.");
        return;
      }

      const payload = buildProductPayload();

      if (editingProductId) {
        await api.put(`/admin/products/${editingProductId}`, payload);
      } else {
        await api.post("/admin/products", payload);
      }

      await fetchData();
      setIsModalOpen(false);
      setSuccessMessage(editingProductId ? "Product updated successfully." : "Product created successfully.");
      resetModalState();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Failed to save product."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProductId(product.id);
    setFormError(null);
    setShowNewCategoryField(false);
    setShowNewBrandField(false);
    setNewCategoryName("");
    setNewBrandName("");
    setNewProduct({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      stock: String(product.stock),
      category_id: product.category_id || "",
      brand_id: product.brand_id || "",
      image_url: product.image_url || "",
      secondary_image_url: product.secondary_image_url || "",
      minimum_order_quantity: String(product.minimum_order_quantity || 1),
      quantity_discounts:
        product.quantity_discounts && product.quantity_discounts.length > 0
          ? product.quantity_discounts.map((slab) => ({
              min_quantity: String(slab.min_quantity),
              max_quantity: slab.max_quantity == null ? "" : String(slab.max_quantity),
              discount_type: slab.discount_type,
              discount_value: String(slab.discount_value),
            }))
          : emptyDraft().quantity_discounts,
    });
    setIsModalOpen(true);
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setFormError("Category name required hai.");
      return;
    }

    setIsCreatingCategory(true);
    setFormError(null);
    try {
      const res = await api.post("/admin/categories", {
        name: trimmedName,
        description: "",
        image_url: "",
      });
      const createdCategory = res.data.data;
      await fetchData();
      setNewProduct((current) => ({
        ...current,
        category_id: createdCategory?.id || current.category_id,
      }));
      setShowNewCategoryField(false);
      setNewCategoryName("");
    } catch (error) {
      setFormError(getApiErrorMessage(error, "New category save nahi ho paayi."));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleCreateBrand = async () => {
    const trimmedName = newBrandName.trim();
    if (!trimmedName) {
      setFormError("Brand name required hai.");
      return;
    }

    setIsCreatingBrand(true);
    setFormError(null);
    try {
      const res = await api.post("/admin/brands", {
        name: trimmedName,
        logo_url: "",
      });
      const createdBrand = res.data.data;
      await fetchData();
      setNewProduct((current) => ({
        ...current,
        brand_id: createdBrand?.id || current.brand_id,
      }));
      setShowNewBrandField(false);
      setNewBrandName("");
    } catch (error) {
      setFormError(getApiErrorMessage(error, "New brand save nahi ho paaya."));
    } finally {
      setIsCreatingBrand(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product permanently? Ye sirf tab kaam karega jab product kisi order me use na hua ho.")) {
      return;
    }

    try {
      await api.delete(`/admin/products/${id}`);
      await fetchData();
    } catch (error) {
      alert(getApiErrorMessage(error, "Delete failed"));
    }
  };

  const handleToggleActive = async (product: Product) => {
    const nextState = !product.is_active;
    const actionLabel = nextState ? "show" : "hide";
    if (!confirm(`Are you sure? Product ${actionLabel} ho jayega.`)) {
      return;
    }

    try {
      await api.put(`/admin/products/${product.id}/active`, { is_active: nextState });
      await fetchData();
    } catch (error) {
      alert(getApiErrorMessage(error, "Visibility update failed"));
    }
  };

  const handleViewTransactions = (product: Product) => {
    router.push(`/admin/products/${product.id}/transactions`);
  };

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.brand_info?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [products, searchTerm]
  );

  const stats = useMemo(() => {
    const activeProducts = products.filter((product) => product.is_active).length;
    const hiddenProducts = products.length - activeProducts;
    const lowStockProducts = products.filter((product) => product.stock > 0 && product.stock <= 10).length;

    return [
      {
        label: "Total products",
        value: products.length,
        detail: "All catalog items",
        icon: Package,
      },
      {
        label: "Visible now",
        value: activeProducts,
        detail: "Showing on storefront",
        icon: CircleDot,
      },
      {
        label: "Hidden",
        value: hiddenProducts,
        detail: "Kept off storefront",
        icon: EyeOff,
      },
      {
        label: "Low stock",
        value: lowStockProducts,
        detail: "Need attention soon",
        icon: Archive,
      },
    ];
  }, [products]);

  if (!isInitialized || loading) {
    return <div className="p-12 text-center">Loading Products Management...</div>;
  }

  return (
    <div className="min-h-screen bg-transparent py-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin")}
              className="mt-1 h-10 w-10 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">Catalog</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-[2.5rem]">Products</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                Pricing, stock, visibility, and bulk slabs ek hi jagah se manage karo.
              </p>
            </div>
          </div>

          <Button
            onClick={openCreateModal}
            className="h-12 w-full rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white hover:bg-zinc-800 md:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" /> Add product
          </Button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, detail, icon: Icon }) => (
            <div
              key={label}
              className="rounded-[1.75rem] border border-zinc-200/80 bg-white px-5 py-4 shadow-[0_18px_50px_-45px_rgba(15,23,42,0.35)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-500">{label}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{value}</p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">{detail}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_24px_70px_-55px_rgba(15,23,42,0.35)]">
          <div className="border-b border-zinc-100 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-950">Product list</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {filteredProducts.length} of {products.length} products visible
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-[22rem]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by name or brand"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-11 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
                  Active {stats[1].value} / Hidden {stats[2].value}
                </div>
              </div>
            </div>
          </div>

          <div className="md:hidden">
            <div className="space-y-3 p-4">
              {filteredProducts.map((product) => (
                <article key={product.id} className="rounded-[1.5rem] border border-zinc-200 bg-white p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-24 shrink-0 gap-2">
                      {product.image_url ? (
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100">
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100">
                          <ImageIcon className="h-5 w-5 text-zinc-300" />
                        </div>
                      )}
                      {product.secondary_image_url ? (
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100">
                          <img
                            src={product.secondary_image_url}
                            alt={`${product.name} alternate`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-900">{product.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{product.brand_info?.name || "No brand"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-600">
                          {product.category_info?.name || "No category"}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-600">
                          MOQ {product.minimum_order_quantity || 1}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                            product.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {product.is_active ? "Active" : "Hidden"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3 text-sm">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Price</div>
                      <div className="mt-1 font-semibold text-zinc-900">{formatPrice(product.price)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Stock</div>
                      <div className={`mt-1 font-medium ${getStockTone(product.stock)}`}>{product.stock} units</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        Discount slabs
                      </div>
                      <div className="mt-2 space-y-1">
                        {(product.quantity_discounts || []).length > 0 ? (
                          (product.quantity_discounts || []).slice(0, 2).map((slab, index) => (
                            <div key={`${product.id}-${index}`} className="text-xs leading-5 text-zinc-600">
                              {formatDiscountLabel(slab)}
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400">No bulk slab</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(product)}
                      className="h-11 rounded-2xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    >
                      {product.is_active ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                      {product.is_active ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(product)}
                      className="h-11 rounded-2xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewTransactions(product)}
                      className="h-11 rounded-2xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Transactions
                    </Button>
                  </div>

                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(product.id)}
                      disabled={!product.can_delete}
                      className="h-11 w-full rounded-2xl border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {product.can_delete ? "Delete" : "Delete blocked by orders"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Product</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Category</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MOQ</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Discount slabs
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Stock
                  </th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-zinc-50/70">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {product.image_url ? (
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-zinc-100">
                              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-zinc-100">
                              <ImageIcon className="h-5 w-5 text-zinc-300" />
                            </div>
                          )}
                          {product.secondary_image_url ? (
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-zinc-100">
                              <img
                                src={product.secondary_image_url}
                                alt={`${product.name} alternate`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <p className="font-semibold text-zinc-900">{product.name}</p>
                          <p className="text-xs text-zinc-500">{product.brand_info?.name || "No brand"}</p>
                          <p className={`mt-1 text-[11px] font-semibold ${product.is_active ? "text-emerald-600" : "text-zinc-400"}`}>
                            {product.is_active ? "Active" : "Hidden"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-600">
                        {product.category_info?.name || "No category"}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-zinc-700">
                      {product.minimum_order_quantity || 1} pcs
                    </td>
                    <td className="px-6 py-5">
                      <div className="max-w-sm space-y-1">
                        {(product.quantity_discounts || []).length > 0 ? (
                          (product.quantity_discounts || []).slice(0, 2).map((slab, index) => (
                            <div key={`${product.id}-${index}`} className="text-xs text-zinc-600">
                              {formatDiscountLabel(slab)}
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400">No bulk slab</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-semibold text-zinc-900">{formatPrice(product.price)}</td>
                    <td className={`px-6 py-5 text-right text-sm font-medium ${getStockTone(product.stock)}`}>
                      {product.stock} units
                    </td>
                    <td className="space-x-2 px-6 py-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(product)}
                        className="h-10 w-10 rounded-full border border-zinc-200 p-0 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                        title={product.is_active ? "Hide product" : "Show product"}
                      >
                        {product.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(product)}
                        className="h-10 w-10 rounded-full border border-zinc-200 p-0 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                        title="Edit product"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewTransactions(product)}
                        className="h-10 w-10 rounded-full border border-zinc-200 p-0 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                        title="View transactions"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        disabled={!product.can_delete}
                        className="h-10 w-10 rounded-full border border-zinc-200 p-0 text-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-zinc-300"
                        title={product.can_delete ? "Delete product" : "Delete blocked by orders"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="border-t border-zinc-100 px-6 py-16 text-center">
              <div className="mx-auto max-w-md">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-900">No matching products</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Search term change karke dekho, ya phir naya product add karo.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            resetModalState();
          }}
          title={editingProductId ? "Edit Product" : "Add Product"}
          size="xl"
        >
          <form onSubmit={handleSaveProduct} className="grid grid-cols-1 gap-6 p-1 md:grid-cols-2">
            {formError ? (
              <div className="md:col-span-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            ) : null}

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Product Name</label>
              <Input
                required
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Maggi Noodles 12pk"
                className="h-14 rounded-2xl"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Description</label>
              <textarea
                className="w-full rounded-2xl border border-zinc-100 p-4 text-sm font-medium text-zinc-900 outline-none transition-all placeholder:text-zinc-300 focus:ring-2 focus:ring-green-500"
                rows={3}
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                placeholder="Premium instant noodles..."
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Category</label>
              <select
                required
                value={showNewCategoryField ? ADD_NEW_CATEGORY_VALUE : newProduct.category_id}
                onChange={(e) => {
                  if (e.target.value === ADD_NEW_CATEGORY_VALUE) {
                    setShowNewCategoryField(true);
                    setNewProduct({ ...newProduct, category_id: "" });
                    return;
                  }
                  setShowNewCategoryField(false);
                  setNewCategoryName("");
                  setNewProduct({ ...newProduct, category_id: e.target.value });
                }}
                className="h-14 w-full rounded-2xl border border-zinc-100 bg-white px-4 text-sm font-medium text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value={ADD_NEW_CATEGORY_VALUE}>+ Add new category</option>
              </select>
              {showNewCategoryField ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    className="h-12 rounded-2xl"
                  />
                  <Button type="button" onClick={handleCreateCategory} isLoading={isCreatingCategory} className="h-12 rounded-2xl px-4">
                    Save
                  </Button>
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Brand</label>
              <select
                required
                value={showNewBrandField ? ADD_NEW_BRAND_VALUE : newProduct.brand_id}
                onChange={(e) => {
                  if (e.target.value === ADD_NEW_BRAND_VALUE) {
                    setShowNewBrandField(true);
                    setNewProduct({ ...newProduct, brand_id: "" });
                    return;
                  }
                  setShowNewBrandField(false);
                  setNewBrandName("");
                  setNewProduct({ ...newProduct, brand_id: e.target.value });
                }}
                className="h-14 w-full rounded-2xl border border-zinc-100 bg-white px-4 text-sm font-medium text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select Brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
                <option value={ADD_NEW_BRAND_VALUE}>+ Add new brand</option>
              </select>
              {showNewBrandField ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="New brand name"
                    className="h-12 rounded-2xl"
                  />
                  <Button type="button" onClick={handleCreateBrand} isLoading={isCreatingBrand} className="h-12 rounded-2xl px-4">
                    Save
                  </Button>
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Base Price (Rs.)</label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                placeholder="10"
                className="h-14 rounded-2xl"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Initial Stock</label>
              <Input
                required
                type="number"
                min="0"
                value={newProduct.stock}
                onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                placeholder="100"
                className="h-14 rounded-2xl"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                Minimum Order Quantity
              </label>
              <Input
                required
                type="number"
                min="1"
                value={newProduct.minimum_order_quantity}
                onChange={(e) => setNewProduct({ ...newProduct, minimum_order_quantity: e.target.value })}
                placeholder="5"
                className="h-14 rounded-2xl"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Primary Image URL</label>
              <Input
                value={newProduct.image_url}
                onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="h-14 rounded-2xl"
              />
              <div className="mt-3">
                <ImageUploader
                  value={newProduct.image_url}
                  onUploaded={(url) => setNewProduct({ ...newProduct, image_url: url })}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Second Image URL</label>
              <Input
                value={newProduct.secondary_image_url}
                onChange={(e) => setNewProduct({ ...newProduct, secondary_image_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="h-14 rounded-2xl"
              />
              <div className="mt-3">
                <ImageUploader
                  value={newProduct.secondary_image_url}
                  onUploaded={(url) => setNewProduct({ ...newProduct, secondary_image_url: url })}
                  label="Upload second image"
                />
              </div>
            </div>

            <div className="md:col-span-2 rounded-[2rem] border border-zinc-100 bg-zinc-50/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-700">Quantity Discount Slabs</h3>
                  <p className="mt-1 text-sm text-zinc-500">Example: 5-9 no discount, 10-19 X% off, 20+ Y% off</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSlabRow}>
                  <Plus className="mr-2 h-4 w-4" /> Add slab
                </Button>
              </div>

              <div className="space-y-4">
                {newProduct.quantity_discounts.map((slab, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-100 bg-white p-4 md:grid-cols-[1.1fr_1.1fr_1.4fr_1.2fr_auto] md:items-end"
                  >
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Min Qty
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="5"
                        value={slab.min_quantity}
                        onChange={(e) => updateSlab(index, "min_quantity", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Max Qty
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Leave blank for open ended"
                        value={slab.max_quantity}
                        onChange={(e) => updateSlab(index, "max_quantity", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Discount Type
                      </label>
                      <select
                        value={slab.discount_type}
                        onChange={(e) =>
                          updateSlab(index, "discount_type", e.target.value as "PERCENT" | "FIXED")
                        }
                        className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="PERCENT">% Off</option>
                        <option value="FIXED">Fixed Rs. Off</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Discount Value
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={slab.discount_type === "PERCENT" ? "10" : "5"}
                        value={slab.discount_value}
                        onChange={(e) => updateSlab(index, "discount_value", e.target.value)}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSlabRow(index)}
                      className="h-10 w-10 rounded-xl border border-zinc-100 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 md:col-span-2">
              <Button
                type="submit"
                className="h-14 w-full rounded-2xl bg-zinc-900 font-black uppercase tracking-widest text-white"
                isLoading={isSubmitting}
              >
                {editingProductId ? "Update Product" : "Save Product"}
              </Button>
            </div>
          </form>
        </Modal>

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
