"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessERP } from "@/lib/roles";
import api from "@/lib/api";
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  History, 
  Filter, 
  Search,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface LedgerItem {
  party_id: string;
  party_name: string;
  party_type: string;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
}

export default function KhataBookPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [summary, setSummary] = useState({ total_receivable: 0, total_payable: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessERP(user.role)))) {
      router.push("/");
      return;
    }

    if (isInitialized && isAuthenticated && user && canAccessERP(user.role)) {
      const fetchData = async () => {
      try {
        const [lRes, sRes] = await Promise.all([
          api.get("/admin/arp/ledger"),
          api.get("/admin/arp/summary")
        ]);
        setLedger(lRes.data.data || []);
        setSummary(sRes.data.data || { total_receivable: 0, total_payable: 0 });
      } catch (error) {
        console.error("Failed to fetch ledger data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  if (!isInitialized || loading) return <div className="p-12 text-center">Loading Khata Book...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-zinc-900 mb-2">KHATA BOOK</h1>
            <p className="text-zinc-500 font-medium tracking-tight">Real-time ledger and outstanding balance tracking.</p>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" className="rounded-2xl border-zinc-200">
                <History className="h-4 w-4 mr-2" /> Export PDF
             </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-green-100 p-3 rounded-2xl text-green-600">
                <ArrowDownCircle className="h-6 w-6" />
              </div>
              <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Total Receivable</span>
            </div>
            <h2 className="text-4xl font-black text-zinc-900">₹{summary.total_receivable.toLocaleString()}</h2>
            <p className="text-sm text-zinc-400 mt-2 font-medium">Money owed by customers</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-orange-100 p-3 rounded-2xl text-orange-600">
                <ArrowUpCircle className="h-6 w-6" />
              </div>
              <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Total Payable</span>
            </div>
            <h2 className="text-4xl font-black text-zinc-900">₹{summary.total_payable.toLocaleString()}</h2>
            <p className="text-sm text-zinc-400 mt-2 font-medium">Money to pay to suppliers</p>
          </div>

          <div className="bg-zinc-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-zinc-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-white/10 p-3 rounded-2xl text-white">
                <Wallet className="h-6 w-6" />
              </div>
              <span className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Net Balance</span>
            </div>
            <h2 className="text-4xl font-black leading-none">₹{(summary.total_receivable - summary.total_payable).toLocaleString()}</h2>
            <p className="text-sm text-zinc-400 mt-2 font-medium">Estimated net cash position</p>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row justify-between gap-4">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Search parties..." 
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-green-500 transition-all font-medium"
                />
             </div>
             <div className="flex gap-2">
                <Button variant="ghost" className="rounded-xl text-zinc-500">
                   <Filter className="h-4 w-4 mr-2" /> Filter
                </Button>
             </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50/50">
                  <th className="px-8 py-5 text-xs font-bold text-zinc-500 uppercase tracking-widest">Party Name</th>
                  <th className="px-8 py-5 text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">Type</th>
                  <th className="px-8 py-5 text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Total Invoiced</th>
                  <th className="px-8 py-5 text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Total Paid</th>
                  <th className="px-8 py-5 text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Outstanding</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {ledger.map((item) => (
                  <tr key={item.party_id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-8 py-6 font-bold text-zinc-900">{item.party_name}</td>
                    <td className="px-8 py-6 text-center">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                         item.party_type === 'customer' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                       }`}>
                          {item.party_type}
                       </span>
                    </td>
                    <td className="px-8 py-6 text-right font-medium text-zinc-600">₹{item.total_invoiced.toLocaleString()}</td>
                    <td className="px-8 py-6 text-right font-medium text-green-600">₹{item.total_paid.toLocaleString()}</td>
                    <td className="px-8 py-6 text-right">
                       <span className={`font-black text-lg ${item.outstanding_balance > 0 ? 'text-orange-600' : 'text-zinc-400'}`}>
                          ₹{item.outstanding_balance.toLocaleString()}
                       </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <button className="p-2 rounded-xl bg-zinc-100 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                          <ChevronRight className="h-5 w-5" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
