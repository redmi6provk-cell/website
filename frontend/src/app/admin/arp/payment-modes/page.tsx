"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Landmark, Search, Wallet } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { canAccessERP } from "@/lib/roles";
import { Button } from "@/components/ui/Button";

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

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
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

export default function PaymentModesPage() {
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
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [accountsSearch, setAccountsSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessERP(user.role)))) {
      router.push("/");
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const paymentModes = useMemo(
    () => [
      { label: "Cash", mode: "cash", balance: summary.cash_total },
      ...summary.bank_accounts.map((account) => ({
        label: account.name.trim(),
        mode: account.name.trim(),
        balance: account.balance,
      })),
    ],
    [summary]
  );

  const selectedMode = useMemo(() => {
    const queryMode = searchParams.get("mode")?.trim();
    if (queryMode) {
      return queryMode;
    }
    return paymentModes[0]?.mode || "cash";
  }, [paymentModes, searchParams]);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsPageLoading(true);
      setError(null);
      try {
        const res = await api.get("/admin/arp/summary");
        setSummary(
          res.data.data || {
            total_receivable: 0,
            total_payable: 0,
            cash_total: 0,
            bank_accounts: [],
          }
        );
      } catch (fetchError) {
        setError(getApiErrorMessage(fetchError, "Payment modes load nahi ho pa rahe hain."));
      } finally {
        setIsPageLoading(false);
      }
    };

    if (isInitialized && isAuthenticated && user && canAccessERP(user.role)) {
      fetchSummary();
    }
  }, [isInitialized, isAuthenticated, user]);

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

    fetchTransactions();
  }, [selectedMode, isInitialized, isAuthenticated, user]);

  const filteredModes = paymentModes.filter((item) =>
    item.label.toLowerCase().includes(accountsSearch.toLowerCase())
  );

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
    paymentModes.find((item) => item.mode.toLowerCase() === selectedMode.toLowerCase())?.balance || 0;

  const handleSelectMode = (mode: string) => {
    router.push(`/admin/arp/payment-modes?mode=${encodeURIComponent(mode)}`);
  };

  if (!isInitialized || isPageLoading) {
    return <div className="p-12 text-center font-black uppercase tracking-widest text-zinc-400">Loading payment modes...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-8">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-4">
        <div className="mb-5 flex flex-col gap-4 rounded-[2rem] border border-zinc-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/arp")} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">Payment Mode Overview</h1>
              <p className="mt-1 text-sm text-zinc-500">Popup ki jagah full page ledger view, taake admin ko transactions easily manage ho sakein.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">Active Balance</div>
            <div className="mt-1 text-xl font-black text-zinc-900">{formatCurrency(selectedModeBalance)}</div>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-4">
              <div className="text-lg font-black text-zinc-900">Accounts</div>
              <div className="relative mt-4">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={accountsSearch}
                  onChange={(event) => setAccountsSearch(event.target.value)}
                  placeholder="Search account or mode"
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {filteredModes.map((item) => {
                const isActive = item.mode.toLowerCase() === selectedMode.toLowerCase();
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => handleSelectMode(item.mode)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-4 py-4 text-left transition ${
                      isActive ? "bg-sky-100/70" : "hover:bg-zinc-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-zinc-900">{item.label}</div>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        {item.mode.toLowerCase() === "cash" ? "Cash Mode" : "Bank Account"}
                      </div>
                    </div>
                    <div className={`shrink-0 text-sm font-bold ${item.balance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {formatCurrency(item.balance)}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                      {selectedMode.toLowerCase() === "cash" ? <Wallet className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-zinc-900">{formatPaymentModeLabel(selectedMode)}</h2>
                      <p className="mt-1 text-sm text-zinc-500">Transactions</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1 sm:min-w-[260px]">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={transactionSearch}
                      onChange={(event) => setTransactionSearch(event.target.value)}
                      placeholder="Search reference, party, remarks"
                      className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
                    {filteredTransactions.length} entries
                  </div>
                </div>
              </div>
            </div>

            {isTransactionsLoading ? (
              <div className="py-20 text-center text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Loading transactions...</div>
            ) : filteredTransactions.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">No transactions found</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <div className="grid grid-cols-[180px_minmax(240px,1fr)_180px_180px] gap-4 border-b border-zinc-100 bg-zinc-50/70 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    <div>Type</div>
                    <div>Name</div>
                    <div>Date</div>
                    <div>Amount</div>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    {filteredTransactions.map((transaction) => (
                      <button
                        key={transaction.payment_id}
                        type="button"
                        onClick={() => transaction.party_id && router.push(`/admin/arp/ledger/${transaction.party_id}`)}
                        className="grid w-full grid-cols-[180px_minmax(240px,1fr)_180px_180px] gap-4 border-b border-zinc-100 px-6 py-4 text-left transition hover:bg-sky-50/60"
                      >
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">{formatSourceLabel(transaction.source_module)}</div>
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
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 p-4 lg:hidden">
                  {filteredTransactions.map((transaction) => (
                    <button
                      key={transaction.payment_id}
                      type="button"
                      onClick={() => transaction.party_id && router.push(`/admin/arp/ledger/${transaction.party_id}`)}
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
                          {formatSourceLabel(transaction.source_module)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                          transaction.direction === "out" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {transaction.direction === "out" ? "Debit" : "Credit"}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-zinc-600">{transaction.reference_label || transaction.reference_id || transaction.payment_id}</div>
                      <div className="mt-1 text-xs text-zinc-400">{transaction.remarks || "No remarks"}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
