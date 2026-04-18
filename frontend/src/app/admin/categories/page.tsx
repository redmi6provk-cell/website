"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SuccessPopup } from "@/components/ui/SuccessPopup";
import ImageUploader from "@/components/ui/ImageUploader";
import { 
  Plus, 
  Search, 
  Trash2, 
  Layers,
  ChevronLeft,
  Pencil
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
}

export default function CategoriesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    image_url: ""
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) {
      router.push("/");
      return;
    }

    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) {
      fetchCategories();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/admin/categories");
      setCategories(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingCategoryId) {
        await api.put(`/admin/categories/${editingCategoryId}`, newCategory);
      } else {
        await api.post("/admin/categories", newCategory);
      }
      await fetchCategories();
      setIsModalOpen(false);
      setSuccessMessage(editingCategoryId ? "Category updated successfully." : "Category created successfully.");
      setEditingCategoryId(null);
      setNewCategory({ name: "", description: "", image_url: "" });
    } catch (error) {
      alert("Failed to save category.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setNewCategory({
      name: category.name,
      description: category.description || "",
      image_url: category.image_url || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This might affect products in this category.")) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      await fetchCategories();
    } catch (error) {
      alert("Delete failed");
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isInitialized || loading) return <div className="p-12 text-center">Loading Categories Master...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="rounded-full">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-4xl font-black tracking-tight text-zinc-900 mb-2 uppercase">CATEGORIES</h1>
                <p className="text-zinc-500 font-medium tracking-tight">Organize your products into meaningful groups.</p>
            </div>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="rounded-2xl h-14 px-8 bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-bold"
          >
            <Plus className="h-5 w-5 mr-3" /> Add Category
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-8">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <input 
                type="text" 
                placeholder="Search categories..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-6 h-16 bg-white border border-zinc-100 rounded-[1.5rem] shadow-sm text-zinc-900 font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
            />
        </div>

        {/* List */}
        <div className="grid grid-cols-1 gap-4">
            {filteredCategories.map((c) => (
                <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-green-100 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-zinc-50 flex items-center justify-center overflow-hidden border border-zinc-100">
                            {c.image_url ? (
                                <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                            ) : (
                                <Layers className="h-6 w-6 text-zinc-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-zinc-900 uppercase">{c.name}</h3>
                            <p className="text-sm text-zinc-400 font-medium">{c.description || "No description provided"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 transition-all group-hover:opacity-100">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(c)}
                            className="h-12 w-12 p-0 rounded-2xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 border border-zinc-50"
                        >
                            <Pencil className="h-5 w-5" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(c.id)}
                            className="h-12 w-12 p-0 rounded-2xl text-red-300 hover:text-red-600 hover:bg-red-50 border border-zinc-50"
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            ))}

            {filteredCategories.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-zinc-200">
                    <Layers className="h-12 w-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">No categories found</p>
                </div>
            )}
        </div>

        <Modal
            isOpen={isModalOpen}
            onClose={() => {
                setIsModalOpen(false);
                setEditingCategoryId(null);
                setNewCategory({ name: "", description: "", image_url: "" });
            }}
            title={editingCategoryId ? "Edit Category" : "Add Category"}
        >
            <form onSubmit={handleSaveCategory} className="space-y-6">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Category Name</label>
                    <Input 
                        required
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                        placeholder="e.g. Beverages, Snacks, Personal Care"
                        className="h-14 rounded-2xl"
                    />
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Description</label>
                    <textarea 
                        className="w-full rounded-2xl border border-zinc-100 p-4 text-zinc-900 focus:ring-2 focus:ring-green-500 outline-none transition-all placeholder:text-zinc-300 text-sm font-medium"
                        rows={3}
                        value={newCategory.description}
                        onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                        placeholder="Optional description..."
                    />
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Image URL</label>
                    <Input 
                        value={newCategory.image_url}
                        onChange={(e) => setNewCategory({...newCategory, image_url: e.target.value})}
                        placeholder="https://example.com/image.jpg"
                        className="h-14 rounded-2xl"
                    />
                    <div className="mt-3">
                        <ImageUploader
                            value={newCategory.image_url}
                            onUploaded={(url) => setNewCategory({...newCategory, image_url: url})}
                        />
                    </div>
                </div>
                <Button 
                    type="submit" 
                    className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black uppercase tracking-widest mt-4"
                    isLoading={isSubmitting}
                >
                    {editingCategoryId ? "Update Category" : "Save Category"}
                </Button>
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
