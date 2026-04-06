"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Product } from "@/types";
import { useCartStore } from "@/store/cartStore";
import {
  formatDiscountLabel,
  getMaximumProductDiscountPercent,
  getMinimumOrderQuantity,
  getProductPricing,
  getSortedDiscounts,
} from "@/lib/pricing";
import { resolveAssetUrl, shouldBypassImageOptimization } from "@/lib/images";
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
  const imageSrc = resolveAssetUrl(
    product.image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400"
  );

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-zinc-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-green-100 hover:shadow-[0_22px_55px_-24px_rgba(22,163,74,0.35)]">
      <Link href={`/products/${product.id}`} className="relative aspect-[16/9] overflow-hidden bg-zinc-100 sm:aspect-[4/3] lg:aspect-square">
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          unoptimized={shouldBypassImageOptimization(imageSrc)}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/20 to-transparent" />
        {maxDiscountPercent > 0 && (
          <div className="absolute left-3 top-3 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white shadow-sm">
            Save up to {maxDiscountPercent}%
          </div>
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
          <details className="mb-3 rounded-2xl border border-green-100 bg-green-50/70 p-2.5 sm:mb-4 sm:p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-green-700 sm:gap-3 sm:text-xs sm:tracking-[0.24em]">
              <span>Bulk Price Slabs</span>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] tracking-[0.14em] text-zinc-600">
                View All
              </span>
            </summary>
            <div className="mt-3 space-y-2">
              {slabs.map((slab, index) => (
                <div
                  key={`${slab.min_quantity}-${slab.max_quantity ?? "plus"}-${index}`}
                  className="rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-zinc-700"
                >
                  {formatDiscountLabel(slab)}
                </div>
              ))}
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
