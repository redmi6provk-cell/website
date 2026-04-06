import { CartItem, Product, QuantityDiscount } from "@/types";

export interface ProductPricingSummary {
  minimumOrderQuantity: number;
  baseUnitPrice: number;
  finalUnitPrice: number;
  lineBaseTotal: number;
  lineFinalTotal: number;
  lineDiscount: number;
  meetsMinimum: boolean;
  missingQuantity: number;
  appliedDiscount?: QuantityDiscount;
  nextDiscount?: QuantityDiscount;
  legacyDiscount: number;
}

export function getMinimumOrderQuantity(product: Product) {
  return Math.max(1, product.minimum_order_quantity || 1);
}

export function getSortedDiscounts(product: Product) {
  return [...(product.quantity_discounts || [])].sort((a, b) => a.min_quantity - b.min_quantity);
}

export function getUnitDiscountAmount(product: Product, discount?: QuantityDiscount) {
  if (!discount) {
    return 0;
  }

  return discount.discount_type === "PERCENT"
    ? (product.price * discount.discount_value) / 100
    : discount.discount_value;
}

export function getDiscountPercent(product: Product, discountAmount: number) {
  if (product.price <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((discountAmount / product.price) * 100));
}

export function getMaximumProductDiscountPercent(product: Product) {
  const legacyDiscountAmount = Math.max(0, product.discount || 0);
  const slabDiscountAmount = getSortedDiscounts(product).reduce((best, slab) => {
    return Math.max(best, getUnitDiscountAmount(product, slab));
  }, 0);

  return getDiscountPercent(product, Math.max(legacyDiscountAmount, slabDiscountAmount));
}

export function getProductPricing(product: Product, quantity: number): ProductPricingSummary {
  const safeQuantity = Math.max(1, quantity);
  const minimumOrderQuantity = getMinimumOrderQuantity(product);
  const sortedDiscounts = getSortedDiscounts(product);

  const appliedDiscount = sortedDiscounts.find((slab) => {
    const withinMin = safeQuantity >= slab.min_quantity;
    const withinMax = slab.max_quantity == null || safeQuantity <= slab.max_quantity;
    return withinMin && withinMax;
  });

  const nextDiscount = sortedDiscounts.find((slab) => slab.min_quantity > safeQuantity);
  const legacyDiscount = Math.max(0, product.discount || 0);

  const slabDiscountAmount = getUnitDiscountAmount(product, appliedDiscount);

  const unitDiscount = Math.max(legacyDiscount, slabDiscountAmount);
  const finalUnitPrice = Math.max(0, product.price - unitDiscount);
  const lineBaseTotal = product.price * safeQuantity;
  const lineFinalTotal = finalUnitPrice * safeQuantity;

  return {
    minimumOrderQuantity,
    baseUnitPrice: product.price,
    finalUnitPrice,
    lineBaseTotal,
    lineFinalTotal,
    lineDiscount: Math.max(0, lineBaseTotal - lineFinalTotal),
    meetsMinimum: safeQuantity >= minimumOrderQuantity,
    missingQuantity: Math.max(0, minimumOrderQuantity - safeQuantity),
    appliedDiscount,
    nextDiscount,
    legacyDiscount,
  };
}

export function getCartPricing(items: CartItem[]) {
  const lines = items.map((item) => ({
    item,
    pricing: getProductPricing(item.product, item.quantity),
  }));

  const subtotal = lines.reduce((sum, line) => sum + line.pricing.lineFinalTotal, 0);
  const baseSubtotal = lines.reduce((sum, line) => sum + line.pricing.lineBaseTotal, 0);
  const totalDiscount = lines.reduce((sum, line) => sum + line.pricing.lineDiscount, 0);
  const invalidItems = lines.filter((line) => !line.pricing.meetsMinimum);

  return {
    lines,
    subtotal,
    baseSubtotal,
    totalDiscount,
    invalidItems,
    isValid: invalidItems.length === 0,
  };
}

export function formatDiscountLabel(discount?: QuantityDiscount) {
  if (!discount) {
    return "No bulk discount";
  }

  const rangeLabel =
    discount.max_quantity == null
      ? `${discount.min_quantity}+ qty`
      : `${discount.min_quantity}-${discount.max_quantity} qty`;

  const valueLabel =
    discount.discount_type === "PERCENT"
      ? `${discount.discount_value}% off`
      : `Rs. ${discount.discount_value} off`;

  return `${rangeLabel}: ${valueLabel}`;
}
