"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import ImageUploader from "@/components/ui/ImageUploader";
import { 
  Plus, 
  Search, 
  Trash2, 
  Tag,
  ChevronLeft,
  Pencil
} from "lucide-react";

interface Brand {
  id: string;
  name: string;
  logo_url: string;
}

export default function BrandsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);

  const [newBrand, setNewBrand] = useState({
    name: "",
    logo_url: ""
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
      fetchBrands();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const fetchBrands = async () => {
    try {
      const res = await api.get("/admin/brands");
      setBrands(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch brands");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingBrandId) {
        await api.put(`/admin/brands/${editingBrandId}`, newBrand);
      } else {
        await api.post("/admin/brands", newBrand);
      }
      await fetchBrands();
      setIsModalOpen(false);
      setEditingBrandId(null);
      setNewBrand({ name: "", logo_url: "" });
    } catch (error) {
      alert("Failed to save brand.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrandId(brand.id);
    setNewBrand({
      name: brand.name,
      logo_url: brand.logo_url || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/admin/brands/${id}`);
      await fetchBrands();
    } catch (error) {
      alert("Delete failed");
    }
  };

  const filteredBrands = brands.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isInitialized || loading) return <div className="p-12 text-center">Loading Brands Master...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="rounded-full">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-4xl font-black tracking-tight text-zinc-900 mb-2 uppercase">BRANDS</h1>
                <p className="text-zinc-500 font-medium tracking-tight">Manage the brands for your products.</p>
            </div>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="rounded-2xl h-14 px-8 bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-bold"
          >
            <Plus className="h-5 w-5 mr-3" /> Add Brand
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-8">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <input 
                type="text" 
                placeholder="Search brands..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-6 h-16 bg-white border border-zinc-100 rounded-[1.5rem] shadow-sm text-zinc-900 font-medium focus:ring-2 focus:ring-green-500 outline-none transition-all"
            />
        </div>

        {/* List */}
        <div className="grid grid-cols-1 gap-4">
            {filteredBrands.map((b) => (
                <div key={b.id} className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-zinc-50 flex items-center justify-center overflow-hidden border border-zinc-100">
                            {b.logo_url ? (
                                <img src={b.logo_url} alt={b.name} className="h-full w-full object-contain p-2" />
                            ) : (
                                <Tag className="h-6 w-6 text-zinc-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-zinc-900 uppercase">{b.name}</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 transition-all group-hover:opacity-100">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(b)}
                            className="h-12 w-12 p-0 rounded-2xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 border border-zinc-50"
                        >
                            <Pencil className="h-5 w-5" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDelete(b.id)}
                            className="h-12 w-12 p-0 rounded-2xl text-red-300 hover:text-red-600 hover:bg-red-50 border border-zinc-50"
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            ))}

            {filteredBrands.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-zinc-200">
                    <Tag className="h-12 w-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">No brands found</p>
                </div>
            )}
        </div>

        <Modal
            isOpen={isModalOpen}
            onClose={() => {
                setIsModalOpen(false);
                setEditingBrandId(null);
                setNewBrand({ name: "", logo_url: "" });
            }}
            title={editingBrandId ? "Edit Brand" : "Add Brand"}
        >
            <form onSubmit={handleSaveBrand} className="space-y-6">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Brand Name</label>
                    <Input 
                        required
                        value={newBrand.name}
                        onChange={(e) => setNewBrand({...newBrand, name: e.target.value})}
                        placeholder="e.g. Nestlé, Unilever, Tata"
                        className="h-14 rounded-2xl"
                    />
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Logo URL</label>
                    <Input 
                        value={newBrand.logo_url}
                        onChange={(e) => setNewBrand({...newBrand, logo_url: e.target.value})}
                        placeholder="https://example.com/logo.png"
                        className="h-14 rounded-2xl"
                    />
                    <div className="mt-3">
                        <ImageUploader
                            value={newBrand.logo_url}
                            onUploaded={(url) => setNewBrand({...newBrand, logo_url: url})}
                            label="Upload logo"
                        />
                    </div>
                </div>
                <Button 
                    type="submit" 
                    className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black uppercase tracking-widest mt-4"
                    isLoading={isSubmitting}
                >
                    {editingBrandId ? "Update Brand" : "Save Brand"}
                </Button>
            </form>
        </Modal>
      </div>
    </div>
  );
}
