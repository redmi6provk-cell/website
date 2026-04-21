"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronLeft, Landmark, Pencil, ReceiptText } from "lucide-react";
import type { AxiosError } from "axios";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { canAccessERP } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/PageLoader";
import { SuccessPopup } from "@/components/ui/SuccessPopup";

type Party = {
  party_id: string;
  name: string;
  type: string;
};

type LedgerEntry = {
  party_id: string;
  party_name: string;
  party_type: string;
  outstanding_balance: number;
};

type BankAccount = {
  name?: string;
  balance?: number;
};

type PaymentTransaction = {
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
};

type PaymentForm = {
  direction: "out" | "in";
  partyId: string;
  paymentMode: string;
  transactionDate: string;
  receiptNo: string;
  amount: string;
  remarks: string;
};

type ManualTransactionFilter = "all" | "in" | "out";

const todayValue = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): PaymentForm => ({
  direction: "out",
  partyId: "",
  paymentMode: "cash",
  transactionDate: todayValue(),
  receiptNo: "",
  amount: "",
  remarks: "",
});

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPaymentLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDirectionLabel(value: string) {
  return value === "out" ? "Payment-Out" : "Payment-In";
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  const [form, setForm] = useState<PaymentForm>(emptyForm());
  const [parties, setParties] = useState<Party[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<string[]>(["cash"]);
  const [cashBalance, setCashBalance] = useState(0);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [manualTransactionFilter, setManualTransactionFilter] = useState<ManualTransactionFilter>("all");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessERP(user.role)))) {
      router.push("/");
    }
  }, [isInitialized, isAuthenticated, user, router]);

  const loadPage = async () => {
    try {
      const [partiesRes, ledgerRes, summaryRes, transactionsRes] = await Promise.all([
        api.get("/admin/arp/parties"),
        api.get("/admin/arp/ledger"),
        api.get("/admin/arp/summary"),
        api.get("/admin/arp/payment-transactions?mode=all"),
      ]);

      setParties(partiesRes.data.data || []);
      setLedger(ledgerRes.data.data || []);

      const bankAccounts: BankAccount[] = Array.isArray(summaryRes.data.data?.bank_accounts)
        ? summaryRes.data.data.bank_accounts
        : [];

      setCashBalance(Number(summaryRes.data.data?.cash_total || 0));
      setPaymentOptions([
        "cash",
        ...bankAccounts
          .map((account) => account.name?.trim())
          .filter((name): name is string => Boolean(name && name.toLowerCase() !== "cash")),
      ]);

      setTransactions(transactionsRes.data.data || []);
    } catch (error) {
      console.error("Failed to load payments page data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized && isAuthenticated && user && canAccessERP(user.role)) {
      void loadPage();
    }
  }, [isInitialized, isAuthenticated, user]);

  const selectedParty = useMemo(
    () => parties.find((party) => party.party_id === form.partyId) || null,
    [parties, form.partyId]
  );

  const selectedPartyBalance = useMemo(
    () => ledger.find((entry) => entry.party_id === form.partyId)?.outstanding_balance || 0,
    [ledger, form.partyId]
  );

  const manualTransactions = useMemo(
    () => transactions.filter((item) => item.source_module === "manual_payment"),
    [transactions]
  );

  const filteredManualTransactions = useMemo(() => {
    if (manualTransactionFilter === "all") {
      return manualTransactions;
    }

    return manualTransactions.filter((item) => item.direction === manualTransactionFilter);
  }, [manualTransactions, manualTransactionFilter]);

  const isPaymentIn = form.direction === "in";
  const theme = isPaymentIn
    ? {
        shell: "from-emerald-600 via-emerald-500 to-lime-400",
        subtle: "border-emerald-200 bg-emerald-50 text-emerald-700",
        focus: "focus:ring-emerald-500",
        button: "bg-emerald-600 hover:bg-emerald-700",
        activeOut: "text-white/80 hover:text-white hover:bg-white/10",
        activeIn: "bg-white text-emerald-700 shadow-sm",
        muted: "text-emerald-100/85",
      }
    : {
        shell: "from-rose-700 via-red-600 to-orange-500",
        subtle: "border-rose-200 bg-rose-50 text-rose-700",
        focus: "focus:ring-rose-500",
        button: "bg-rose-600 hover:bg-rose-700",
        activeOut: "bg-white text-rose-700 shadow-sm",
        activeIn: "text-white/80 hover:text-white hover:bg-white/10",
        muted: "text-rose-100/85",
      };

  const resetForm = () => {
    setEditingTransactionId(null);
    setFormError(null);
    setForm({
      ...emptyForm(),
      paymentMode: paymentOptions[0] || "cash",
    });
  };

  const handleEditTransaction = (transaction: PaymentTransaction) => {
    setEditingTransactionId(transaction.payment_id);
    setFormError(null);
    setSuccessMessage(null);
    setForm({
      direction: transaction.direction === "in" ? "in" : "out",
      partyId: transaction.party_id || "",
      paymentMode: transaction.payment_mode || paymentOptions[0] || "cash",
      transactionDate: transaction.payment_date.slice(0, 10),
      receiptNo: transaction.reference_id || "",
      amount: String(transaction.amount || ""),
      remarks: transaction.remarks || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const amount = Number(form.amount);
    if (!form.partyId) {
      setFormError("Party select karo");
      return;
    }
    if (!form.transactionDate) {
      setFormError("Date required");
      return;
    }
    if (!form.paymentMode) {
      setFormError("Payment type required");
      return;
    }
    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      setFormError("Valid amount dalo");
      return;
    }
    if (!selectedParty) {
      setFormError("Selected party valid nahi hai");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        direction: form.direction,
        payment_mode: form.paymentMode,
        amount,
        transaction_date: form.transactionDate,
        reference_id: form.receiptNo.trim(),
        reference_label: form.receiptNo.trim() || `${formatDirectionLabel(form.direction)} ${selectedParty.name}`,
        party_id: selectedParty.party_id,
        party_name: selectedParty.name,
        party_type: selectedParty.type,
        remarks: form.remarks.trim(),
      };

      if (editingTransactionId) {
        await api.put(`/admin/arp/manual-transactions/${editingTransactionId}`, payload);
      } else {
        await api.post("/admin/arp/manual-transactions", payload);
      }

      setSuccessMessage(
        editingTransactionId
          ? `${formatDirectionLabel(form.direction)} updated successfully.`
          : `${formatDirectionLabel(form.direction)} saved successfully.`
      );
      resetForm();
      await loadPage();
    } catch (error: unknown) {
      const message =
        (error as AxiosError<{ error?: string }>)?.response?.data?.error ||
        "Payment save nahi ho paaya";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!paymentOptions.includes(form.paymentMode)) {
      setForm((current) => ({
        ...current,
        paymentMode: paymentOptions[0] || "cash",
      }));
    }
  }, [paymentOptions, form.paymentMode]);

  if (!isInitialized || loading) {
    return (
      <PageLoader
        compact
        title="Loading Payments"
        subtitle="Payment form aur ledger entries ready ki ja rahi hain."
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 py-6 md:py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin")} className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl">PAYMENT IN / OUT</h1>
            <p className="mt-1 text-sm text-zinc-500">Party select karo, mode choose karo, aur direct cash/bank transaction record karo.</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <section className="overflow-hidden rounded-[2.2rem] border border-zinc-200 bg-white shadow-[0_28px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className={`bg-gradient-to-br ${theme.shell} px-6 py-6 text-white sm:px-8 sm:py-7`}>
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Transaction Form</div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">
                    {editingTransactionId ? `Edit ${formatDirectionLabel(form.direction)}` : formatDirectionLabel(form.direction)}
                  </h2>
                  <p className={`mt-2 max-w-md text-sm ${theme.muted}`}>
                    {isPaymentIn
                      ? "Incoming collection ko record karo aur party balance ko update rakho."
                      : "Outgoing payment ko supplier ya customer ledger ke saath cleanly sync karo."}
                  </p>
                </div>
                <div className="inline-flex rounded-full bg-black/10 p-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, direction: "out" }))}
                    className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.16em] transition ${
                      theme.activeOut
                    }`}
                  >
                    Payment Out
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, direction: "in" }))}
                    className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.16em] transition ${
                      theme.activeIn
                    }`}
                  >
                    Payment In
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8">
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Party <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.partyId}
                      onChange={(event) => setForm((current) => ({ ...current, partyId: event.target.value }))}
                      className={`h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:bg-white ${theme.focus}`}
                    >
                      <option value="">Select party</option>
                      {parties.map((party) => (
                        <option key={party.party_id} value={party.party_id}>
                          {party.name}
                        </option>
                      ))}
                    </select>
                    {selectedParty ? (
                      <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${theme.subtle}`}>
                        <ReceiptText className="h-3.5 w-3.5" />
                        Balance: {formatCurrency(selectedPartyBalance)}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Payment Type
                    </label>
                    <select
                      value={form.paymentMode}
                      onChange={(event) => setForm((current) => ({ ...current, paymentMode: event.target.value }))}
                      className={`h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:bg-white ${theme.focus}`}
                    >
                      {paymentOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatPaymentLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Description
                    </label>
                    <textarea
                      value={form.remarks}
                      onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                      placeholder="Add notes or description"
                      rows={6}
                      className={`w-full rounded-[1.6rem] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:bg-white ${theme.focus}`}
                    />
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        Receipt No
                      </label>
                      <Input
                        value={form.receiptNo}
                        onChange={(event) => setForm((current) => ({ ...current, receiptNo: event.target.value }))}
                        placeholder="Optional receipt number"
                        className={`h-12 rounded-2xl border-zinc-200 bg-zinc-50 ${theme.focus}`}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        Date
                      </label>
                      <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          type="date"
                          value={form.transactionDate}
                          onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))}
                          className={`h-12 rounded-2xl border-zinc-200 bg-zinc-50 pl-11 ${theme.focus}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-5">
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Paid Amount
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                      placeholder="0.00"
                      className={`h-14 rounded-2xl border-zinc-200 bg-white text-lg font-semibold ${theme.focus}`}
                    />

                    <div className="mt-4 grid gap-3">
                      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
                        <span className="text-zinc-500">Cash Balance</span>
                        <span className="font-bold text-zinc-900">{formatCurrency(cashBalance)}</span>
                      </div>
                      {selectedParty ? (
                        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
                          <span className="text-zinc-500">Selected Party</span>
                          <span className="font-bold text-zinc-900">{selectedParty.name}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {formError ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div> : null}
              <div className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
                <Button type="button" variant="outline" className="h-12 rounded-2xl px-5" onClick={resetForm}>
                  {editingTransactionId ? "Cancel Edit" : "Reset"}
                </Button>
                <Button type="submit" className={`h-12 rounded-2xl px-8 ${theme.button}`} disabled={isSubmitting}>
                  {isSubmitting ? (editingTransactionId ? "Updating..." : "Saving...") : editingTransactionId ? "Update" : "Save"}
                </Button>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.8rem] border border-emerald-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-500">Payment In</div>
                    <div className="mt-2 text-3xl font-black text-zinc-900">
                      {transactions.filter((item) => item.direction === "in").length}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                    <ArrowDownLeft className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-rose-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-500">Payment Out</div>
                    <div className="mt-2 text-3xl font-black text-zinc-900">
                      {transactions.filter((item) => item.direction === "out").length}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-zinc-900">Payment Mode Ledger</div>
                  <div className="text-sm text-zinc-500">Detailed mode-wise transactions dekhne ke liye overview page kholo.</div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11 w-full rounded-2xl"
                onClick={() => router.push("/admin/arp/payment-modes")}
              >
                Open Payment Overview
              </Button>
            </div>
          </aside>
        </div>

        <SuccessPopup
          isOpen={Boolean(successMessage)}
          message={successMessage || ""}
          onClose={() => setSuccessMessage(null)}
          title="Form Submitted"
        />

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-zinc-900">Manual Payment Entries</h2>
              <p className="mt-1 text-sm text-zinc-500">Yahan sirf Payment In/Out form se save ki gayi manual entries show hongi.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex rounded-full bg-zinc-100 p-1">
                {(["all", "in", "out"] as ManualTransactionFilter[]).map((filterValue) => (
                  <button
                    key={filterValue}
                    type="button"
                    onClick={() => setManualTransactionFilter(filterValue)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] transition ${
                      manualTransactionFilter === filterValue
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    {filterValue === "all" ? "All" : formatDirectionLabel(filterValue)}
                  </button>
                ))}
              </div>
              <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-600">
                {filteredManualTransactions.length} records
              </div>
            </div>
          </div>

          {filteredManualTransactions.length === 0 ? (
            <div className="px-5 py-8 text-sm text-zinc-500">Abhi tak koi payment entry nahi hai.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-100 text-sm">
                <thead className="bg-zinc-50">
                  <tr className="text-left text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Party</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Mode</th>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Remarks</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredManualTransactions.map((item) => {
                    return (
                      <tr key={item.payment_id} className="align-top">
                        <td className="px-5 py-4 whitespace-nowrap text-zinc-600">{formatDate(item.payment_date)}</td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-zinc-900">{item.party_name || "Direct entry"}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400">{item.party_type || "N/A"}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                            item.direction === "in" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}>
                            {formatDirectionLabel(item.direction)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-zinc-600">{formatPaymentLabel(item.payment_mode)}</td>
                        <td className="px-5 py-4 text-zinc-600">
                          <div>{item.reference_id || "-"}</div>
                          <div className="mt-1 text-xs text-zinc-400">{item.reference_label || item.source_module}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-zinc-900">{formatCurrency(item.amount)}</td>
                        <td className="px-5 py-4 text-zinc-600">{item.remarks || "-"}</td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => handleEditTransaction(item)}
                            leftIcon={Pencil}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
