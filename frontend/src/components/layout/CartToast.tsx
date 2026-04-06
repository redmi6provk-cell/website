"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShoppingCart, Sparkles } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { resolveAssetUrl, shouldBypassImageOptimization } from "@/lib/images";

export default function CartToast() {
  const { cartNotice, clearCartNotice, getTotalItems } = useCartStore();
  const totalItems = getTotalItems();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!cartNotice) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    const timeout = window.setTimeout(() => {
      setIsVisible(false);
    }, 2800);

    const removeTimeout = window.setTimeout(() => {
      clearCartNotice();
    }, 3200);

    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(removeTimeout);
    };
  }, [cartNotice, clearCartNotice]);

  if (!cartNotice) {
    return null;
  }

  const imageSrc = resolveAssetUrl(
    cartNotice.productImage ||
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=120"
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
      <div
        className={`pointer-events-auto w-full max-w-lg transition-all duration-500 ${
          isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-95 opacity-0"
        }`}
      >
        <div className="relative overflow-hidden rounded-[28px] border border-emerald-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,253,245,0.92))] p-4 shadow-[0_28px_80px_-30px_rgba(22,163,74,0.55)] backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#16a34a_0%,#84cc16_55%,#f59e0b_100%)]" />
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-[20px] border border-white/80 bg-white shadow-sm">
              <NextImage
                src={imageSrc}
                alt={cartNotice.productName}
                fill
                unoptimized={shouldBypassImageOptimization(imageSrc)}
                className="object-contain p-2"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Added to cart
                  </div>
                  <p className="mt-3 text-base font-black tracking-tight text-zinc-900">{cartNotice.productName}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Added {cartNotice.addedQuantity} item{cartNotice.addedQuantity === 1 ? "" : "s"} • Cart total {totalItems} item{totalItems === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Link
                  href="/cart"
                  onClick={clearCartNotice}
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-zinc-800"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  View Cart
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <p className="text-xs font-medium text-zinc-500">
                  Total for this product: {cartNotice.totalQuantity}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#16a34a_0%,#84cc16_60%,#f59e0b_100%)] transition-[width] duration-[3000ms] ease-linear"
              style={{ width: isVisible ? "100%" : "0%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
