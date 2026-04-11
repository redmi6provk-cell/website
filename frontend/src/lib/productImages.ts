import { Product } from "@/types";
import { resolveAssetUrl } from "@/lib/images";

const fallbackImage =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800";

export function getProductImageUrls(product: Pick<Product, "image_url" | "secondary_image_url">) {
  const primaryImage = resolveAssetUrl(product.image_url || fallbackImage);
  const secondaryImage = product.secondary_image_url
    ? resolveAssetUrl(product.secondary_image_url)
    : null;

  return {
    primaryImage,
    secondaryImage,
    galleryImages: secondaryImage ? [primaryImage, secondaryImage] : [primaryImage],
  };
}
