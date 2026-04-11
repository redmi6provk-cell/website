"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Product } from "@/types";
import { useCartStore } from "@/store/cartStore";
import {
  getMaximumProductDiscountPercent,
  getMinimumOrderQuantity,
  getProductPricing,
  getSortedDiscounts,
} from "@/lib/pricing";
import { shouldBypassImageOptimization } from "@/lib/images";
import { getProductImageUrls } from "@/lib/productImages";
import { Button } from "../ui/Button";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCartStore();
  const minimumOrderQuantity = getMinimumOrderQuantity(product);
  const pricing = getProductPricing(product, minimumOrderQuantity);
  const slabs = getSortedDiscounts(product);
  const maxDiscountPercent = getMaximumProductDiscountPercent(product);
  const categoryLabel = product.category_info?.name || "Daily essentials";
  const canAddToCart = product.stock >= minimumOrderQuantity;
  const { primaryImage, secondaryImage } = getProductImageUrls(product);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-zinc-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-green-100 hover:shadow-[0_22px_55px_-24px_rgba(22,163,74,0.35)]">
      <Link href={`/products/${product.id}`} className="relative aspect-[16/9] overflow-hidden bg-zinc-100 sm:aspect-[4/3] lg:aspect-square">
        <Image
          src={primaryImage}
          alt={product.name}
          fill
          unoptimized={shouldBypassImageOptimization(primaryImage)}
          className={`object-cover transition-all duration-300 group-hover:scale-105 ${secondaryImage ? "group-hover:opacity-0" : ""}`}
        />
        {secondaryImage && (
          <Image
            src={secondaryImage}
            alt={`${product.name} alternate view`}
            fill
            unoptimized={shouldBypassImageOptimization(secondaryImage)}
            className="object-cover opacity-0 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
          />
        )}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/20 to-transparent" />
        {maxDiscountPercent > 0 && (
          <div className="absolute left-3 top-3 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white shadow-sm">
            Save up to {maxDiscountPercent}%
          </div>
        )}
        {secondaryImage && (
          <>
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-zinc-900" />
              <span className="h-2 w-2 rounded-full bg-zinc-300" />
            </div>
            <div className="absolute bottom-3 right-3 h-14 w-14 overflow-hidden rounded-2xl border-2 border-white bg-white/95 shadow-lg">
              <Image
                src={secondaryImage}
                alt={`${product.name} preview`}
                fill
                unoptimized={shouldBypassImageOptimization(secondaryImage)}
                className="object-cover"
              />
            </div>
          </>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2 sm:gap-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {product.brand_info?.name || "Generic"}
          </div>
          <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {categoryLabel}
          </div>
        </div>

        <Link
          href={`/products/${product.id}`}
          className="mb-2 line-clamp-2 min-h-[2.8rem] text-[15px] font-semibold leading-6 text-zinc-900 transition-colors hover:text-green-600 sm:min-h-[3.5rem] sm:text-base"
        >
          {product.name}
        </Link>

        <div className="mb-3 text-xs text-zinc-500">{product.unit || "1 unit pack"}</div>
        <div className="mb-2 text-xs font-medium text-zinc-600">
          Min order: {minimumOrderQuantity} {minimumOrderQuantity === 1 ? "piece" : "pieces"}
        </div>

        {slabs.length > 0 && (
          <details className="mb-3 overflow-hidden rounded-[22px] border border-emerald-100 bg-[linear-gradient(180deg,rgba(236,253,245,0.95),rgba(255,255,255,1))] shadow-[0_10px_30px_-24px_rgba(5,150,105,0.55)] sm:mb-4">
            <summary className="flex cursor-pointer list-none flex-col items-start gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
                  Bulk savings
                </div>
                <div className="mt-1 text-xs font-medium text-zinc-600">
                  Buy more, pay less
                </div>
              </div>
              <div className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-700">
                {slabs.length > 2 ? `View ${slabs.length}` : "View"}
              </div>
            </summary>
            <div className="border-t border-emerald-100/80 px-3 pb-3 pt-2">
              <div className="space-y-2">
                {slabs.slice(0, 3).map((slab, index) => (
                  <div
                    key={`${slab.min_quantity}-${slab.max_quantity ?? "plus"}-${index}`}
                    className="flex flex-col items-start gap-1 rounded-2xl bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="text-xs font-semibold text-zinc-800">
                      {slab.max_quantity ? `${slab.min_quantity}-${slab.max_quantity} pcs` : `${slab.min_quantity}+ pcs`}
                    </div>
                    <div className="text-right text-xs font-bold text-emerald-700">
                      {slab.discount_type === "PERCENT"
                        ? `${Number(slab.discount_value || 0)}% off`
                        : `Rs. ${Number(slab.discount_value || 0)} off`}
                    </div>
                  </div>
                ))}
                {slabs.length > 3 && (
                  <div className="px-1 pt-1 text-[11px] font-medium text-zinc-500">
                    +{slabs.length - 3} more bulk tiers
                  </div>
                )}
              </div>
            </div>
          </details>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div>
            <div className="text-xl font-bold text-zinc-900 sm:text-lg">Rs. {pricing.finalUnitPrice}</div>
            {pricing.lineDiscount > 0 && (
              <div className="text-xs text-zinc-400 line-through">Rs. {product.price}</div>
            )}
          </div>

          <Button
            size="icon"
            onClick={() => addItem(product, minimumOrderQuantity)}
            className="h-10 w-10 rounded-2xl shadow-sm"
            aria-label={`Add ${minimumOrderQuantity} ${product.name} to cart`}
            disabled={!canAddToCart}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
