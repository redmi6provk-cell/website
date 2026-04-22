"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  FilePenLine,
  Landmark,
  RefreshCcw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { canAccessERP } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAuthStore } from "@/store/authStore";

interface Summary {
  total_receivable: number;
  total_payable: number;
  cash_total: number;
  bank_accounts: { name: string; balance: number }[];
}

interface PaymentModeTransaction {
  payment_id: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  remarks: string;
  reference_id: string;
  reference_label: string;
  party_id: string;
  party_name: string;
  party_type: string;
  source_module: string;
  direction: string;
}

type ManualTransactionForm = {
  payment_id: string;
  direction: string;
  payment_mode: string;
  amount: string;
  transaction_date: string;
  reference_id: string;
  reference_label: string;
  party_id: string;
  party_name: string;
  party_type: string;
  remarks: string;
};

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatPaymentModeLabel(value: string) {
  return value.trim().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSourceLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTransactionDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

export default function ARPDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [summary, setSummary] = useState<Summary>({
    total_receivable: 0,
    total_payable: 0,
    cash_total: 0,
    bank_accounts: [],
  });
  const [transactions, setTransactions] = useState<PaymentModeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [editingTransaction, setEditingTransaction] = useState<ManualTransactionForm | null>(null);
  const [isSavingManualTransaction, setIsSavingManualTransaction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    const sumRes = await api.get("/admin/arp/summary");
    setSummary(
      sumRes.data.data || {
        total_receivable: 0,
        total_payable: 0,
        cash_total: 0,
        bank_accounts: [],
      }
    );
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchSummary();
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError, "ARP summary load nahi ho pa raha hai."));
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

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
  }, [isInitialized, isAuthenticated, user, router, fetchData]);

  const paymentModeCards = useMemo(
    () => [
      { label: "Cash", value: summary.cash_total, tone: "bg-emerald-50 text-emerald-700", mode: "cash" },
      ...summary.bank_accounts.map((account, index) => ({
        label: account.name.trim(),
        value: account.balance,
        tone: index % 2 === 0 ? "bg-blue-50 text-blue-700" : "bg-cyan-50 text-cyan-700",
        mode: account.name.trim(),
      })),
    ],
    [summary]
  );

  const selectedMode = useMemo(() => {
    const queryMode = searchParams.get("mode")?.trim();
    if (queryMode) {
      return queryMode;
    }
    return paymentModeCards[0]?.mode || "cash";
  }, [paymentModeCards, searchParams]);

  useEffect(() => {
    if (!selectedMode || !isInitialized || !isAuthenticated || !user || !canAccessERP(user.role)) {
      return;
    }

    const fetchTransactions = async () => {
      setIsTransactionsLoading(true);
      setError(null);
      try {
        const res = await api.get(`/admin/arp/payment-transactions?mode=${encodeURIComponent(selectedMode)}`);
        setTransactions(res.data.data || []);
      } catch (fetchError) {
        setTransactions([]);
        setError(getApiErrorMessage(fetchError, "Transactions load nahi ho rahi hain."));
      } finally {
        setIsTransactionsLoading(false);
      }
    };

    void fetchTransactions();
  }, [selectedMode, isInitialized, isAuthenticated, user]);

  const refreshTransactions = useCallback(async () => {
    if (!selectedMode) return;
    setIsTransactionsLoading(true);
    try {
      const res = await api.get(`/admin/arp/payment-transactions?mode=${encodeURIComponent(selectedMode)}`);
      setTransactions(res.data.data || []);
    } catch (fetchError) {
      setTransactions([]);
      setError(getApiErrorMessage(fetchError, "Transactions load nahi ho rahi hain."));
    } finally {
      setIsTransactionsLoading(false);
    }
  }, [selectedMode]);

  const filteredTransactions = transactions.filter((transaction) => {
    const value = transactionSearch.toLowerCase();
    return (
      !value ||
      (transaction.party_name || "").toLowerCase().includes(value) ||
      (transaction.reference_label || "").toLowerCase().includes(value) ||
      (transaction.reference_id || "").toLowerCase().includes(value) ||
      (transaction.remarks || "").toLowerCase().includes(value) ||
      formatSourceLabel(transaction.source_module).toLowerCase().includes(value)
    );
  });

  const selectedModeBalance =
    paymentModeCards.find((item) => item.mode.toLowerCase() === selectedMode.toLowerCase())?.value || 0;

  const handleOpenPaymentMode = (mode: string) => {
    router.push(`/admin/arp?mode=${encodeURIComponent(mode)}`);
  };

  const isManualTransaction = (transaction: PaymentModeTransaction) =>
    transaction.source_module.toLowerCase() === "manual_payment";

  const openManualEdit = (transaction: PaymentModeTransaction) => {
    setEditingTransaction({
      payment_id: transaction.payment_id,
      direction: transaction.direction || "in",
      payment_mode: transaction.payment_mode || selectedMode,
      amount: String(transaction.amount || ""),
      transaction_date: transaction.payment_date ? new Date(transaction.payment_date).toISOString().slice(0, 10) : "",
      reference_id: transaction.reference_id || "",
      reference_label: transaction.reference_label || "",
      party_id: transaction.party_id || "",
      party_name: transaction.party_name || "",
      party_type: transaction.party_type || "",
      remarks: transaction.remarks || "",
    });
  };

  const handleOpenSource = (transaction: PaymentModeTransaction) => {
    const source = transaction.source_module.toLowerCase();
    const referenceId = (transaction.reference_id || "").split("::")[0];

    if (source === "order_cod" && referenceId) {
      router.push(`/admin/orders?orderId=${referenceId}`);
      return;
    }
    if (source === "offline_sale" && referenceId) {
      router.push(`/admin/offline-sell?edit=${referenceId}`);
      return;
    }
    if (transaction.party_id) {
      router.push(`/admin/arp/ledger/${transaction.party_id}`);
    }
  };

  const handleSaveManualTransaction = async () => {
    if (!editingTransaction) return;
    setIsSavingManualTransaction(true);
    setError(null);
    try {
      await api.put(`/admin/arp/manual-transactions/${editingTransaction.payment_id}`, {
        direction: editingTransaction.direction,
        payment_mode: editingTransaction.payment_mode,
        amount: Number(editingTransaction.amount || 0),
        transaction_date: editingTransaction.transaction_date,
        reference_id: editingTransaction.reference_id,
        reference_label: editingTransaction.reference_label,
        party_id: editingTransaction.party_id,
        party_name: editingTransaction.party_name,
        party_type: editingTransaction.party_type,
        remarks: editingTransaction.remarks,
      });
      await Promise.all([refreshTransactions(), fetchSummary()]);
      setEditingTransaction(null);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Manual transaction update nahi ho paya."));
    } finally {
      setIsSavingManualTransaction(false);
    }
  };

  if (!isInitialized || loading) {
    return (
      <PageLoader
        compact
        title="Initializing Financial Core"
        subtitle="Receivables aur payables data fetch ho raha hai."
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto max-w-[1600px] px-4">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
           
            
          </div>
          <div className="flex gap-3">
            <Button onClick={fetchData} variant="outline" className="h-14 w-14 rounded-2xl border-zinc-200 p-0">
              <RefreshCcw className="h-5 w-5 text-zinc-400" />
            </Button>
           
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

       

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-4">
              <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-700">Payment Mode Overview</h3>
              <p className="mt-2 text-sm font-medium text-zinc-500">
                Left sidebar se mode select karo, right side me full ledger transactions dikhenge.
              </p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {paymentModeCards.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleOpenPaymentMode(item.mode)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-4 py-4 text-left transition ${
                    item.mode.toLowerCase() === selectedMode.toLowerCase()
                      ? "bg-sky-100/70"
                      : "hover:bg-zinc-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${item.tone}`}
                    >
                      {item.label}
                    </div>
                    <div className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      {item.mode.toLowerCase() === "cash" ? "Cash Mode" : "Bank Account"}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-black text-zinc-900">{formatCurrency(item.value)}</div>
                </button>
              ))}
            </div>
            {summary.bank_accounts.length === 0 && (
              <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                Bank cards dikhane ke liye settings me bank account add karo.
              </div>
            )}
          </aside>

          <section className="overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                  {selectedMode.toLowerCase() === "cash" ? <Wallet className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900">{formatPaymentModeLabel(selectedMode)}</h2>
                  <p className="mt-1 text-sm text-zinc-500">Transactions ledger</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">Active Balance</div>
                  <div className="mt-1 text-lg font-black text-zinc-900">{formatCurrency(selectedModeBalance)}</div>
                </div>
                <div className="relative min-w-0 flex-1 sm:min-w-[280px]">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={transactionSearch}
                    onChange={(event) => setTransactionSearch(event.target.value)}
                    placeholder="Search reference, party, remarks"
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
                  {filteredTransactions.length} entries
                </div>
              </div>
            </div>
            </div>

            {isTransactionsLoading ? (
              <div className="py-20 text-center text-sm font-black uppercase tracking-[0.2em] text-zinc-400">
                Loading transactions...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">No transactions found</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <div className="grid grid-cols-[180px_minmax(240px,1fr)_180px_180px_230px] gap-4 border-b border-zinc-100 bg-zinc-50/70 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    <div>Type</div>
                    <div>Name</div>
                    <div>Date</div>
                    <div>Amount</div>
                    <div>Actions</div>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    {filteredTransactions.map((transaction) => (
                      <div
                        key={transaction.payment_id}
                        className="grid grid-cols-[180px_minmax(240px,1fr)_180px_180px_230px] gap-4 border-b border-zinc-100 px-6 py-4 text-left transition hover:bg-sky-50/60"
                      >
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {isManualTransaction(transaction) ? "Manual Entry" : formatSourceLabel(transaction.source_module)}
                          </div>
                          <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            transaction.direction === "out" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {transaction.direction === "out" ? "Debit" : "Credit"}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">{transaction.party_name || "Walk-in Entry"}</div>
                          <div className="mt-1 text-sm text-zinc-500">
                            {transaction.reference_label || transaction.reference_id || transaction.payment_id}
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">{transaction.remarks || "No remarks"}</div>
                        </div>
                        <div className="text-sm font-medium text-zinc-700">{formatTransactionDate(transaction.payment_date)}</div>
                        <div className={`text-sm font-black ${transaction.direction === "out" ? "text-red-500" : "text-emerald-600"}`}>
                          {transaction.direction === "out" ? "-" : "+"}
                          {formatCurrency(transaction.amount)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isManualTransaction(transaction) ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openManualEdit(transaction)}
                              className="rounded-xl"
                            >
                              <FilePenLine className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenSource(transaction)}
                              className="rounded-xl"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Source
                            </Button>
                          )}
                          {transaction.party_id ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/admin/arp/ledger/${transaction.party_id}`)}
                              className="rounded-xl"
                            >
                              Ledger
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 p-4 lg:hidden">
                  {filteredTransactions.map((transaction) => (
                    <div
                      key={transaction.payment_id}
                      className="w-full rounded-[1.5rem] border border-zinc-200 bg-zinc-50/70 p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-zinc-900">{transaction.party_name || "Walk-in Entry"}</div>
                          <div className="mt-1 text-xs text-zinc-500">{formatTransactionDate(transaction.payment_date)}</div>
                        </div>
                        <div className={`text-sm font-black ${transaction.direction === "out" ? "text-red-500" : "text-emerald-600"}`}>
                          {transaction.direction === "out" ? "-" : "+"}
                          {formatCurrency(transaction.amount)}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-zinc-600">
                          {isManualTransaction(transaction) ? "Manual Entry" : formatSourceLabel(transaction.source_module)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                          transaction.direction === "out" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {transaction.direction === "out" ? "Debit" : "Credit"}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-zinc-600">
                        {transaction.reference_label || transaction.reference_id || transaction.payment_id}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">{transaction.remarks || "No remarks"}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {isManualTransaction(transaction) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openManualEdit(transaction)}
                            className="rounded-xl"
                          >
                            <FilePenLine className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenSource(transaction)}
                            className="rounded-xl"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open Source
                          </Button>
                        )}
                        {transaction.party_id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/arp/ledger/${transaction.party_id}`)}
                            className="rounded-xl"
                          >
                            Ledger
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {editingTransaction ? (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-zinc-950/35 backdrop-blur-sm" onClick={() => setEditingTransaction(null)} />
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
              <div className="w-full rounded-[2rem] border border-zinc-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">Manual Transaction</div>
                    <h3 className="mt-2 text-2xl font-black text-zinc-900">Edit Entry</h3>
                    <p className="mt-1 text-sm text-zinc-500">Yahin se sirf manual ARP transaction update karo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingTransaction(null)}
                    className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid gap-4 p-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Direction</label>
                    <select
                      value={editingTransaction.direction}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, direction: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="in">Credit</option>
                      <option value="out">Debit</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Payment Mode</label>
                    <input
                      value={editingTransaction.payment_mode}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, payment_mode: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingTransaction.amount}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, amount: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Transaction Date</label>
                    <input
                      type="date"
                      value={editingTransaction.transaction_date}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, transaction_date: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Reference ID</label>
                    <input
                      value={editingTransaction.reference_id}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, reference_id: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Reference Label</label>
                    <input
                      value={editingTransaction.reference_label}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, reference_label: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Party ID</label>
                    <input
                      value={editingTransaction.party_id}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, party_id: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Party Name</label>
                    <input
                      value={editingTransaction.party_name}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, party_name: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Party Type</label>
                    <input
                      value={editingTransaction.party_type}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, party_type: event.target.value } : current)}
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Remarks</label>
                    <textarea
                      rows={4}
                      value={editingTransaction.remarks}
                      onChange={(event) => setEditingTransaction((current) => current ? { ...current, remarks: event.target.value } : current)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-zinc-100 px-6 py-5">
                  <Button
                    type="button"
                    onClick={handleSaveManualTransaction}
                    isLoading={isSavingManualTransaction}
                    className="rounded-2xl px-6"
                  >
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingTransaction(null)} className="rounded-2xl px-6">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
