"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, ShoppingBag, Sparkles, Trash2, Truck } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { formatDiscountLabel, getCartPricing, getProductPricing, getSortedDiscounts } from "@/lib/pricing";
import { resolveAssetUrl, shouldBypassImageOptimization } from "@/lib/images";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import api from "@/lib/api";

type PublicStoreSettings = {
  delivery_charge?: number;
  free_delivery_above?: number;
};

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [storeSettings, setStoreSettings] = useState<PublicStoreSettings>({
    delivery_charge: 50,
    free_delivery_above: 1999,
  });

  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const res = await api.get("/settings/store");
        setStoreSettings((prev) => ({ ...prev, ...(res.data.data || {}) }));
      } catch (error) {
        console.error("Failed to load store settings", error);
      }
    };

    void fetchStoreSettings();
  }, []);

  const cartPricing = getCartPricing(items);
  const totalPrice = cartPricing.subtotal;
  const shippingThreshold = Math.max(1, Number(storeSettings.free_delivery_above ?? 1999) || 1999);
  const shippingCharge = Math.max(0, Number(storeSettings.delivery_charge ?? 50) || 50);
  const shipping = totalPrice >= shippingThreshold ? 0 : shippingCharge;
  const orderTotal = totalPrice + shipping;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const freeShippingProgress = Math.min(100, Math.round((totalPrice / shippingThreshold) * 100));

  if (items.length === 0) {
    return (
      <div className="relative min-h-[70vh] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(187,247,208,0.5),_transparent_45%),linear-gradient(180deg,_#fffef8_0%,_#f6f7f2_100%)]">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(90deg,rgba(22,101,52,0.08),rgba(245,158,11,0.08),rgba(22,101,52,0.08))]" />
        <div className="container relative mx-auto flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Cart abhi khali hai</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600 sm:text-base">
              Products add karo aur bulk pricing, minimum quantity aur delivery savings yahin se manage karo.
            </p>
            <Link href="/products" className="mt-8 inline-flex">
              <Button size="lg" className="rounded-2xl px-8">
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(187,247,208,0.35),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(254,240,138,0.28),_transparent_30%),linear-gradient(180deg,_#fcfcf8_0%,_#f4f4ef_100%)]">
      <div className="container mx-auto px-4 py-8 pb-44 sm:px-6 lg:px-8 lg:pb-10 lg:py-10">
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 shadow-[0_32px_120px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="border-b border-zinc-200/70 px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
            <div className="grid gap-4 sm:gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-end">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-emerald-700 sm:text-xs sm:tracking-[0.32em]">Cart Overview</p>
                
              </div>
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex-1 rounded-[1.15rem] border border-emerald-100 bg-emerald-50/80 p-3 sm:rounded-[1.5rem] sm:p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 sm:text-xs sm:tracking-[0.22em]">Products</p>
                    <p className="mt-2 text-[2rem] leading-none font-black text-zinc-900 sm:text-3xl">{items.length}</p>
                  
                  </div>

                  <div className="flex-1 rounded-[1.15rem] border border-amber-100 bg-amber-50/80 p-3 sm:rounded-[1.5rem] sm:p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 sm:text-xs sm:tracking-[0.22em]">Units</p>
                    <p className="mt-2 text-[2rem] leading-none font-black text-zinc-900 sm:text-3xl">{totalUnits}</p>
                   
                  </div>

                  <div className="flex-1 rounded-[1.15rem] border border-sky-100 bg-sky-50/80 p-3 sm:rounded-[1.5rem] sm:p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700 sm:text-xs sm:tracking-[0.22em]">Savings</p>
                    <p className="mt-2 text-[2rem] leading-none font-black text-zinc-900 sm:text-3xl">Rs. {cartPricing.totalDiscount}</p>
                
                  </div>
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="rounded-[1.1rem] border border-zinc-200/80 bg-white/90 p-3.5 sm:rounded-[1.5rem] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-900 sm:text-sm">Free delivery progress</p>
                    <p className="mt-1 text-xs text-zinc-600 sm:text-sm">
                      {shipping === 0
                        ? "Free delivery unlock ho chuki hai."
                        : `Bas Rs. ${shippingThreshold - totalPrice} aur add karo for free delivery.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs">
                    <Truck className="h-3.5 w-3.5 text-emerald-700 sm:h-4 sm:w-4" />
                    {shipping === 0 ? "Delivery unlocked" : `${freeShippingProgress}% reached`}
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 sm:mt-4 sm:h-2.5">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#15803d_0%,#f59e0b_100%)] transition-all duration-500"
                    style={{ width: `${Math.max(12, freeShippingProgress)}%` }}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                className="h-10 rounded-xl px-4 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 sm:h-12 sm:rounded-2xl sm:px-5"
                onClick={() => clearCart()}
              >
                Clear Cart
              </Button>
            </div>

            {!cartPricing.isValid && (
              <div className="mt-5 rounded-[1.4rem] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900">
                Kuch items minimum quantity rule meet nahi kar rahe. Checkout tabhi allow hoga jab minimum quantity complete ho jayegi.
              </div>
            )}
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="px-6 py-6 sm:px-8 lg:px-10 lg:py-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-zinc-900">Selected Items</h2>
                </div>
                <Button
                variant="outline"
                className="rounded-2xl border-green-600 bg-green-500 text-white px-3 py-1 text-sm font-medium hover:bg-green-600 transition"
                onClick={() => router.push("/products")}
              >
                Continue Shopping
              </Button>
              </div>

              <div className="space-y-4">
                {items.map((item) => {
                  const pricing = getProductPricing(item.product, item.quantity);
                  const slabs = getSortedDiscounts(item.product);
                  const imageSrc = resolveAssetUrl(
                    item.product.image_url ||
                    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200"
                  );

                  return (
                    <div
                      key={item.product.id}
                      className="group grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-[1.1rem] border border-zinc-200/80 bg-white/96 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-5 sm:rounded-[1.75rem] sm:bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] sm:p-6"
                    >
                      <div className="space-y-2">
                        <div className="relative h-[72px] overflow-hidden rounded-xl border border-zinc-100 bg-[linear-gradient(180deg,_#fafaf9_0%,_#f4f4f5_100%)] sm:h-full sm:min-h-[144px] sm:rounded-[1.35rem] sm:bg-[radial-gradient(circle_at_top,_rgba(187,247,208,0.55),_transparent_50%),linear-gradient(180deg,_#fafaf9_0%,_#f4f4f5_100%)]">
                          <NextImage
                            src={imageSrc}
                            alt={item.product.name}
                            fill
                            unoptimized={shouldBypassImageOptimization(imageSrc)}
                            className="object-contain p-2 transition duration-500 group-hover:scale-105 sm:p-3"
                          />
                        </div>
                        <div className="sm:hidden">
                          <div className="text-base font-black leading-none text-zinc-900">Rs. {pricing.lineFinalTotal}</div>
                          {pricing.lineDiscount > 0 && (
                            <div className="mt-1 text-[11px] text-zinc-400 line-through">Rs. {pricing.lineBaseTotal}</div>
                          )}
                          <div className="mt-1 text-[11px] font-medium text-zinc-600">Rs. {pricing.finalUnitPrice} per unit</div>
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-col">
                        <div className="flex flex-col gap-3 border-b border-zinc-200/70 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.22em]">
                                {item.product.brand_info?.name || "Generic"}
                              </span>
                              {pricing.appliedDiscount && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800 sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.2em]">
                                  {formatDiscountLabel(pricing.appliedDiscount)}
                                </span>
                              )}
                            </div>
                            <h3 className="mt-2 text-sm font-black leading-snug text-zinc-900 sm:mt-3 sm:text-xl sm:tracking-tight">
                              {item.product.name}
                            </h3>
                            <p className="mt-1 text-xs text-zinc-500 sm:mt-2 sm:text-sm">
                              {item.product.unit} | Minimum order {pricing.minimumOrderQuantity}
                            </p>
                            {slabs.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {slabs.map((slab, index) => {
                                  const isActive =
                                    pricing.appliedDiscount?.min_quantity === slab.min_quantity &&
                                    pricing.appliedDiscount?.max_quantity === slab.max_quantity &&
                                    pricing.appliedDiscount?.discount_type === slab.discount_type &&
                                    pricing.appliedDiscount?.discount_value === slab.discount_value;

                                  return (
                                    <span
                                      key={`${slab.min_quantity}-${slab.max_quantity ?? "plus"}-${index}`}
                                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] sm:px-3 sm:text-[11px] ${
                                        isActive
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-zinc-100 text-zinc-600"
                                      }`}
                                    >
                                      {formatDiscountLabel(slab)}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : null}
                            {!pricing.appliedDiscount && pricing.nextDiscount && (
                              <p className="mt-2 hidden items-center gap-2 text-sm font-medium text-zinc-600 sm:inline-flex">
                                <Sparkles className="h-4 w-4 text-amber-500" />
                                Next slab: {formatDiscountLabel(pricing.nextDiscount)}
                              </p>
                            )}
                          </div>

                          <div className="hidden sm:text-right">
                            <p className="hidden text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 sm:block">Line Total</p>
                            <div className="mt-1 text-xl font-black leading-none text-zinc-900 sm:mt-2 sm:text-2xl">
                              Rs. {pricing.lineFinalTotal}
                            </div>
                            {pricing.lineDiscount > 0 && (
                              <div className="mt-1 text-xs text-zinc-400 line-through sm:text-sm">Rs. {pricing.lineBaseTotal}</div>
                            )}
                            <div className="mt-1 text-xs font-medium text-zinc-600 sm:mt-2 sm:text-sm">
                              Rs. {pricing.finalUnitPrice} per unit
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-3 sm:pt-4 lg:flex-row lg:items-end lg:justify-between">
                          <div className="flex items-end justify-between gap-3 sm:block sm:space-y-2">
                            <div>
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:mb-2 sm:text-xs sm:tracking-[0.28em]">
                                Qty
                              </p>
                              <QuantitySelector
                                quantity={item.quantity}
                                max={item.product.stock}
                                size="sm"
                                onChange={(nextQuantity) => updateQuantity(item.product.id, nextQuantity)}
                              />
                            </div>

                            <button
                              onClick={() => removeItem(item.product.id)}
                              className="inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700 sm:gap-2 sm:text-sm"
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              Remove item
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="hidden border-t border-zinc-200/70 bg-[linear-gradient(180deg,rgba(244,247,241,0.92),rgba(255,255,255,0.92))] px-6 py-6 sm:px-8 lg:block lg:border-l lg:border-t-0 lg:px-8 lg:py-8">
              <div className="lg:sticky lg:top-24">
                <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-700">Checkout</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-900">Order Summary</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Final amount, delivery impact aur savings clear rakhe gaye hain so checkout se pehle sab kuch easy to verify ho.
                </p>

                <div className="mt-6 rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-zinc-600">
                      <span>Base subtotal</span>
                      <span className="font-semibold text-zinc-900">Rs. {cartPricing.baseSubtotal}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-zinc-600">
                      <span>Bulk discount</span>
                      <span className="font-semibold text-emerald-700">- Rs. {cartPricing.totalDiscount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-zinc-600">
                      <span>Delivery fee</span>
                      <span className="font-semibold text-zinc-900">{shipping === 0 ? "Free" : `Rs. ${shipping}`}</span>
                    </div>
                  </div>

                  <div className="my-5 h-px bg-zinc-200" />

                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Total payable</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-zinc-900">Rs. {orderTotal}</p>
                    </div>
                    <div className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700">
                      {totalUnits} units
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {cartPricing.isValid ? (
                    <Link href={isAuthenticated ? "/checkout" : "/auth/login?redirect=/checkout"} className="block">
                      <Button className="h-12 w-full rounded-2xl text-base font-semibold" rightIcon={ArrowRight}>
                        Proceed to Checkout
                      </Button>
                    </Link>
                  ) : (
                    <Button className="h-12 w-full rounded-2xl text-base font-semibold" disabled>
                      Fix minimum quantity to checkout
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-zinc-300 bg-white/80 text-sm font-semibold"
                    onClick={() => router.push("/products")}
                  >
                    Add More Products
                  </Button>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3 rounded-[1.25rem] border border-zinc-200/80 bg-white/70 px-4 py-4">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Minimum quantity checks active</p>
                      <p className="mt-1 text-sm text-zinc-600">Checkout tabhi enable hoga jab har product ka minimum order rule meet ho.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-[1.25rem] border border-zinc-200/80 bg-white/70 px-4 py-4">
                    <Truck className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Delivery estimate ready</p>
                      <p className="mt-1 text-sm text-zinc-600">Free delivery threshold clearly visible hai so user ko extra amount instantly samajh aaye.</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-20 z-40 border-t border-zinc-200/80 bg-white/95 px-3 pb-2 pt-2 shadow-[0_-18px_50px_-24px_rgba(15,23,42,0.3)] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-lg">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Total Payable</p>
              <p className="mt-0.5 text-[1.75rem] leading-none font-black tracking-tight text-zinc-900">Rs. {orderTotal}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold leading-none text-zinc-600">{totalUnits} units</p>
              <p className="mt-1 text-[11px] leading-tight text-zinc-500">
                {shipping === 0 ? "Free delivery unlocked" : `Delivery Rs. ${shipping}`}
              </p>
            </div>
          </div>

          {cartPricing.isValid ? (
            <Link href={isAuthenticated ? "/checkout" : "/auth/login?redirect=/checkout"} className="block">
              <Button className="h-10 w-full rounded-xl text-sm font-semibold" rightIcon={ArrowRight}>
                Proceed to Checkout
              </Button>
            </Link>
          ) : (
            <Button className="h-10 w-full rounded-xl text-sm font-semibold" disabled>
              Fix minimum quantity to checkout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
