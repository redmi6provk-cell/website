"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessERP } from "@/lib/roles";
import api from "@/lib/api";
import { 
  Mail, 
  Phone, 
  Search,
  UserPlus,
  Pencil,
  Trash2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

interface Contact {
  contact_type: string;
  contact_value: string;
}

interface Party {
  party_id: string;
  name: string;
  type: string;
  created_at: string;
  contacts?: Contact[];
}

export default function PartiesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // For editing
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    type: "customer",
    phone: "",
    email: ""
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessERP(user.role)))) {
      router.push("/");
      return;
    }

    if (isInitialized && isAuthenticated && user && canAccessERP(user.role)) {
      fetchParties();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const fetchParties = async () => {
    try {
      const res = await api.get("/admin/arp/parties");
      setParties(res.data.data || []);
    } catch {
      console.error("Failed to fetch parties");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingParty(null);
    setFormData({ name: "", type: "customer", phone: "", email: "" });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setFormData({
        name: party.name,
        type: party.type,
        phone: party.contacts?.find(c => c.contact_type === 'phone')?.contact_value || "",
        email: party.contacts?.find(c => c.contact_type === 'email')?.contact_value || ""
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingParty) {
        await api.put(`/admin/arp/parties/${editingParty.party_id}`, {
            name: formData.name,
            type: formData.type,
            contacts: [
                { contact_type: "phone", contact_value: formData.phone },
                { contact_type: "email", contact_value: formData.email }
            ]
        });
      } else {
          const payload = {
            name: formData.name,
            type: formData.type,
            contacts: [
                { contact_type: "phone", contact_value: formData.phone },
                { contact_type: "email", contact_value: formData.email }
            ]
          };
          await api.post("/admin/arp/parties", payload);
      }
      
      await fetchParties();
      setIsModalOpen(false);
    } catch {
      alert("Failed to save party. Please check logs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Are you sure you want to delete this party? Note: This might fail if they have associated ledger entries.")) return;
      try {
          await api.delete(`/admin/arp/parties/${id}`);
          await fetchParties();
      } catch {
          alert("Failed to delete party. They might have active ledger balances.");
      }
  };

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isInitialized || loading) return <div className="p-12 text-center text-zinc-400 font-bold uppercase tracking-widest animate-pulse">Loading Parties Master...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-zinc-900 mb-2 uppercase">Parties Master</h1>
            <p className="text-zinc-500 font-medium tracking-tight">Manage your Customers and Suppliers information.</p>
          </div>
          <Button 
            onClick={handleOpenAdd}
            className="rounded-2xl h-14 px-8 bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-bold uppercase tracking-widest text-[10px]"
          >
            <UserPlus className="h-5 w-5 mr-3" /> Add New Party
          </Button>
        </div>

        {/* Search & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div className="lg:col-span-3 relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Search by name or contact..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-16 pr-6 h-16 bg-white border border-zinc-100 rounded-[1.5rem] shadow-sm text-zinc-900 font-medium focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                />
            </div>
            <div className="bg-green-100/50 border border-green-100 rounded-[1.5rem] p-4 flex items-center justify-center gap-4">
                <div className="text-center">
                    <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">Total Active</p>
                    <p className="text-2xl font-black text-green-900">{parties.length}</p>
                </div>
                <div className="h-8 w-px bg-green-200" />
                <div className="text-center">
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Customers</p>
                    <p className="text-2xl font-black text-blue-900">{parties.filter(p => p.type === 'customer').length}</p>
                </div>
            </div>
        </div>

        {/* Parties List (Table) */}
        <div className="bg-white rounded-[3rem] border border-zinc-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-zinc-50/50">
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Party</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Contact</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Created</th>
                            <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {filteredParties.map((party) => (
                            <tr key={party.party_id} className="hover:bg-zinc-50/50 transition-all">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-xl flex flex-shrink-0 items-center justify-center font-black text-lg ${
                                            party.type === 'customer' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                                        }`}>
                                            {party.name[0].toUpperCase()}
                                        </div>
                                        <span className="font-bold text-zinc-900 uppercase tracking-tight">{party.name}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
                                        party.type === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                        {party.type}
                                    </span>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-zinc-600 font-medium text-xs">
                                            <Phone className="h-3 w-3 text-zinc-400" />
                                            <span>{party.contacts?.find(c => c.contact_type === 'phone')?.contact_value || "-"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-600 font-medium text-xs">
                                            <Mail className="h-3 w-3 text-zinc-400" />
                                            <span>{party.contacts?.find(c => c.contact_type === 'email')?.contact_value || "-"}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-xs font-bold text-zinc-400 uppercase">
                                    {new Date(party.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button 
                                            onClick={() => handleOpenEdit(party)}
                                            variant="ghost" 
                                            className="h-10 w-10 p-0 rounded-xl text-zinc-400 hover:text-blue-600 hover:bg-blue-50"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            onClick={() => handleDelete(party.party_id)}
                                            variant="ghost" 
                                            className="h-10 w-10 p-0 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredParties.length === 0 && (
                <div className="p-20 text-center">
                    <AlertCircle className="h-12 w-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">No parties found matching your search</p>
                </div>
            )}
        </div>

        <Modal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            title={editingParty ? "Edit Party" : "Add New Party"}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Party Name</label>
                    <Input 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="ABC Enterprises"
                        className="h-14 rounded-2xl"
                    />
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Type</label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setFormData({...formData, type: "customer"})}
                            className={`flex-1 h-14 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all ${
                                formData.type === 'customer' ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' : 'bg-zinc-50 text-zinc-400 border border-zinc-100'
                            }`}
                        >
                            Customer
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({...formData, type: "supplier"})}
                            className={`flex-1 h-14 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all ${
                                formData.type === 'supplier' ? 'bg-orange-100 text-orange-700 border-2 border-orange-200' : 'bg-zinc-50 text-zinc-400 border border-zinc-100'
                            }`}
                        >
                            Supplier
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Phone Number</label>
                    <Input 
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="10-digit phone"
                        maxLength={10}
                        className="h-14 rounded-2xl"
                    />
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Email Address</label>
                    <Input 
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="email@example.com"
                        className="h-14 rounded-2xl"
                    />
                </div>
                <Button 
                    type="submit" 
                    className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black uppercase tracking-widest mt-4"
                    isLoading={isSubmitting}
                >
                    {editingParty ? "Save Changes" : "Create Party"}
                </Button>
            </form>
        </Modal>
      </div>
    </div>
  );
}
