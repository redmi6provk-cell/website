"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import ImageUploader from "@/components/ui/ImageUploader";
import { QuantityDiscount } from "@/types";
import { formatDiscountLabel } from "@/lib/pricing";
import {
  Plus,
  Search,
  Trash2,
  ChevronLeft,
  Image as ImageIcon,
  Pencil,
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
}

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

interface ProductDraft {
  name: string;
  description: string;
  price: string;
  stock: string;
  category_id: string;
  brand_id: string;
  image_url: string;
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

export default function AdminProductsPage() {
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
        api.get("/products"),
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

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = buildProductPayload();

      if (editingProductId) {
        await api.put(`/admin/products/${editingProductId}`, payload);
      } else {
        await api.post("/admin/products", payload);
      }
      await fetchData();
      setIsModalOpen(false);
      setEditingProductId(null);
      setNewProduct(emptyDraft());
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Failed to save product."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProductId(product.id);
    setFormError(null);
    setNewProduct({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      stock: String(product.stock),
      category_id: product.category_id || "",
      brand_id: product.brand_id || "",
      image_url: product.image_url || "",
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/admin/products/${id}`);
      await fetchData();
    } catch (error) {
      alert(getApiErrorMessage(error, "Delete failed"));
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand_info?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isInitialized || loading) return <div className="p-12 text-center">Loading Products Management...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="mb-2 text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">PRODUCTS MASTER</h1>
              <p className="max-w-2xl text-sm font-medium tracking-tight text-zinc-500 sm:text-base">
                Base price, minimum quantity, and bulk discount slabs manage karo.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="h-14 w-full rounded-2xl bg-zinc-900 px-8 font-bold text-white transition-all hover:bg-zinc-800 md:w-auto"
          >
            <Plus className="mr-3 h-5 w-5" /> Add New Product
          </Button>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search products by name or brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-16 w-full rounded-[1.5rem] border border-zinc-100 bg-white pl-16 pr-6 font-medium text-zinc-900 shadow-sm outline-none transition-all focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="overflow-hidden rounded-[2.5rem] border border-zinc-100 bg-white shadow-sm">
          <div className="md:hidden">
            <div className="space-y-4 p-4">
              {filteredProducts.map((p) => (
                <article key={p.id} className="rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 p-4 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-zinc-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold uppercase leading-5 text-zinc-900">{p.name}</p>
                      <p className="mt-1 text-xs font-medium text-zinc-400">{p.brand_info?.name || "No Brand"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-zinc-600">
                          {p.category_info?.name || "No Category"}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-zinc-600">
                          MOQ {p.minimum_order_quantity || 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-200 bg-white p-3 text-sm">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Base Price</div>
                      <div className="mt-1 font-bold text-zinc-900">{formatPrice(p.price)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Stock</div>
                      <div className="mt-1 font-medium text-zinc-700">{p.stock} units</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Discount Slabs</div>
                      <div className="mt-2 space-y-1">
                        {(p.quantity_discounts || []).length > 0 ? (
                          (p.quantity_discounts || []).slice(0, 2).map((slab, index) => (
                            <div key={`${p.id}-${index}`} className="text-xs leading-5 text-zinc-600">
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
                      onClick={() => handleEdit(p)}
                      className="h-11 rounded-2xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
                      className="h-11 rounded-2xl border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-zinc-50/50">
                <tr>
                  <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500">Product</th>
                  <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500">Category</th>
                  <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500">MOQ</th>
                  <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-zinc-500">Discount Slabs</th>
                  <th className="px-8 py-5 text-right text-xs font-bold uppercase tracking-widest text-zinc-500">Base Price</th>
                  <th className="px-8 py-5 text-right text-xs font-bold uppercase tracking-widest text-zinc-500">Stock</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="group transition-colors hover:bg-zinc-50/50">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-zinc-100">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-zinc-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold uppercase text-zinc-900">{p.name}</p>
                          <p className="text-xs font-medium text-zinc-400">{p.brand_info?.name || "No Brand"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-black uppercase text-zinc-600">
                        {p.category_info?.name || "No Category"}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm font-semibold text-zinc-700">
                      {p.minimum_order_quantity || 1} pcs
                    </td>
                    <td className="px-8 py-6">
                      <div className="max-w-sm space-y-1">
                        {(p.quantity_discounts || []).length > 0 ? (
                          (p.quantity_discounts || []).slice(0, 2).map((slab, index) => (
                            <div key={`${p.id}-${index}`} className="text-xs text-zinc-600">
                              {formatDiscountLabel(slab)}
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400">No bulk slab</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right font-bold text-zinc-900">{formatPrice(p.price)}</td>
                    <td className="px-8 py-6 text-right font-medium text-zinc-500">{p.stock} units</td>
                    <td className="space-x-2 px-8 py-6 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(p)}
                        className="h-10 w-10 rounded-xl border border-zinc-50 p-0 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.id)}
                        className="h-10 w-10 rounded-xl border border-zinc-50 p-0 text-red-300 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProductId(null);
            setFormError(null);
            setNewProduct(emptyDraft());
          }}
          title={editingProductId ? "Edit Product" : "Add Product"}
          size="xl"
        >
          <form onSubmit={handleSaveProduct} className="grid grid-cols-1 gap-6 p-1 md:grid-cols-2">
            {formError && (
              <div className="md:col-span-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}

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
                value={newProduct.category_id}
                onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                className="h-14 w-full rounded-2xl border border-zinc-100 px-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Brand</label>
              <select
                required
                value={newProduct.brand_id}
                onChange={(e) => setNewProduct({ ...newProduct, brand_id: e.target.value })}
                className="h-14 w-full rounded-2xl border border-zinc-100 px-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select Brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Minimum Order Quantity</label>
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
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Image URL</label>
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

            <div className="md:col-span-2 rounded-[2rem] border border-zinc-100 bg-zinc-50/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-700">Quantity Discount Slabs</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Example: 5-9 no discount, 10-19 X% off, 20+ Y% off
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSlabRow}>
                  <Plus className="mr-2 h-4 w-4" /> Add slab
                </Button>
              </div>

              <div className="space-y-4">
                {newProduct.quantity_discounts.map((slab, index) => (
                  <div key={index} className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-100 bg-white p-4 md:grid-cols-[1.1fr_1.1fr_1.4fr_1.2fr_auto] md:items-end">
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
                        onChange={(e) => updateSlab(index, "discount_type", e.target.value)}
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
      </div>
    </div>
  );
}
