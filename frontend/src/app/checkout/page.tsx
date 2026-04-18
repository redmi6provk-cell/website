"use client";

import { useState, useEffect } from "react";
import type { AxiosError } from "axios";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Home,
  MapPin,
  PackageCheck,
  Smartphone,
  Store,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatDiscountLabel, getCartPricing } from "@/lib/pricing";
import { resolveAssetUrl, shouldBypassImageOptimization } from "@/lib/images";
import { Order } from "@/types";

const addressSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  addressLine: z.string().optional(),
  pincode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

type AddressFormValues = z.infer<typeof addressSchema>;

type PublicStoreSettings = {
  cod_enabled?: boolean;
  online_payment_enabled?: boolean;
  qr_upi_id?: string;
  payment_instructions?: string;
  address?: string;
  delivery_charge?: number;
  free_delivery_above?: number;
};

type OrderSuccessDetails = {
  customerName: string;
  deliveryMethod: "delivery" | "pickup";
  paymentMethod: "cod" | "qr";
  orderTotal: number;
};

function parseDeliveryAddress(address?: string) {
  if (!address || address.includes("Store Pickup")) {
    return null;
  }

  const [customerPart] = address.split(" | Payment:");
  const match = customerPart?.match(/^([^,]+),\s*(\d{10}),\s*(.+),\s*([^,]+),\s*([^-|]+)\s*-\s*(\d{6})$/);

  if (!match) {
    return null;
  }

  return {
    fullName: match[1].trim(),
    phone: match[2].trim(),
    addressLine: match[3].trim(),
    city: match[4].trim(),
    state: match[5].trim(),
    pincode: match[6].trim(),
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCartStore();
  const { isAuthenticated, isInitialized, user, checkAuth, updateUser, logout } = useAuthStore();

  const [paymentMethod, setPaymentMethod] = useState<"cod" | "qr">("cod");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");
  const [isOrdered, setIsOrdered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderSuccessDetails, setOrderSuccessDetails] = useState<OrderSuccessDetails | null>(null);
  const [storeSettings, setStoreSettings] = useState<PublicStoreSettings>({
    cod_enabled: true,
    online_payment_enabled: true,
    qr_upi_id: "fmcgstoreVK@upi",
    payment_instructions: "",
    delivery_charge: 50,
    free_delivery_above: 1999,
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth, isAuthenticated, items.length]);

  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const res = await api.get("/settings/store");
        setStoreSettings(res.data.data || {});
      } catch {
        console.error("Failed to load store settings");
      }
    };

    fetchStoreSettings();
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      addressLine: "",
      pincode: "",
      city: "",
      state: "",
    },
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    setValue("fullName", user.name || "");
    setValue("phone", user.phone || "");
    setValue("addressLine", user.address_line || "");
    setValue("pincode", user.pincode || "");
    setValue("city", user.city || "");
    setValue("state", user.state || "");
  }, [setValue, user]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) {
      return;
    }

    let isMounted = true;

    const hydrateCheckoutDetails = async () => {
      try {
        const res = await api.get("/orders");
        const orders: Order[] = Array.isArray(res.data?.data) ? res.data.data : [];
        const lastDeliveryOrder = orders.find((order) => {
          const deliveryType = order.delivery_type || (order.address?.includes("Store Pickup") ? "pickup" : "delivery");
          return deliveryType === "delivery";
        });

        if (!lastDeliveryOrder || !isMounted) {
          return;
        }

        const parsedAddress = parseDeliveryAddress(lastDeliveryOrder.address);
        if (!parsedAddress) {
          return;
        }

        setValue("fullName", lastDeliveryOrder.customer_name || user?.name || parsedAddress.fullName);
        setValue("phone", lastDeliveryOrder.customer_phone || user?.phone || parsedAddress.phone);
        setValue("addressLine", user?.address_line || parsedAddress.addressLine);
        setValue("pincode", user?.pincode || parsedAddress.pincode);
        setValue("city", user?.city || parsedAddress.city);
        setValue("state", user?.state || parsedAddress.state);
      } catch (err) {
        const status = (err as AxiosError)?.response?.status;
        if (status === 401) {
          logout();
          router.replace("/auth/login?redirect=/checkout");
          return;
        }

        console.error("Failed to auto-fill checkout details", err);
      }
    };

    hydrateCheckoutDetails();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isInitialized, logout, router, setValue, user]);

  const cartPricing = getCartPricing(items);
  const totalPrice = cartPricing.subtotal;
  const deliveryChargeAmount = Math.max(0, Number(storeSettings.delivery_charge ?? 50) || 50);
  const freeDeliveryThreshold = Math.max(1, Number(storeSettings.free_delivery_above ?? 1999) || 1999);
  const shipping = totalPrice >= freeDeliveryThreshold ? 0 : deliveryChargeAmount;
  const deliveryCharge = deliveryMethod === "pickup" ? 0 : shipping;
  const orderTotal = totalPrice + deliveryCharge;

  const onSubmit = async (data: AddressFormValues) => {
    if (!isAuthenticated) {
      router.push("/auth/login?redirect=/checkout");
      return;
    }

    if (!cartPricing.isValid) {
      setError("Minimum order quantity complete karo, tabhi checkout allow hoga.");
      return;
    }

    if (
      deliveryMethod === "delivery" &&
      (
        !data.addressLine || data.addressLine.length < 5 ||
        !data.pincode || !/^\d{6}$/.test(data.pincode) ||
        !data.city || data.city.length < 2 ||
        !data.state || data.state.length < 2
      )
    ) {
      setError("Delivery ke liye complete address fill karna zaroori hai.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const paymentLabel = paymentMethod === "qr" ? "Pay Now with QR Code" : "Cash on Delivery";
      const fullAddress =
        deliveryMethod === "pickup"
          ? `Store Pickup | Pickup from: ${storeSettings.address || "Store address not set"} | Customer: ${data.fullName}, ${data.phone} | Payment: ${paymentLabel}`
          : `${data.fullName}, ${data.phone}, ${data.addressLine}, ${data.city}, ${data.state} - ${data.pincode} | Payment: ${paymentLabel}`;

      await api.post("/cart/sync", {
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });

      await api.post("/orders", {
        address: fullAddress,
        customer_name: data.fullName,
        customer_phone: data.phone,
        shop_name: user?.shop_name || "",
        address_line: data.addressLine || "",
        pincode: data.pincode || "",
        city: data.city || "",
        state: data.state || "",
        delivery_type: deliveryMethod,
        payment_mode: paymentMethod,
        payment_status: paymentMethod === "qr" ? "pending_verification" : "unpaid",
        notes:
          deliveryMethod === "pickup"
            ? "Customer selected store pickup."
            : "Customer selected home delivery.",
        delivery_charge: deliveryCharge,
      });
      setOrderSuccessDetails({
        customerName: data.fullName,
        deliveryMethod,
        paymentMethod,
        orderTotal,
      });
      if (user && deliveryMethod === "delivery") {
        updateUser({
          ...user,
          address_line: data.addressLine || "",
          pincode: data.pincode || "",
          city: data.city || "",
          state: data.state || "",
        });
      }
      setIsOrdered(true);
      clearCart();
    } catch (err: unknown) {
      if ((err as AxiosError)?.response?.status === 401) {
        logout();
        router.push("/auth/login?redirect=/checkout");
        return;
      }

      const message =
        (err as AxiosError<{ error?: string }>)?.response?.data?.error ||
        "Failed to place order. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0 && !isOrdered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link href="/products" className="mt-4 text-green-600 hover:underline">
          Return to shop
        </Link>
      </div>
    );
  }

  if (isOrdered) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(187,247,208,0.45),_transparent_34%),linear-gradient(180deg,_#fbfdf8_0%,_#f3f5ef_100%)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-[0_32px_120px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="border-b border-zinc-200/70 bg-[linear-gradient(135deg,rgba(22,163,74,0.08),rgba(245,158,11,0.08),rgba(255,255,255,0.92))] px-6 py-10 sm:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-[0_16px_40px_rgba(22,163,74,0.18)]">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.34em] text-emerald-700">Order Confirmed</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
                Order placed successfully and checkout complete.
              </h1>
              <p className="mt-4 text-sm leading-6 text-zinc-600 sm:text-base">
                {orderSuccessDetails?.customerName || "Customer"}, aapka order receive ho gaya hai. Ab aap tracking dashboard se status dekh sakte ho aur next purchase kabhi bhi continue kar sakte ho.
              </p>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="px-6 py-8 sm:px-10">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50/80 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Amount Paid</p>
                  <p className="mt-3 text-3xl font-black text-zinc-900">Rs. {orderSuccessDetails?.orderTotal ?? 0}</p>
                  <p className="mt-2 text-sm text-zinc-600">Final checkout amount</p>
                </div>
                <div className="rounded-[1.4rem] border border-sky-100 bg-sky-50/80 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-700">Delivery Type</p>
                  <p className="mt-3 text-2xl font-black text-zinc-900">
                    {orderSuccessDetails?.deliveryMethod === "pickup" ? "Store Pickup" : "Home Delivery"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">Fulfilment preference saved</p>
                </div>
                <div className="rounded-[1.4rem] border border-amber-100 bg-amber-50/80 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Payment Mode</p>
                  <p className="mt-3 text-2xl font-black text-zinc-900">
                    {orderSuccessDetails?.paymentMethod === "qr" ? "QR Payment" : "Cash on Delivery"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    {orderSuccessDetails?.paymentMethod === "qr" ? "Pending verification if needed" : "Collect on delivery"}
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-[1.6rem] border border-zinc-200 bg-zinc-50/80 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-white p-2 text-emerald-700 shadow-sm">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-zinc-900">What happens next</h2>
                    <p className="mt-1 text-sm text-zinc-600">Order confirmation ke baad next steps yahan clear dikh rahe hain.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-zinc-700">
                    Order dashboard me status updates dikhenge jaise `pending`, `confirmed`, aur `out for delivery`.
                  </div>
                  <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-zinc-700">
                    {orderSuccessDetails?.deliveryMethod === "pickup"
                      ? `Pickup address: ${storeSettings.address || "Store address not set yet"}.`
                      : "Delivery address aur customer details order ke saath save ho chuki hain."}
                  </div>
                  <div className="rounded-2xl border border-white bg-white px-4 py-4 text-sm text-zinc-700">
                    {orderSuccessDetails?.paymentMethod === "qr"
                      ? "QR payment wale orders admin verification ke baad confirm ho sakte hain."
                      : "Cash on Delivery order deliver hone par collect kiya jayega."}
                  </div>
                </div>
              </div>
            </div>

            <aside className="border-t border-zinc-200/70 bg-[linear-gradient(180deg,rgba(250,250,249,0.96),rgba(244,247,241,0.96))] px-6 py-8 sm:px-10 lg:border-l lg:border-t-0">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700">Next Actions</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-900">Keep things moving</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Ab aap order track kar sakte ho, homepage par wapas ja sakte ho, ya seedha aur products browse kar sakte ho.
              </p>

              <div className="mt-6 space-y-3">
                <Link href="/dashboard/orders" className="block">
                  <Button className="h-12 w-full rounded-2xl text-base font-semibold" rightIcon={ArrowRight}>
                    View My Orders
                  </Button>
                </Link>
                <Link href="/products" className="block">
                  <Button variant="outline" className="h-12 w-full rounded-2xl text-sm font-semibold">
                    Continue Shopping
                  </Button>
                </Link>
                <Link href="/" className="block">
                  <Button variant="ghost" className="h-12 w-full rounded-2xl text-sm font-semibold" leftIcon={Home}>
                    Back to Home
                  </Button>
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto px-4 pb-44 sm:px-6 lg:px-8 lg:pb-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} leftIcon={ChevronLeft}>
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm">
              <div className="mb-8 flex items-center gap-3">
                <div className="rounded-full bg-green-50 p-2 text-green-600">
                  <Truck className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900">Shipping Address</h2>
              </div>

              <form id="checkout-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {!cartPricing.isValid && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Minimum quantity validation pending hai. Neeche cart summary mein required quantity dekh lo.
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("delivery")}
                      className={`rounded-2xl border-2 p-4 text-left transition-all ${
                        deliveryMethod === "delivery"
                          ? "border-green-600 bg-green-50/60"
                          : "border-zinc-200 bg-white hover:border-green-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Truck className="h-5 w-5 text-green-600" />
                          <div>
                            <div className="font-semibold text-zinc-900">Home Delivery</div>
                            <div className="text-xs text-zinc-500">Order address par delivery</div>
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-4 bg-white ${
                            deliveryMethod === "delivery" ? "border-green-600" : "border-zinc-300"
                          }`}
                        ></div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("pickup")}
                      className={`rounded-2xl border-2 p-4 text-left transition-all ${
                        deliveryMethod === "pickup"
                          ? "border-green-600 bg-green-50/60"
                          : "border-zinc-200 bg-white hover:border-green-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Store className="h-5 w-5 text-green-600" />
                          <div>
                            <div className="font-semibold text-zinc-900">Pick up by store</div>
                            <div className="text-xs text-zinc-500">Khud store se collect karein</div>
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-4 bg-white ${
                            deliveryMethod === "pickup" ? "border-green-600" : "border-zinc-300"
                          }`}
                        ></div>
                      </div>
                    </button>
                  </div>

                  {deliveryMethod === "pickup" && (
                    <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-white p-2 text-green-700">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Pickup Address</p>
                          <p className="mt-1 text-sm leading-6 text-zinc-600">
                            {storeSettings.address || "Store address abhi set nahi hai. Aap admin settings me address add kar sakte ho."}
                          </p>
                          <p className="mt-2 text-xs font-medium text-green-700">
                            Pickup choose karne par delivery charge nahi lagega.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <Input label="Full Name" placeholder="John Doe" {...register("fullName")} error={errors.fullName?.message} />
                  <Input
                    label="Phone Number"
                    placeholder="10-digit mobile"
                    inputMode="numeric"
                    maxLength={10}
                    {...register("phone")}
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10);
                    }}
                    error={errors.phone?.message}
                  />
                </div>

                {deliveryMethod === "delivery" && (
                  <>
                    <Input
                      label="Address Line"
                      placeholder="House no, Street, Locality"
                      {...register("addressLine")}
                      error={errors.addressLine?.message}
                    />

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                      <Input
                        label="Pincode"
                        placeholder="123456"
                        inputMode="numeric"
                        maxLength={6}
                        {...register("pincode")}
                        onInput={(e) => {
                          e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 6);
                        }}
                        error={errors.pincode?.message}
                      />
                      <Input label="City" placeholder="Mumbai" {...register("city")} error={errors.city?.message} />
                      <Input label="State" placeholder="Maharashtra" {...register("state")} error={errors.state?.message} />
                    </div>
                  </>
                )}

                <div className="border-t border-zinc-50 pt-6">
                  <div className="mb-8 flex items-center gap-3">
                    <div className="rounded-full bg-green-50 p-2 text-green-600">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900">Payment Method</h2>
                  </div>

                  <div className="space-y-4">
                    <button
                      type="button"
                      disabled={storeSettings.cod_enabled === false}
                      onClick={() => setPaymentMethod("cod")}
                      className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition-all ${
                        paymentMethod === "cod"
                          ? "border-green-600 bg-green-50/50"
                          : "border-zinc-200 bg-white hover:border-green-300"
                      } ${storeSettings.cod_enabled === false ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span className="font-semibold text-zinc-900">Cash on Delivery</span>
                      <div
                        className={`h-5 w-5 rounded-full border-4 bg-white ${
                          paymentMethod === "cod" ? "border-green-600" : "border-zinc-300"
                        }`}
                      ></div>
                    </button>

                    <button
                      type="button"
                      disabled={storeSettings.online_payment_enabled === false}
                      onClick={() => setPaymentMethod("qr")}
                      className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition-all ${
                        paymentMethod === "qr"
                          ? "border-green-600 bg-green-50/50"
                          : "border-zinc-200 bg-white hover:border-green-300"
                      } ${storeSettings.online_payment_enabled === false ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-zinc-900">Pay Now with QR Code</span>
                      </div>
                      <div
                        className={`h-5 w-5 rounded-full border-4 bg-white ${
                          paymentMethod === "qr" ? "border-green-600" : "border-zinc-300"
                        }`}
                      ></div>
                    </button>

                    {paymentMethod === "qr" && (
                      <div className="rounded-2xl border border-green-100 bg-white p-5">
                        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                              "upi://pay?pa=" + (storeSettings.qr_upi_id || "fmcgstore@upi") + "&pn=FMCG Store&am=" + orderTotal + "&cu=INR"
                            )}`}
                            alt="QR Code Payment"
                            className="h-40 w-40 rounded-2xl border border-zinc-200 bg-white p-2"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold uppercase tracking-widest text-green-700">Scan and Pay</p>
                            <p className="mt-2 text-sm text-zinc-600">
                              UPI ID: <span className="font-semibold text-zinc-900">{storeSettings.qr_upi_id || "fmcgstoreVK@upi"}</span>
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              Amount: <span className="font-semibold text-zinc-900">Rs. {orderTotal}</span>
                            </p>
                            <p className="mt-3 text-sm text-zinc-500">
                              {storeSettings.payment_instructions || "QR scan karke payment complete karo. Order place karne ke baad admin payment verify kar sakta hai."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="hidden lg:block">
                  <Button
                    type="submit"
                    className="h-12 w-full rounded-2xl text-base font-black"
                    isLoading={isLoading}
                    disabled={!cartPricing.isValid}
                  >
                    {paymentMethod === "qr" ? "Confirm QR Payment" : "Place Order"} (Rs. {orderTotal})
                  </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm">
              <h2 className="mb-6 text-xl font-bold text-zinc-900">In Your Cart</h2>
              <div className="mb-8 max-h-96 space-y-4 overflow-y-auto pr-2">
                {cartPricing.lines.map(({ item, pricing }) => (
                  <div key={item.product.id} className="rounded-2xl border border-zinc-100 p-4">
                    <div className="flex gap-4">
                      {(() => {
                        const imageSrc = resolveAssetUrl(
                          item.product.image_url ||
                          "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=100"
                        );
                        return (
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-50">
                        <NextImage
                          src={imageSrc}
                          alt={item.product.name}
                          fill
                          unoptimized={shouldBypassImageOptimization(imageSrc)}
                          className="object-contain p-1"
                        />
                      </div>
                        );
                      })()}
                      <div className="flex-1 text-sm">
                        <h4 className="line-clamp-1 font-semibold text-zinc-900">{item.product.name}</h4>
                        <p className="text-zinc-500">
                          Qty: {item.quantity} x Rs. {pricing.finalUnitPrice}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Minimum order: {pricing.minimumOrderQuantity}
                        </p>
                        {pricing.appliedDiscount && (
                          <p className="mt-1 text-xs font-semibold text-green-700">
                            {formatDiscountLabel(pricing.appliedDiscount)}
                          </p>
                        )}
                        {!pricing.meetsMinimum && (
                          <p className="mt-1 text-xs font-semibold text-red-600">
                            Add {pricing.missingQuantity} more to continue.
                          </p>
                        )}
                      </div>
                      <div className="text-right font-bold text-zinc-900">
                        <div>Rs. {pricing.lineFinalTotal}</div>
                        {pricing.lineDiscount > 0 && (
                          <div className="text-xs font-medium text-zinc-400 line-through">Rs. {pricing.lineBaseTotal}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 border-t border-zinc-100 pt-6">
                <div className="flex justify-between text-zinc-600">
                  <span>Base subtotal</span>
                  <span className="font-semibold text-zinc-900">Rs. {cartPricing.baseSubtotal}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Bulk discount</span>
                  <span className="font-semibold text-green-700">- Rs. {cartPricing.totalDiscount}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-zinc-900">Rs. {totalPrice}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-zinc-900">
                    {deliveryMethod === "pickup" ? "Free (Store Pickup)" : deliveryCharge === 0 ? "Free" : `Rs. ${deliveryCharge}`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-100 pt-4 text-xl font-bold text-zinc-900">
                  <span>Total</span>
                  <span>Rs. {orderTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-20 z-40 border-t border-zinc-200/80 bg-white/95 px-3 pb-2 pt-2 shadow-[0_-18px_50px_-24px_rgba(15,23,42,0.3)] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-lg">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Place Order</p>
              <p className="mt-0.5 text-[1.75rem] leading-none font-black tracking-tight text-zinc-900">Rs. {orderTotal}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold leading-none text-zinc-600">
                {paymentMethod === "qr" ? "QR Payment" : "Cash on Delivery"}
              </p>
              <p className="mt-1 text-[11px] leading-tight text-zinc-500">
                {deliveryMethod === "pickup" ? "Store pickup" : "Home delivery"}
              </p>
            </div>
          </div>

          <Button
            type="submit"
            form="checkout-form"
            className="h-10 w-full rounded-xl text-sm font-semibold"
            isLoading={isLoading}
            disabled={!cartPricing.isValid}
          >
            {paymentMethod === "qr" ? "Confirm QR Payment" : "Place Order"} (Rs. {orderTotal})
          </Button>
        </div>
      </div>
    </div>
  );
}
