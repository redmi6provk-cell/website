"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessERP } from "@/lib/roles";
import api from "@/lib/api";
import { 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Users, 
  ChevronRight,
  Search,
  RefreshCcw,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Summary {
  total_receivable: number;
  total_payable: number;
  cash_total: number;
  bank_accounts: { name: string; balance: number }[];
}

interface LedgerEntry {
  party_id: string;
  party_name: string;
  party_type: string;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
}

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function ARPDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [summary, setSummary] = useState<Summary>({
    total_receivable: 0,
    total_payable: 0,
    cash_total: 0,
    bank_accounts: [],
  });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessERP(user.role)))) {
      router.push("/");
      return;
    }

    if (isInitialized && isAuthenticated && user && canAccessERP(user.role)) {
      fetchData();
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, ledRes] = await Promise.all([
        api.get("/admin/arp/summary"),
        api.get("/admin/arp/ledger")
      ]);
      setSummary(sumRes.data.data || {
        total_receivable: 0,
        total_payable: 0,
        cash_total: 0,
        bank_accounts: [],
      });
      setLedger(ledRes.data.data || []);
    } catch {
      console.error("Failed to fetch ARP data");
    } finally {
      setLoading(false);
    }
  };

  const filteredLedger = ledger.filter(entry => 
    entry.party_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paymentModeCards = [
    { label: "Cash", value: summary.cash_total, tone: "bg-emerald-50 text-emerald-700", mode: "cash" },
    ...summary.bank_accounts.map((account, index) => ({
      label: account.name.trim(),
      value: account.balance,
      tone: index % 2 === 0 ? "bg-blue-50 text-blue-700" : "bg-cyan-50 text-cyan-700",
      mode: account.name.trim(),
    })),
  ];

  const handleOpenPaymentMode = (mode: string) => {
    router.push(`/admin/arp/payment-modes?mode=${encodeURIComponent(mode)}`);
  };

  if (!isInitialized || loading) return <div className="p-12 text-center font-black uppercase tracking-widest text-zinc-400 animate-pulse">Initializing Financial Core...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 bg-zinc-900 rounded-xl flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">FINANCIAL INTELLIGENCE</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-zinc-900 uppercase">ERP DASHBOARD</h1>
                <p className="text-zinc-500 font-medium mt-2">Monitor your business cash flow, receivables, and payables in real-time.</p>
            </div>
            <div className="flex gap-3">
                <Button onClick={fetchData} variant="outline" className="rounded-2xl h-14 w-14 p-0 border-zinc-200">
                    <RefreshCcw className="h-5 w-5 text-zinc-400" />
                </Button>
                <Button onClick={() => router.push("/admin/parties")} className="rounded-2xl h-14 px-8 bg-zinc-900 text-white font-bold uppercase tracking-widest text-xs">
                    <Users className="h-5 w-5 mr-3" /> Manage Parties
                </Button>
            </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
            {/* Receivable */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8">
                    <ArrowUpRight className="h-8 w-8 text-green-100 transition-colors group-hover:text-green-500" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Total Receivables</p>
                <h2 className="text-4xl font-black text-zinc-900">₹{summary.total_receivable?.toLocaleString() || 0}</h2>
                <div className="mt-6 flex items-center gap-2">
                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase">Due from Customers</span>
                </div>
            </div>

            {/* Payable */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8">
                    <ArrowDownLeft className="h-8 w-8 text-red-100 transition-colors group-hover:text-red-500" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Total Payables</p>
                <h2 className="text-4xl font-black text-zinc-900">₹{summary.total_payable?.toLocaleString() || 0}</h2>
                <div className="mt-6 flex items-center gap-2">
                    <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase">Due to Suppliers</span>
                </div>
            </div>

            {/* Net Balance */}
            <div className="bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-800 shadow-xl relative overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Net Balance</p>
                <h2 className="text-4xl font-black text-white">₹{(summary.total_receivable - summary.total_payable).toLocaleString()}</h2>
                <div className="mt-6 flex items-center gap-2">
                    <span className="px-3 py-1 bg-white/10 text-white rounded-full text-[10px] font-black uppercase">Overall Position</span>
                </div>
            </div>
        </div>

        <div className="mb-12 rounded-[2.5rem] border border-zinc-100 bg-white p-8 shadow-sm">
            <div className="mb-6">
                <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Payment Mode Overview</h3>
                <p className="mt-2 text-sm font-medium text-zinc-500">Kisi bhi mode par click karke uski saari payment transactions dekh sakte ho.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {paymentModeCards.map((item) => (
                    <button
                        key={item.label}
                        type="button"
                        onClick={() => handleOpenPaymentMode(item.mode)}
                        className="rounded-[1.75rem] border border-zinc-100 bg-zinc-50/70 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white"
                    >
                        <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${item.tone}`}>
                            {item.label}
                        </div>
                        <div className="mt-4 text-3xl font-black tracking-tight text-zinc-900">
                            {formatCurrency(item.value)}
                        </div>
                        <div className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Click To View Transactions</div>
                    </button>
                ))}
            </div>
            {summary.bank_accounts.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                    Bank cards dikhane ke liye settings me bank account add karo.
                </div>
            )}
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-[3rem] border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-10 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h3 className="text-2xl font-black text-zinc-900 uppercase">Party-wise Ledger</h3>
                    <p className="text-zinc-400 font-medium text-sm">Detailed outstanding balance for each customer and supplier.</p>
                </div>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                    <input 
                        type="text" 
                        placeholder="Search party..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-16 pr-6 h-14 bg-zinc-50 border-none rounded-2xl text-zinc-900 font-medium focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-zinc-50/50">
                            <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Party</th>
                            <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                            <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Invoiced</th>
                            <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Paid</th>
                            <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Outstanding</th>
                            <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {filteredLedger.map((entry) => (
                            <tr key={entry.party_id} className="group hover:bg-zinc-50/50 transition-all cursor-pointer" onClick={() => router.push(`/admin/arp/ledger/${entry.party_id}`)}>
                                <td className="px-10 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-black text-lg ${
                                            entry.party_type === 'customer' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                                        }`}>
                                            {entry.party_name[0].toUpperCase()}
                                        </div>
                                        <span className="font-bold text-zinc-900 group-hover:text-zinc-600 uppercase">{entry.party_name}</span>
                                    </div>
                                </td>
                                <td className="px-10 py-6">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                        entry.party_type === 'customer' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                                    }`}>
                                        {entry.party_type}
                                    </span>
                                </td>
                                <td className="px-10 py-6 font-bold text-zinc-900">₹{entry.total_invoiced.toLocaleString()}</td>
                                <td className="px-10 py-6 font-bold text-green-600">₹{entry.total_paid.toLocaleString()}</td>
                                <td className="px-10 py-6">
                                    <span className={`font-black text-lg ${entry.outstanding_balance > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                                        ₹{entry.outstanding_balance.toLocaleString()}
                                    </span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <Button variant="ghost" className="rounded-xl h-10 w-10 p-0 text-zinc-300 group-hover:text-zinc-900">
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredLedger.length === 0 && (
                <div className="p-20 text-center">
                    <BookOpen className="h-12 w-12 text-zinc-100 mx-auto mb-4" />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">No ledger entries found</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
