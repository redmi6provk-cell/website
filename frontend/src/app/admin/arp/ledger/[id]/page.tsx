"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessERP } from "@/lib/roles";
import api from "@/lib/api";
import {
  AlertCircle,
  ArrowLeft,
  CreditCard,
  FileText,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { SuccessPopup } from "@/components/ui/SuccessPopup";

interface Transaction {
  date: string;
  type: string;
  ref_id: string;
  invoice_id?: string;
  amount: number;
  balance: number;
  payment_mode?: string;
  remarks: string;
}

interface Party {
  party_id: string;
  name: string;
  type: string;
}

interface InvoiceProgress {
  paid: number;
  remaining: number;
  status: "unpaid" | "partially_paid" | "paid";
}

interface InvoiceRowProgress extends InvoiceProgress {
  key: string;
}

type TransactionWithKey = Transaction & {
  rowKey: string;
};

type BankAccount = {
  name?: string;
  balance?: number;
};

function formatPaymentModeLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PartyLedgerDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [party, setParty] = useState<Party | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentModes, setPaymentModes] = useState<string[]>(["cash"]);
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_mode: "cash",
    remarks: "",
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const fetchLedger = useCallback(async () => {
    try {
      const [transRes, partiesRes, settingsRes] = await Promise.all([
        api.get(`/admin/arp/ledger/${id}`),
        api.get("/admin/arp/parties"),
        api.get("/admin/settings"),
      ]);

      setTransactions(transRes.data.data || []);
      const foundParty = (partiesRes.data.data as Party[]).find((p) => p.party_id === id);
      setParty(foundParty || null);
      const bankAccounts: BankAccount[] = Array.isArray(settingsRes.data.data?.bank_accounts)
        ? settingsRes.data.data.bank_accounts
        : [];
      const bankModes = bankAccounts
        .map((account) => account.name?.trim())
        .filter((name): name is string => Boolean(name && name.toLowerCase() !== "cash"));
      setPaymentModes(["cash", ...new Set(bankModes)]);
    } catch (error) {
      console.error("Failed to fetch detailed ledger", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessERP(user.role)))) {
      router.push("/");
      return;
    }

    if (isInitialized && isAuthenticated && user && canAccessERP(user.role)) {
      fetchLedger();
    }
  }, [isInitialized, isAuthenticated, user, router, fetchLedger]);

  useEffect(() => {
    if (paymentModeFilter !== "all" && !paymentModes.includes(paymentModeFilter)) {
      setPaymentModeFilter("all");
    }

    if (!paymentModes.includes(paymentForm.payment_mode)) {
      setPaymentForm((current) => ({
        ...current,
        payment_mode: paymentModes[0] || "cash",
      }));
    }
  }, [paymentModes, paymentModeFilter, paymentForm.payment_mode]);

  const invoiceTotals = transactions.reduce<Record<string, number>>((acc, transaction) => {
    if (transaction.type === "invoice" && transaction.invoice_id) {
      acc[transaction.invoice_id] = transaction.amount;
    }
    return acc;
  }, {});

  const transactionsWithKeys: TransactionWithKey[] = transactions.map((transaction, index) => ({
    ...transaction,
    rowKey: `${transaction.type}-${transaction.invoice_id || transaction.payment_id || transaction.ref_id}-${index}`,
  }));

  const invoiceProgressByRow = (() => {
    const progressMap: Record<string, InvoiceRowProgress> = {};
    const openInvoices: Array<{ key: string; invoice_id?: string; remaining: number }> = [];

    transactionsWithKeys.forEach((transaction) => {
      const rowKey = transaction.rowKey;

      if (transaction.type === "invoice") {
        progressMap[rowKey] = {
          key: rowKey,
          paid: 0,
          remaining: transaction.amount,
          status: "unpaid",
        };
        openInvoices.push({
          key: rowKey,
          invoice_id: transaction.invoice_id,
          remaining: transaction.amount,
        });
        return;
      }

      if (transaction.type !== "payment") {
        return;
      }

      let remainingPayment = transaction.amount;

      if (transaction.invoice_id) {
        const linkedInvoice = openInvoices.find((invoice) => invoice.invoice_id === transaction.invoice_id);
        if (linkedInvoice && progressMap[linkedInvoice.key]) {
          const applied = Math.min(linkedInvoice.remaining, remainingPayment);
          linkedInvoice.remaining -= applied;
          remainingPayment -= applied;
          const paid = (invoiceTotals[transaction.invoice_id] ?? 0) - linkedInvoice.remaining;
          progressMap[linkedInvoice.key] = {
            key: linkedInvoice.key,
            paid,
            remaining: linkedInvoice.remaining,
            status: linkedInvoice.remaining === 0 ? "paid" : "partially_paid",
          };
        }
      }

      if (remainingPayment <= 0) {
        return;
      }

      for (const invoice of openInvoices) {
        if (remainingPayment <= 0) {
          break;
        }
        if (invoice.remaining <= 0) {
          continue;
        }

        const applied = Math.min(invoice.remaining, remainingPayment);
        invoice.remaining -= applied;
        remainingPayment -= applied;
        const originalAmount = progressMap[invoice.key]?.paid + progressMap[invoice.key]?.remaining || 0;
        const paid = originalAmount - invoice.remaining;
        progressMap[invoice.key] = {
          key: invoice.key,
          paid,
          remaining: invoice.remaining,
          status: invoice.remaining === 0 ? "paid" : "partially_paid",
        };
      }
    });

    return progressMap;
  })();

  const handleOpenPayment = (invoice: Transaction, remaining: number) => {
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: remaining.toString(),
      payment_mode: paymentModes[0] || "cash",
      remarks: `Payment for ${invoice.ref_id}`,
    });
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice?.invoice_id) return;

    setIsSubmitting(true);
    try {
      await api.post("/admin/arp/payments", {
        invoice_id: selectedInvoice.invoice_id,
        amount: parseFloat(paymentForm.amount),
        payment_mode: paymentForm.payment_mode,
        payment_date: new Date().toISOString(),
        remarks: paymentForm.remarks,
      });

      setIsPaymentModalOpen(false);
      await fetchLedger();
      setSuccessMessage("Payment recorded successfully.");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as { response?: { data?: { error?: string } } }).response?.data?.error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to record payment."
          : "Failed to record payment.";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalInvoiced = transactions
    .filter((t) => t.type === "invoice")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = transactions
    .filter((t) => t.type === "payment")
    .reduce((sum, t) => sum + t.amount, 0);
  const currentBalance = totalInvoiced - totalPaid;
  const paymentModeTotals = paymentModes.map((mode, index) => ({
    label: formatPaymentModeLabel(mode),
    value: transactions
      .filter((t) => t.type === "payment" && t.payment_mode === mode)
      .reduce((sum, t) => sum + t.amount, 0),
    tone:
      index % 4 === 0
        ? "bg-emerald-50 text-emerald-700"
        : index % 4 === 1
          ? "bg-blue-50 text-blue-700"
          : index % 4 === 2
            ? "bg-amber-50 text-amber-700"
            : "bg-zinc-100 text-zinc-700",
  }));
  const filteredTransactions = transactionsWithKeys.filter((transaction) => {
    const transactionDate = new Date(transaction.date);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const matchesDate =
      dateFilter === "all"
        ? true
        : dateFilter === "today"
          ? transactionDate >= startOfToday
          : dateFilter === "week"
            ? transactionDate >= startOfWeek
            : transactionDate >= startOfMonth;

    if (!matchesDate) {
      return false;
    }

    if (paymentModeFilter === "all") {
      return true;
    }
    return transaction.type !== "payment" || transaction.payment_mode === paymentModeFilter;
  });

  if (!isInitialized || loading) {
    return (
      <div className="p-12 text-center font-black uppercase tracking-widest text-zinc-400 animate-pulse">
        Reconstructing Financial History...
      </div>
    );
  }

  if (!party) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
        <div>
          <AlertCircle className="h-16 w-16 text-red-100 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-zinc-900 uppercase">Party Not Found</h1>
          <Button onClick={() => router.push("/admin/arp")} variant="ghost" className="mt-4 text-zinc-500 hover:text-zinc-900">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <Button
          onClick={() => router.push("/admin/arp")}
          variant="ghost"
          className="mb-8 rounded-2xl hover:bg-white text-zinc-500 font-bold uppercase tracking-widest text-[10px]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to ERP Dashboard
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-6">
            <div
              className={`h-24 w-24 rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-xl border-4 border-white ${
                party.type === "customer" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
              }`}
            >
              {party.name[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    party.type === "customer" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {party.type}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                  #{party.party_id.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase">{party.name}</h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Total Invoiced</p>
            <p className="text-2xl font-black text-zinc-900">Rs {totalInvoiced.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Total Payments</p>
            <p className="text-2xl font-black text-green-600">Rs {totalPaid.toLocaleString()}</p>
          </div>
          <div className={`p-6 rounded-3xl border shadow-lg ${currentBalance > 0 ? "bg-red-50 border-red-100" : "bg-zinc-900 border-zinc-800"}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${currentBalance > 0 ? "text-red-400" : "text-zinc-500"}`}>
              Net Outstanding
            </p>
            <p className={`text-2xl font-black ${currentBalance > 0 ? "text-red-600" : "text-white"}`}>
              Rs {currentBalance.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mb-12 rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">Payment Mode Summary</h3>
              <p className="text-sm text-zinc-500">Cash aur admin settings me saved banks ka live breakup.</p>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {[{ value: "all", label: "All Modes" }, ...paymentModes.map((mode) => ({ value: mode, label: formatPaymentModeLabel(mode) }))].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentModeFilter(option.value)}
                    className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${
                      paymentModeFilter === option.value
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All Time" },
                  { value: "today", label: "Today" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDateFilter(option.value as typeof dateFilter)}
                    className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${
                      dateFilter === option.value
                        ? "bg-green-600 text-white"
                        : "bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {paymentModeTotals.map((item) => (
              <div key={item.label} className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${item.tone}`}>
                  {item.label}
                </div>
                <div className="mt-3 text-2xl font-black text-zinc-900">Rs {item.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-zinc-50">
            <h3 className="font-black text-zinc-900 uppercase tracking-tight">Statement of Account</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Payment filter: {paymentModeFilter === "all" ? "All modes" : formatPaymentModeLabel(paymentModeFilter)} | Date filter: {dateFilter === "all" ? "All time" : dateFilter}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50/50">
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Transaction</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Reference</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Mode</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredTransactions.map((transaction) => {
                  const progress = transaction.type === "invoice" ? invoiceProgressByRow[transaction.rowKey] : undefined;
                  const invoiceStatus = progress?.status || "unpaid";
                  const remainingAmount = progress?.remaining ?? transaction.amount;

                  return (
                    <tr key={transaction.rowKey} className="hover:bg-zinc-50/30 transition-all">
                      <td className="px-8 py-6 font-bold text-zinc-400 text-xs">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          {transaction.type === "invoice" ? (
                            <FileText className="h-4 w-4 text-blue-400" />
                          ) : (
                            <CreditCard className="h-4 w-4 text-green-400" />
                          )}
                          <span className="font-bold text-zinc-900 text-sm uppercase">{transaction.type}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-zinc-400">{transaction.remarks}</p>
                      </td>
                      <td className="px-8 py-6">
                        <code className="bg-zinc-100 px-2 py-1 rounded text-[10px] font-bold text-zinc-600">
                          {transaction.ref_id.toUpperCase()}
                        </code>
                      </td>
                      <td className="px-8 py-6">
                        {transaction.type === "payment" ? (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                            {formatPaymentModeLabel(transaction.payment_mode || "unknown")}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Invoice</span>
                        )}
                      </td>
                      <td className={`px-8 py-6 font-black ${transaction.type === "invoice" ? "text-zinc-900" : "text-green-600"}`}>
                        {transaction.type === "invoice" ? "+" : "-"} Rs {transaction.amount.toLocaleString()}
                        {transaction.type === "invoice" && progress && (
                          <p className="mt-1 text-[10px] font-bold text-zinc-400">
                            Paid Rs {progress.paid.toLocaleString()} | Remaining Rs {remainingAmount.toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                              transaction.type === "payment"
                                ? "bg-green-50 text-green-600"
                                : invoiceStatus === "paid"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : invoiceStatus === "partially_paid"
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-orange-50 text-orange-600"
                            }`}
                          >
                            {transaction.type === "invoice" ? invoiceStatus.replace("_", " ") : "processed"}
                          </span>
                          {transaction.type === "invoice" && transaction.invoice_id && remainingAmount > 0 && (
                            <Button
                              onClick={() => handleOpenPayment(transaction, remainingAmount)}
                              variant="outline"
                              className="h-8 rounded-lg px-3 text-[10px] font-black uppercase tracking-widest border-zinc-200 text-zinc-500 hover:text-green-600 hover:border-green-600 hover:bg-green-50"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Pay
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-zinc-300 font-black uppercase tracking-widest text-xs">No transactions recorded yet</p>
            </div>
          )}
        </div>

        <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Payment">
          <form onSubmit={handleRecordPayment} className="space-y-6">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Invoice Reference</label>
              <div className="h-14 bg-zinc-50 rounded-2xl flex items-center px-4 font-bold text-zinc-900 border border-zinc-100">
                {selectedInvoice?.ref_id}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Payment Amount (INR)</label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="h-14 rounded-2xl font-black text-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {paymentModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, payment_mode: mode })}
                    className={`h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${
                      paymentForm.payment_mode === mode
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-50 text-zinc-500 border border-zinc-100 hover:bg-zinc-100"
                    }`}
                  >
                    {formatPaymentModeLabel(mode)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Remarks</label>
              <Input
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                className="h-14 rounded-2xl"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest mt-4"
              isLoading={isSubmitting}
            >
              Confirm Payment
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
