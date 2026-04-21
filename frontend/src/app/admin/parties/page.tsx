"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessERP } from "@/lib/roles";
import api from "@/lib/api";
import {
  AlertCircle,
  Building2,
  ChevronRight,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Search,
  Trash2,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { SuccessPopup } from "@/components/ui/SuccessPopup";
import { PageLoader } from "@/components/ui/PageLoader";

interface Contact {
  contact_type: string;
  contact_value: string;
}

interface Party {
  party_id: string;
  name: string;
  shop_name?: string;
  type: string;
  created_at: string;
  contacts?: Contact[];
}

interface LedgerEntry {
  party_id: string;
  party_name: string;
  party_type: string;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
}

interface Transaction {
  date: string;
  type: string;
  ref_id: string;
  invoice_id?: string;
  payment_id?: string;
  source_module?: string;
  amount: number;
  balance: number;
  payment_mode?: string;
  remarks: string;
}

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatType(value: string) {
  return value === "invoice" ? "Invoice" : "Payment";
}

function getContactValue(party: Party, type: string) {
  return party.contacts?.find((contact) => contact.contact_type === type)?.contact_value || "";
}

export default function PartiesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [parties, setParties] = useState<Party[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeActionRow, setActiveActionRow] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvoiceEditOpen, setIsInvoiceEditOpen] = useState(false);
  const [isPaymentEditOpen, setIsPaymentEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    shop_name: "",
    type: "customer",
    phone: "",
    email: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_no: "",
    invoice_date: "",
    due_date: "",
    total_amount: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    payment_date: "",
    payment_mode: "cash",
    amount: "",
    remarks: "",
  });

  const fetchParties = useCallback(async () => {
    try {
      const [partiesRes, ledgerRes] = await Promise.all([
        api.get("/admin/arp/parties"),
        api.get("/admin/arp/ledger"),
      ]);

      const fetchedParties = (partiesRes.data.data || []) as Party[];
      const fetchedLedger = (ledgerRes.data.data || []) as LedgerEntry[];

      setParties(fetchedParties);
      setLedger(fetchedLedger);

      if (fetchedParties.length > 0) {
        const nextSelected =
          fetchedParties.find((party) => party.party_id === selectedPartyId)?.party_id ||
          fetchedParties[0].party_id;
        setSelectedPartyId(nextSelected);
      } else {
        setSelectedPartyId("");
        setTransactions([]);
      }
    } catch (error) {
      console.error("Failed to fetch parties", error);
    } finally {
      setLoading(false);
    }
  }, [selectedPartyId]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessERP(user.role)))) {
      router.push("/");
      return;
    }

    if (isInitialized && isAuthenticated && user && canAccessERP(user.role)) {
      void fetchParties();
    }
  }, [fetchParties, isInitialized, isAuthenticated, user, router]);

  const loadSelectedPartyHistory = useCallback(async (partyId: string) => {
    if (!partyId) {
      setTransactions([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const response = await api.get(`/admin/arp/ledger/${partyId}`);
      setTransactions((response.data.data || []) as Transaction[]);
    } catch (error) {
      console.error("Failed to fetch party history", error);
      setTransactions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const filteredParties = useMemo(() => {
    return parties.filter((party) =>
      [
        party.name,
        party.shop_name,
        getContactValue(party, "phone"),
        getContactValue(party, "email"),
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [parties, searchTerm]);

  useEffect(() => {
    if (filteredParties.length === 0) {
      setSelectedPartyId("");
      setTransactions([]);
      return;
    }

    if (!filteredParties.some((party) => party.party_id === selectedPartyId)) {
      setSelectedPartyId(filteredParties[0].party_id);
    }
  }, [filteredParties, selectedPartyId]);

  useEffect(() => {
    void loadSelectedPartyHistory(selectedPartyId);
  }, [loadSelectedPartyHistory, selectedPartyId]);

  const selectedParty = useMemo(
    () => filteredParties.find((party) => party.party_id === selectedPartyId) || parties.find((party) => party.party_id === selectedPartyId) || null,
    [filteredParties, parties, selectedPartyId]
  );

  const selectedLedger = useMemo(
    () => ledger.find((entry) => entry.party_id === selectedPartyId) || null,
    [ledger, selectedPartyId]
  );

  const totalReceivable = useMemo(
    () =>
      ledger
        .filter((entry) => entry.party_type === "customer" && entry.outstanding_balance > 0)
        .reduce((sum, entry) => sum + entry.outstanding_balance, 0),
    [ledger]
  );

  const totalPayable = useMemo(
    () =>
      ledger
        .filter((entry) => entry.party_type === "supplier" && entry.outstanding_balance > 0)
        .reduce((sum, entry) => sum + entry.outstanding_balance, 0),
    [ledger]
  );

  const handleOpenAdd = () => {
    setEditingParty(null);
    setFormData({ name: "", shop_name: "", type: "customer", phone: "", email: "" });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      shop_name: party.shop_name || "",
      type: party.type,
      phone: getContactValue(party, "phone"),
      email: getContactValue(party, "email"),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        shop_name: formData.shop_name,
        type: formData.type,
        contacts: [
          { contact_type: "phone", contact_value: formData.phone },
          { contact_type: "email", contact_value: formData.email },
        ],
      };

      if (editingParty) {
        await api.put(`/admin/arp/parties/${editingParty.party_id}`, payload);
      } else {
        await api.post("/admin/arp/parties", payload);
      }

      await fetchParties();
      setIsModalOpen(false);
      setSuccessMessage(editingParty ? "Party updated successfully." : "Party created successfully.");
    } catch (error) {
      console.error("Failed to save party", error);
      alert("Failed to save party. Please check logs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this party? This can fail if ledger history already exists.")) {
      return;
    }

    try {
      await api.delete(`/admin/arp/parties/${id}`);
      await fetchParties();
      if (selectedPartyId === id) {
        setSelectedPartyId("");
      }
    } catch (error) {
      console.error("Failed to delete party", error);
      alert("Failed to delete party. They might have active ledger balances.");
    }
  };

  const handleOpenInvoiceEdit = (transaction: Transaction) => {
    setActiveActionRow(null);
    setEditingTransaction(transaction);
    setInvoiceForm({
      invoice_no: transaction.ref_id || "",
      invoice_date: transaction.date ? new Date(transaction.date).toISOString().slice(0, 10) : "",
      due_date: transaction.date ? new Date(transaction.date).toISOString().slice(0, 10) : "",
      total_amount: String(transaction.amount || ""),
    });
    setIsInvoiceEditOpen(true);
  };

  const handleOpenPaymentEdit = (transaction: Transaction) => {
    setActiveActionRow(null);
    setEditingTransaction(transaction);
    setPaymentForm({
      payment_date: transaction.date ? new Date(transaction.date).toISOString().slice(0, 10) : "",
      payment_mode: transaction.payment_mode || "cash",
      amount: String(transaction.amount || ""),
      remarks: transaction.remarks || "",
    });
    setIsPaymentEditOpen(true);
  };

  const isManualPaymentTransaction = (transaction: Transaction) => transaction.source_module === "manual_payment";

  const handleInvoiceUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTransaction?.invoice_id) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.put(`/admin/arp/invoices/${editingTransaction.invoice_id}`, {
        invoice_no: invoiceForm.invoice_no.trim(),
        invoice_date: invoiceForm.invoice_date,
        due_date: invoiceForm.due_date,
        total_amount: Number(invoiceForm.total_amount),
      });

      setIsInvoiceEditOpen(false);
      setEditingTransaction(null);
      await fetchParties();
      await loadSelectedPartyHistory(selectedPartyId);
      setSuccessMessage("Invoice updated successfully.");
    } catch (error) {
      console.error("Failed to update invoice", error);
      alert("Invoice update nahi ho paaya.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTransaction?.payment_id) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (isManualPaymentTransaction(editingTransaction) && selectedParty) {
        await api.put(`/admin/arp/manual-transactions/${editingTransaction.payment_id}`, {
          direction: "in",
          payment_mode: paymentForm.payment_mode,
          amount: Number(paymentForm.amount),
          transaction_date: paymentForm.payment_date,
          reference_id: "",
          reference_label: editingTransaction.ref_id || `Payment-In ${selectedParty.name}`,
          party_id: selectedParty.party_id,
          party_name: selectedParty.name,
          party_type: selectedParty.type,
          remarks: paymentForm.remarks.trim(),
        });
      } else {
        await api.put(`/admin/arp/payments/${editingTransaction.payment_id}`, {
          payment_date: paymentForm.payment_date,
          payment_mode: paymentForm.payment_mode,
          amount: Number(paymentForm.amount),
          remarks: paymentForm.remarks.trim(),
        });
      }

      setIsPaymentEditOpen(false);
      setEditingTransaction(null);
      await fetchParties();
      await loadSelectedPartyHistory(selectedPartyId);
      setSuccessMessage("Payment updated successfully.");
    } catch (error) {
      console.error("Failed to update payment", error);
      alert("Payment update nahi ho paaya.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isInitialized || loading) {
    return (
      <PageLoader
        compact
        title="Loading Parties"
        subtitle="Party list aur transaction history ready ki ja rahi hai."
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] py-6 md:py-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">Accounts Parties</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">Party Ledger Workspace</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Kisi bhi party par click karo aur uski poori history, running balance, aur ledger movement ek hi screen par dekho.
            </p>
          </div>
          <Button
            onClick={handleOpenAdd}
            className="h-12 rounded-full bg-rose-600 px-6 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-rose-700"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add Party
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <div className="rounded-[2rem] border border-white bg-white px-5 py-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Parties</div>
            <div className="mt-3 text-3xl font-black text-zinc-950">{parties.length}</div>
          </div>
          <div className="rounded-[2rem] border border-white bg-white px-5 py-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Customers</div>
            <div className="mt-3 text-3xl font-black text-blue-700">{parties.filter((party) => party.type === "customer").length}</div>
          </div>
          <div className="rounded-[2rem] border border-white bg-white px-5 py-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Receivable</div>
            <div className="mt-3 text-3xl font-black text-emerald-700">{formatCurrency(totalReceivable)}</div>
          </div>
          <div className="rounded-[2rem] border border-white bg-white px-5 py-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Payable</div>
            <div className="mt-3 text-3xl font-black text-rose-700">{formatCurrency(totalPayable)}</div>
          </div>
        </div>

        <div className="grid min-h-[720px] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search party name"
                  className="h-12 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-300 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_96px] border-b border-zinc-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
              <span>Party Name</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
              {filteredParties.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <AlertCircle className="mx-auto h-10 w-10 text-zinc-200" />
                  <p className="mt-4 text-sm font-medium text-zinc-500">Search ke hisaab se koi party nahi mili.</p>
                </div>
              ) : (
                filteredParties.map((party) => {
                  const partyLedger = ledger.find((entry) => entry.party_id === party.party_id);
                  const balance = partyLedger?.outstanding_balance || 0;
                  const isSelected = party.party_id === selectedPartyId;

                  return (
                    <button
                      key={party.party_id}
                      type="button"
                      onClick={() => setSelectedPartyId(party.party_id)}
                      className={`grid w-full grid-cols-[minmax(0,1fr)_96px] gap-3 border-b border-zinc-100 px-4 py-4 text-left transition ${
                        isSelected ? "bg-sky-100/70" : "bg-white hover:bg-zinc-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className={`truncate text-sm font-bold ${isSelected ? "text-zinc-950" : "text-zinc-800"}`}>{party.name}</div>
                        <div className="mt-1 truncate text-xs text-zinc-400">
                          {party.shop_name || getContactValue(party, "phone") || party.type}
                        </div>
                      </div>
                      <div className={`text-right text-sm font-black ${balance > 0 ? "text-rose-500" : "text-emerald-600"}`}>
                        {Number(balance).toLocaleString("en-IN")}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
            {selectedParty ? (
              <>
                <div className="border-b border-zinc-100 px-5 py-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="truncate text-2xl font-black tracking-tight text-zinc-950">{selectedParty.name}</h2>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            selectedParty.type === "customer" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {selectedParty.type}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {getContactValue(selectedParty, "phone") || "-"}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {getContactValue(selectedParty, "email") || "-"}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {selectedParty.shop_name || "No shop name"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-full px-4 text-xs font-black uppercase tracking-[0.16em]"
                        onClick={() => handleOpenEdit(selectedParty)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-full px-4 text-xs font-black uppercase tracking-[0.16em]"
                        onClick={() => router.push(`/admin/arp/ledger/${selectedParty.party_id}`)}
                      >
                        <ChevronRight className="mr-2 h-4 w-4" /> Open Detail
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 rounded-full px-4 text-xs font-black uppercase tracking-[0.16em] text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDelete(selectedParty.party_id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 border-b border-zinc-100 bg-zinc-50/70 px-5 py-4 md:grid-cols-3">
                  <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Total Invoiced</div>
                    <div className="mt-3 text-2xl font-black text-zinc-950">
                      {formatCurrency(selectedLedger?.total_invoiced || 0)}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Total Paid</div>
                    <div className="mt-3 text-2xl font-black text-emerald-700">
                      {formatCurrency(selectedLedger?.total_paid || 0)}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
                    <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      <Wallet className="h-4 w-4" />
                      Balance
                    </div>
                    <div className={`mt-3 text-2xl font-black ${(selectedLedger?.outstanding_balance || 0) > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {formatCurrency(selectedLedger?.outstanding_balance || 0)}
                    </div>
                  </div>
                </div>

                <div className="border-b border-zinc-100 px-5 py-4">
                  <h3 className="text-lg font-black text-zinc-950">Transactions</h3>
                  <p className="mt-1 text-sm text-zinc-500">Selected party ki poori ledger history yahan show ho rahi hai.</p>
                </div>

                {historyLoading ? (
                  <div className="px-6 py-12 text-sm font-medium text-zinc-500">History load ho rahi hai...</div>
                ) : transactions.length === 0 ? (
                  <div className="px-6 py-12 text-sm font-medium text-zinc-500">Is party ke liye abhi koi transaction history nahi hai.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-zinc-100 bg-zinc-50 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        <tr>
                          <th className="px-5 py-3">Type</th>
                          <th className="px-5 py-3">Number</th>
                          <th className="px-5 py-3">Date</th>
                          <th className="px-5 py-3">Mode</th>
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">Balance</th>
                          <th className="px-5 py-3">Remarks</th>
                          <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {transactions.map((transaction, index) => {
                          const rowKey = `${transaction.type}-${transaction.invoice_id || transaction.payment_id || transaction.ref_id}-${index}`;
                          const canEditInvoice = transaction.type === "invoice" && Boolean(transaction.invoice_id);
                          const canEditPayment =
                            transaction.type === "payment" &&
                            Boolean(transaction.payment_id) &&
                            (transaction.source_module === "arp_payment" || transaction.source_module === "manual_payment");
                          const isEditable = canEditInvoice || canEditPayment;

                          return (
                          <tr key={rowKey} className="hover:bg-zinc-50/70">
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                  transaction.type === "invoice" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {formatType(transaction.type)}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-bold text-zinc-900">{transaction.ref_id || "-"}</td>
                            <td className="px-5 py-4 text-zinc-600">{formatDate(transaction.date)}</td>
                            <td className="px-5 py-4 text-zinc-600">{transaction.payment_mode || "-"}</td>
                            <td className={`px-5 py-4 font-black ${transaction.type === "invoice" ? "text-zinc-900" : "text-emerald-700"}`}>
                              {formatCurrency(transaction.amount)}
                            </td>
                            <td className="px-5 py-4 font-black text-zinc-900">{formatCurrency(transaction.balance)}</td>
                            <td className="px-5 py-4 text-zinc-500">{transaction.remarks || "-"}</td>
                            <td className="px-5 py-4 text-right">
                              {isEditable ? (
                                <div className="relative inline-flex">
                                  <button
                                    type="button"
                                    onClick={() => setActiveActionRow((current) => (current === rowKey ? null : rowKey))}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                  {activeActionRow === rowKey ? (
                                    <div className="absolute right-0 top-11 z-10 min-w-[160px] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-2 shadow-xl">
                                      <button
                                        type="button"
                                        onClick={() => (canEditInvoice ? handleOpenInvoiceEdit(transaction) : handleOpenPaymentEdit(transaction))}
                                        className="flex w-full items-center px-4 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        {canEditInvoice ? "Edit Invoice" : "Edit Payment"}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="inline-block h-9 w-9" aria-hidden="true" />
                              )}
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[480px] items-center justify-center px-6 text-center">
                <div>
                  <AlertCircle className="mx-auto h-12 w-12 text-zinc-200" />
                  <h3 className="mt-4 text-xl font-black text-zinc-900">Party select karo</h3>
                  <p className="mt-2 text-sm text-zinc-500">Left list me kisi party par click karoge to uski full history yahin show ho jayegi.</p>
                </div>
              </div>
            )}
          </section>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingParty ? "Edit Party" : "Add New Party"}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Party Name</label>
              <Input
                required
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="ABC Enterprises"
                className="h-14 rounded-2xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Shop Name</label>
              <Input
                value={formData.shop_name}
                onChange={(event) => setFormData({ ...formData, shop_name: event.target.value })}
                placeholder="Optional shop name"
                className="h-14 rounded-2xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "customer" })}
                  className={`flex-1 rounded-2xl border px-4 py-4 text-xs font-black uppercase tracking-widest transition ${
                    formData.type === "customer"
                      ? "border-blue-200 bg-blue-100 text-blue-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-500"
                  }`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "supplier" })}
                  className={`flex-1 rounded-2xl border px-4 py-4 text-xs font-black uppercase tracking-widest transition ${
                    formData.type === "supplier"
                      ? "border-amber-200 bg-amber-100 text-amber-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-500"
                  }`}
                >
                  Supplier
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Phone Number</label>
              <Input
                required
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                placeholder="10-digit phone"
                maxLength={10}
                className="h-14 rounded-2xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Email Address</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                placeholder="email@example.com"
                className="h-14 rounded-2xl"
              />
            </div>
            <Button
              type="submit"
              className="mt-4 h-14 w-full rounded-2xl bg-zinc-900 text-xs font-black uppercase tracking-widest text-white"
              isLoading={isSubmitting}
            >
              {editingParty ? "Save Changes" : "Create Party"}
            </Button>
          </form>
        </Modal>

        <Modal isOpen={isInvoiceEditOpen} onClose={() => setIsInvoiceEditOpen(false)} title="Edit Invoice">
          <form onSubmit={handleInvoiceUpdate} className="space-y-6">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Invoice Number</label>
              <Input
                required
                value={invoiceForm.invoice_no}
                onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_no: event.target.value })}
                className="h-14 rounded-2xl"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Invoice Date</label>
                <Input
                  required
                  type="date"
                  value={invoiceForm.invoice_date}
                  onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_date: event.target.value })}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Due Date</label>
                <Input
                  required
                  type="date"
                  value={invoiceForm.due_date}
                  onChange={(event) => setInvoiceForm({ ...invoiceForm, due_date: event.target.value })}
                  className="h-14 rounded-2xl"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Amount</label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={invoiceForm.total_amount}
                onChange={(event) => setInvoiceForm({ ...invoiceForm, total_amount: event.target.value })}
                className="h-14 rounded-2xl"
              />
            </div>
            <Button type="submit" className="h-14 w-full rounded-2xl bg-zinc-900 text-xs font-black uppercase tracking-widest text-white" isLoading={isSubmitting}>
              Update Invoice
            </Button>
          </form>
        </Modal>

        <Modal isOpen={isPaymentEditOpen} onClose={() => setIsPaymentEditOpen(false)} title="Edit Payment">
          <form onSubmit={handlePaymentUpdate} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Payment Date</label>
                <Input
                  required
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Payment Type</label>
                <Input
                  required
                  value={paymentForm.payment_mode}
                  onChange={(event) => setPaymentForm({ ...paymentForm, payment_mode: event.target.value })}
                  className="h-14 rounded-2xl"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Amount</label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                className="h-14 rounded-2xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">Remarks</label>
              <Input
                value={paymentForm.remarks}
                onChange={(event) => setPaymentForm({ ...paymentForm, remarks: event.target.value })}
                className="h-14 rounded-2xl"
              />
            </div>
            <Button type="submit" className="h-14 w-full rounded-2xl bg-zinc-900 text-xs font-black uppercase tracking-widest text-white" isLoading={isSubmitting}>
              Update Payment
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
