"use client";

import { useEffect, useState } from "react";
import { Product } from "@/types";
import api from "@/lib/api";
import ProductCard from "../product/ProductCard";

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get("/products");
        // Access nested items from standard APIResponse
        const items = response.data.data?.items || [];
        setProducts(items.slice(0, 8));
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl bg-zinc-100"></div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-zinc-100">
        <p className="text-zinc-500">No products found. Stay tuned for deals!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
