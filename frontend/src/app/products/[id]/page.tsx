"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Product } from "@/types";
import api from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/Button";
import { ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDiscountLabel, getMinimumOrderQuantity, getProductPricing, getSortedDiscounts } from "@/lib/pricing";
import { shouldBypassImageOptimization } from "@/lib/images";
import { getProductImageUrls } from "@/lib/productImages";
import { QuantitySelector } from "@/components/product/QuantitySelector";

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addItem } = useCartStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await api.get(`/products/${id}`);
        const fetchedProduct: Product = response.data.data;
        setProduct(fetchedProduct);
        const { primaryImage } = getProductImageUrls(fetchedProduct);
        setSelectedImage(primaryImage);
        const minimumQuantity = getMinimumOrderQuantity(fetchedProduct);
        setQuantity(Math.min(fetchedProduct.stock, minimumQuantity));
      } catch (error) {
        console.error("Failed to fetch product:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  const pricing = useMemo(() => {
    if (!product) {
      return null;
    }
    return getProductPricing(product, quantity);
  }, [product, quantity]);

  const galleryImages = product ? getProductImageUrls(product).galleryImages : [];
  const imageSrc = selectedImage || galleryImages[0] || "";
  const activeImageIndex =
    imageSrc === ""
      ? 0
      : Math.max(
          0,
          galleryImages.findIndex((galleryImage) => galleryImage === imageSrc)
        );

  useEffect(() => {
    if (galleryImages.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSelectedImage((currentImage) => {
        const currentIndex = galleryImages.findIndex((galleryImage) => galleryImage === currentImage);
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = (safeIndex + 1) % galleryImages.length;
        return galleryImages[nextIndex];
      });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [galleryImages]);

  if (loading) {
    return (
      <div className="container mx-auto animate-pulse px-4 py-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="aspect-square rounded-3xl bg-zinc-100"></div>
          <div className="space-y-6">
            <div className="h-4 w-24 bg-zinc-100"></div>
            <div className="h-8 w-64 bg-zinc-100"></div>
            <div className="h-4 w-32 bg-zinc-100"></div>
            <div className="h-24 w-full bg-zinc-100"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!product || !pricing) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Button onClick={() => router.push("/products")} variant="outline" className="mt-4">
          Back to Shop
        </Button>
      </div>
    );
  }

  const minimumOrderQuantity = getMinimumOrderQuantity(product);
  const slabs = getSortedDiscounts(product);
  const canMeetMinimumStock = product.stock >= minimumOrderQuantity;

  const showPreviousImage = () => {
    if (galleryImages.length <= 1) {
      return;
    }

    const nextIndex = (activeImageIndex - 1 + galleryImages.length) % galleryImages.length;
    setSelectedImage(galleryImages[nextIndex]);
  };

  const showNextImage = () => {
    if (galleryImages.length <= 1) {
      return;
    }

    const nextIndex = (activeImageIndex + 1) % galleryImages.length;
    setSelectedImage(galleryImages[nextIndex]);
  };

  const handleAddToCart = () => {
    if (!canMeetMinimumStock) {
      setCartError(`Only ${product.stock} units available in stock.`);
      return;
    }
    if (!pricing.meetsMinimum) {
      setCartError(`Minimum ${minimumOrderQuantity} quantity required for this product.`);
      return;
    }
    if (quantity > product.stock) {
      setCartError(`Only ${product.stock} units available in stock.`);
      return;
    }

    setCartError(null);
    addItem(product, quantity);
  };

  return (
    <div className="min-h-screen bg-white py-12 pb-56 md:pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          leftIcon={ChevronLeft}
          className="mb-8"
        >
          Back
        </Button>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-zinc-100 bg-zinc-50">
              <Image
                src={imageSrc}
                alt={product.name}
                fill
                unoptimized={shouldBypassImageOptimization(imageSrc)}
                className="object-contain p-8"
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPreviousImage}
                    className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-zinc-900 shadow-lg transition hover:bg-white"
                    aria-label="Show previous product image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-zinc-900 shadow-lg transition hover:bg-white"
                    aria-label="Show next product image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              {pricing.lineDiscount > 0 && (
                <div className="absolute left-6 top-6 rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-lg">
                  Bulk savings active
                </div>
              )}
              {galleryImages.length > 1 && (
                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-sm">
                  {galleryImages.map((galleryImage, index) => (
                    <button
                      key={`${galleryImage}-dot-${index}`}
                      type="button"
                      onClick={() => setSelectedImage(galleryImage)}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        activeImageIndex === index ? "bg-zinc-900" : "bg-zinc-300"
                      }`}
                      aria-label={`Show product image ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {galleryImages.map((galleryImage, index) => (
                  <button
                    key={`${galleryImage}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(galleryImage)}
                    className={`relative aspect-square overflow-hidden rounded-2xl border bg-zinc-50 transition ${
                      imageSrc === galleryImage ? "border-green-500 ring-2 ring-green-100" : "border-zinc-100"
                    }`}
                  >
                    <Image
                      src={galleryImage}
                      alt={`${product.name} image ${index + 1}`}
                      fill
                      unoptimized={shouldBypassImageOptimization(galleryImage)}
                      className="object-contain p-3"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="mb-2 text-sm font-medium text-green-600">{product.brand_info?.name || "Generic"}</div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{product.name}</h1>
            <div className="mt-3 flex items-center gap-4">
              <span className="text-3xl font-bold text-zinc-900">Rs. {pricing.finalUnitPrice}</span>
              {pricing.lineDiscount > 0 && (
                <span className="text-xl text-zinc-400 line-through">Rs. {product.price}</span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-500">
              <span>Unit: {product.unit || "1 piece"}</span>
              <span>Minimum order: {minimumOrderQuantity}</span>
              <span>{product.stock > 0 ? "In stock" : "Out of stock"}</span>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <h3 className="mb-4 border-b border-zinc-100 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-900">
                  Description
                </h3>
                <p className="text-base leading-relaxed text-zinc-600">
                  {product.description || "No description provided for this product. High-quality FMCG item trusted by millions."}
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-100 bg-zinc-50/60 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">Quantity Pricing</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm">
                    Selected: {quantity}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <QuantitySelector
                      quantity={quantity}
                      max={product.stock}
                      onChange={(nextQuantity) => {
                        setQuantity(nextQuantity);
                        setCartError(null);
                      }}
                    />

                    {!canMeetMinimumStock ? (
                      <p className="text-sm font-medium text-red-600">
                        Minimum order {minimumOrderQuantity} hai, but stock me sirf {product.stock} units hain.
                      </p>
                    ) : !pricing.meetsMinimum ? (
                      <p className="text-sm font-medium text-red-600">
                        Minimum {minimumOrderQuantity} quantity required. Add {pricing.missingQuantity} more.
                      </p>
                    ) : pricing.appliedDiscount ? (
                      <p className="text-sm font-medium text-green-700">
                        {formatDiscountLabel(pricing.appliedDiscount)}
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-500">No bulk discount on this quantity yet.</p>
                    )}
                  </div>

                  <div className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-zinc-500">Current total</div>
                      <div className="mt-1 text-lg font-bold text-zinc-900">Rs. {pricing.lineFinalTotal}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-zinc-500">You save</div>
                      <div className="mt-1 text-lg font-bold text-green-700">Rs. {pricing.lineDiscount}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-zinc-500">Next slab</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">
                        {pricing.nextDiscount
                          ? `${formatDiscountLabel(pricing.nextDiscount)}`
                          : "Best slab unlocked"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-100 bg-white p-5">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-900">Discount Slabs</h3>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    {minimumOrderQuantity} se {minimumOrderQuantity === 1 ? "purchase" : "kam se kam purchase"} required to order.
                  </div>
                  {slabs.length > 0 ? (
                    slabs.map((slab, index) => (
                      <div key={`${slab.min_quantity}-${index}`} className="flex items-center justify-between rounded-2xl border border-zinc-100 px-4 py-3">
                        <div className="text-sm font-semibold text-zinc-900">
                          {slab.max_quantity == null ? `${slab.min_quantity}+ quantity` : `${slab.min_quantity} to ${slab.max_quantity} quantity`}
                        </div>
                        <div className="text-sm text-green-700">
                          {slab.discount_type === "PERCENT" ? `${slab.discount_value}% off` : `Rs. ${slab.discount_value} off`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-3 text-sm text-zinc-500">
                      No quantity discount slabs set yet for this product.
                    </div>
                  )}
                </div>
              </div>

              {cartError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {cartError}
                </div>
              )}

              <div className="hidden gap-4 border-t border-zinc-100 pt-6 md:flex">
                <Button
                  onClick={handleAddToCart}
                  className="h-12 flex-1 rounded-2xl"
                  leftIcon={ShoppingCart}
                  disabled={product.stock <= 0 || !canMeetMinimumStock}
                >
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-24 z-40 border-t border-zinc-200 bg-white/96 px-4 py-3 shadow-[0_-10px_30px_-20px_rgba(0,0,0,0.28)] backdrop-blur md:hidden">
        <div className="mx-auto max-w-md">
          <p className="mb-2 text-center text-xs font-medium tracking-[0.08em] text-zinc-500">
            Rs. {pricing.finalUnitPrice} each
          </p>
          <Button
            onClick={handleAddToCart}
            className="h-12 w-full rounded-2xl"
            leftIcon={ShoppingCart}
            disabled={product.stock <= 0 || !canMeetMinimumStock}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
