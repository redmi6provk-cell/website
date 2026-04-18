"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  MapPin,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  Truck,
  UserCog,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SuccessPopup } from "@/components/ui/SuccessPopup";
import api from "@/lib/api";

type SettingsState = {
  storeName: string;
  supportPhone: string;
  supportEmail: string;
  address: string;
  logoUrl: string;
  deliveryCharge: string;
  freeDeliveryAbove: string;
  serviceAreas: string;
  estimatedDelivery: string;
  minOrderAmount: string;
  defaultOrderStatus: string;
  cancellationWindow: string;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  qrUpiId: string;
  paymentInstructions: string;
  cashBalance: string;
  bankAccounts: { name: string; balance: string }[];
  adminName: string;
  adminPhone: string;
  lastLogin: string;
  sessionTimeout: string;
  allowMultiAdmin: boolean;
  manageProductsPermission: boolean;
  manageOrdersPermission: boolean;
  manageSettingsPermission: boolean;
};

const defaultSettings: SettingsState = {
  storeName: "FMCG Store",
  supportPhone: "+91 98765 43210",
  supportEmail: "support@fmcgstore.in",
  address: "Main Market Road, Delhi NCR, India",
  logoUrl: "",
  deliveryCharge: "50",
  freeDeliveryAbove: "1999",
  serviceAreas: "Delhi, Noida, Gurgaon, Ghaziabad",
  estimatedDelivery: "30-45 minutes",
  minOrderAmount: "199",
  defaultOrderStatus: "pending",
  cancellationWindow: "10",
  codEnabled: true,
  onlinePaymentEnabled: true,
  qrUpiId: "fmcgstoreVK@upi",
  paymentInstructions: "Accept COD and verified UPI payments for all eligible orders.",
  cashBalance: "0",
  bankAccounts: [],
  adminName: "Super Admin",
  adminPhone: "+91 98765 43210",
  lastLogin: "26 Mar 2026, 10:30 AM",
  sessionTimeout: "30",
  allowMultiAdmin: false,
  manageProductsPermission: true,
  manageOrdersPermission: true,
  manageSettingsPermission: true,
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Store;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4">
      <div>
        <p className="font-semibold text-zinc-900">{label}</p>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition-colors ${
          checked ? "bg-green-600" : "bg-zinc-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth, logout } = useAuthStore();
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [saveMessage, setSaveMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOutSessions, setIsLoggingOutSessions] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role)))) {
      router.push("/");
      return;
    }

    if (user) {
      setSettings((prev) => ({
        ...prev,
        adminName: user.name || prev.adminName,
        adminPhone: user.phone || prev.adminPhone,
      }));
    }
  }, [isInitialized, isAuthenticated, user, router]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/admin/settings")
        const data = res.data.data;

        setSettings((prev) => ({
          ...prev,
          storeName: data.store_name ?? prev.storeName,
          supportPhone: data.support_phone ?? prev.supportPhone,
          supportEmail: data.support_email ?? prev.supportEmail,
          address: data.address ?? prev.address,
          logoUrl: data.logo_url ?? prev.logoUrl,
          deliveryCharge: String(data.delivery_charge ?? prev.deliveryCharge),
          freeDeliveryAbove: String(data.free_delivery_above ?? prev.freeDeliveryAbove),
          serviceAreas: data.service_areas ?? prev.serviceAreas,
          estimatedDelivery: data.estimated_delivery ?? prev.estimatedDelivery,
          minOrderAmount: String(data.min_order_amount ?? prev.minOrderAmount),
          defaultOrderStatus: data.default_order_status ?? prev.defaultOrderStatus,
          cancellationWindow: String(data.cancellation_window ?? prev.cancellationWindow),
          codEnabled: Boolean(data.cod_enabled),
          onlinePaymentEnabled: Boolean(data.online_payment_enabled),
          qrUpiId: data.qr_upi_id ?? prev.qrUpiId,
          paymentInstructions: data.payment_instructions ?? prev.paymentInstructions,
          cashBalance: String(data.cash_balance ?? prev.cashBalance),
          bankAccounts: Array.isArray(data.bank_accounts)
            ? data.bank_accounts.map((entry: { name?: string; balance?: number }) => ({
                name: entry.name ?? "",
                balance: String(entry.balance ?? 0),
              }))
            : prev.bankAccounts,
          adminName: data.admin_name ?? prev.adminName,
          adminPhone: data.admin_phone ?? prev.adminPhone,
          lastLogin: data.last_login_at
            ? new Date(data.last_login_at).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "No login recorded yet",
          sessionTimeout: String(data.session_timeout ?? prev.sessionTimeout),
          allowMultiAdmin: Boolean(data.allow_multi_admin),
          manageProductsPermission: Boolean(data.manage_products_permission),
          manageOrdersPermission: Boolean(data.manage_orders_permission),
          manageSettingsPermission: Boolean(data.manage_settings_permission),
        }));
        setSaveMessage("");
      } catch (error) {
        setSaveMessage("Settings load nahi ho paayi.");
      } finally {
        setIsLoading(false);
      }
    };

    if (isInitialized && isAuthenticated && user && canAccessAdmin(user.role)) {
      fetchSettings();
    }
  }, [isInitialized, isAuthenticated, user]);

  const updateField = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");

    try {
      await api.put("/admin/settings", {
        store_name: settings.storeName,
        support_phone: settings.supportPhone,
        support_email: settings.supportEmail,
        address: settings.address,
        logo_url: settings.logoUrl,
        delivery_charge: Number(settings.deliveryCharge || 0),
        free_delivery_above: Number(settings.freeDeliveryAbove || 0),
        service_areas: settings.serviceAreas,
        estimated_delivery: settings.estimatedDelivery,
        min_order_amount: Number(settings.minOrderAmount || 0),
        default_order_status: settings.defaultOrderStatus,
        cancellation_window: Number(settings.cancellationWindow || 0),
        cod_enabled: settings.codEnabled,
        online_payment_enabled: settings.onlinePaymentEnabled,
        qr_upi_id: settings.qrUpiId,
        payment_instructions: settings.paymentInstructions,
        cash_balance: Number(settings.cashBalance || 0),
        bank_accounts: settings.bankAccounts
          .filter((account) => account.name.trim())
          .map((account) => ({
            name: account.name.trim(),
            balance: Number(account.balance || 0),
          })),
        admin_name: settings.adminName,
        admin_phone: settings.adminPhone,
        session_timeout: Number(settings.sessionTimeout || 0),
        allow_multi_admin: settings.allowMultiAdmin,
        manage_products_permission: settings.manageProductsPermission,
        manage_orders_permission: settings.manageOrdersPermission,
        manage_settings_permission: settings.manageSettingsPermission,
      });
      setSaveMessage("Settings successfully save ho gayi.");
      setSuccessMessage("Settings saved successfully.");
    } catch (error: any) {
      setSaveMessage(error?.response?.data?.error || "Settings save nahi ho paayi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    setIsLoggingOutSessions(true);
    setSaveMessage("");

    try {
      await api.post("/admin/settings/logout-all-sessions");
      logout();
      router.push("/auth/login");
    } catch (error: any) {
      setSaveMessage(error?.response?.data?.error || "All sessions logout nahi ho paayi.");
    } finally {
      setIsLoggingOutSessions(false);
    }
  };

  const addBankAccount = () => {
    setSettings((prev) => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, { name: "", balance: "0" }],
    }));
  };

  const updateBankAccount = (index: number, field: "name" | "balance", value: string) => {
    setSettings((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map((account, accountIndex) =>
        accountIndex === index ? { ...account, [field]: value } : account
      ),
    }));
  };

  const removeBankAccount = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter((_, accountIndex) => accountIndex !== index),
    }));
  };

  if (!isInitialized) {
    return <div className="p-12 text-center">Loading settings...</div>;
  }

  if (isLoading) {
    return <div className="p-12 text-center">Loading settings...</div>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#f3f4f6_100%)] py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin")}
              className="mt-1 rounded-full"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="inline-flex rounded-full border border-green-200 bg-green-50 px-4 py-1 text-xs font-black uppercase tracking-[0.25em] text-green-700">
                Admin Control Center
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-900">
                Store Settings
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
                Yahan se aap store identity, delivery rules, payment flow, admin profile,
                aur security permissions ko manage kar sakte ho.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {saveMessage && (
              <div className="rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700">
                {saveMessage}
              </div>
            )}
            <Button
              onClick={handleSave}
              className="h-12 rounded-full bg-zinc-900 px-6 text-white hover:bg-zinc-800"
              leftIcon={Save}
              isLoading={isSaving}
            >
              Save Settings
            </Button>
          </div>
        </div>

        <div className="grid gap-8">
          <SectionCard
            icon={Store}
            title="Store Information"
            description="Basic store identity aur customer-facing information yahan maintain karo."
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Store Name
                </label>
                <Input
                  value={settings.storeName}
                  onChange={(e) => updateField("storeName", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Logo URL
                </label>
                <Input
                  value={settings.logoUrl}
                  onChange={(e) => updateField("logoUrl", e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Support Phone
                </label>
                <Input
                  value={settings.supportPhone}
                  onChange={(e) => updateField("supportPhone", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Support Email
                </label>
                <Input
                  value={settings.supportEmail}
                  onChange={(e) => updateField("supportEmail", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 h-5 w-5 text-zinc-400" />
                  <textarea
                    rows={4}
                    value={settings.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white py-4 pl-12 pr-4 text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={Truck}
            title="Delivery & Charges"
            description="Delivery fee, free-shipping threshold, service areas aur ETA yahan control karo."
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Delivery Charge
                </label>
                <Input
                  type="number"
                  value={settings.deliveryCharge}
                  onChange={(e) => updateField("deliveryCharge", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Free Delivery Above
                </label>
                <Input
                  type="number"
                  value={settings.freeDeliveryAbove}
                  onChange={(e) => updateField("freeDeliveryAbove", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Estimated Delivery
                </label>
                <Input
                  value={settings.estimatedDelivery}
                  onChange={(e) => updateField("estimatedDelivery", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Service Areas
                </label>
                <Input
                  value={settings.serviceAreas}
                  onChange={(e) => updateField("serviceAreas", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={Settings}
            title="Order & Payment Rules"
            description="Checkout constraints, default order handling aur payment instructions ko yahan manage karo."
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Minimum Order Amount
                </label>
                <Input
                  type="number"
                  value={settings.minOrderAmount}
                  onChange={(e) => updateField("minOrderAmount", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Default Order Status
                </label>
                <select
                  value={settings.defaultOrderStatus}
                  onChange={(e) => updateField("defaultOrderStatus", e.target.value)}
                  className="h-14 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-green-500"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Cancellation Window (minutes)
                </label>
                <Input
                  type="number"
                  value={settings.cancellationWindow}
                  onChange={(e) => updateField("cancellationWindow", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">
                  Payment Methods
                </p>
                <div className="mt-4 space-y-4">
                  <ToggleRow
                    label="Cash on Delivery"
                    description="Eligible orders ke liye COD allow karo."
                    checked={settings.codEnabled}
                    onChange={(value) => updateField("codEnabled", value)}
                  />
                  <ToggleRow
                    label="Online Payments"
                    description="UPI/cards/netbanking jaise modes ko enable rakho."
                    checked={settings.onlinePaymentEnabled}
                    onChange={(value) => updateField("onlinePaymentEnabled", value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  QR UPI ID
                </label>
                <Input
                  value={settings.qrUpiId}
                  onChange={(e) => updateField("qrUpiId", e.target.value)}
                  placeholder="store@upi"
                  className="h-14 rounded-2xl"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Payment Instructions
                </label>
                <textarea
                  rows={4}
                  value={settings.paymentInstructions}
                  onChange={(e) => updateField("paymentInstructions", e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Cash In Hand
                </label>
                <Input
                  type="number"
                  value={settings.cashBalance}
                  onChange={(e) => updateField("cashBalance", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400">
                      Bank Accounts
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      HDFC, SBI jaise bank aur unka current balance save karo.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={addBankAccount} className="rounded-full" leftIcon={Plus}>
                    Add Bank
                  </Button>
                </div>

                <div className="mt-5 space-y-4">
                  {settings.bankAccounts.map((account, index) => (
                    <div key={index} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 md:grid-cols-[1.2fr_0.8fr_auto]">
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                          Bank Name
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <Input
                            value={account.name}
                            onChange={(e) => updateBankAccount(index, "name", e.target.value)}
                            placeholder="HDFC / SBI / ICICI"
                            className="h-14 rounded-2xl pl-11"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                          Balance
                        </label>
                        <Input
                          type="number"
                          value={account.balance}
                          onChange={(e) => updateBankAccount(index, "balance", e.target.value)}
                          className="h-14 rounded-2xl"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeBankAccount(index)}
                          className="h-14 w-14 rounded-2xl border border-zinc-200 p-0 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {settings.bankAccounts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
                      Abhi koi bank add nahi hai. `Add Bank` se HDFC, SBI wagairah add kar sakte ho.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={UserCog}
            title="Admin Profile"
            description="Primary admin ka basic profile aur contact information yahan maintain karo."
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Admin Name
                </label>
                <Input
                  value={settings.adminName}
                  onChange={(e) => updateField("adminName", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                  Admin Phone
                </label>
                <Input
                  value={settings.adminPhone}
                  onChange={(e) => updateField("adminPhone", e.target.value)}
                  className="h-14 rounded-2xl"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={ShieldCheck}
            title="Security & Permissions"
            description="Admin access, sessions aur future multi-admin role controls ke liye security panel."
          >
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-zinc-500" />
                    <div>
                      <p className="font-semibold text-zinc-900">Last Login</p>
                      <p className="text-sm text-zinc-500">{settings.lastLogin}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-zinc-400">
                    Session Timeout (minutes)
                  </label>
                  <Input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => updateField("sessionTimeout", e.target.value)}
                    className="h-14 rounded-2xl"
                  />
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <p className="text-sm font-semibold text-red-700">Logout All Sessions</p>
                  <p className="mt-1 text-sm text-red-600">
                    Agar account compromise lage to sab active admin sessions invalidate kar sakte ho.
                  </p>
                  <Button
                    variant="danger"
                    className="mt-4 rounded-full px-5"
                    onClick={handleLogoutAllSessions}
                    isLoading={isLoggingOutSessions}
                  >
                    Logout All Devices
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <ToggleRow
                  label="Allow Multiple Admins"
                  description="Future mein multiple admins ko role-based access dene ke liye ready switch."
                  checked={settings.allowMultiAdmin}
                  onChange={(value) => updateField("allowMultiAdmin", value)}
                />
                <ToggleRow
                  label="Products Permission"
                  description="Selected admin role ko products create, update aur delete karne do."
                  checked={settings.manageProductsPermission}
                  onChange={(value) => updateField("manageProductsPermission", value)}
                />
                <ToggleRow
                  label="Orders Permission"
                  description="Selected admin role ko orders manage aur status update karne do."
                  checked={settings.manageOrdersPermission}
                  onChange={(value) => updateField("manageOrdersPermission", value)}
                />
                <ToggleRow
                  label="Settings Permission"
                  description="Only trusted admins ko settings panel edit access do."
                  checked={settings.manageSettingsPermission}
                  onChange={(value) => updateField("manageSettingsPermission", value)}
                />
              </div>
            </div>
          </SectionCard>
        </div>
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
