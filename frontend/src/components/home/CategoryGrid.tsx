"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Category } from "@/types";
import { resolveAssetUrl } from "@/lib/images";
import { 
  Layers, 
} from "lucide-react";

export default function CategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get("/categories");
        setCategories(response.data.data || []);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:grid-cols-6 lg:px-10">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-zinc-100"></div>
        ))}
      </div>
    );
  }

  return (
    <section className="border-b border-zinc-200 bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">Browse Faster</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-zinc-950">Shop by category</h2>
          </div>
          <Link href="/products?view=categories" className="text-sm font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-950">
            View all
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((category) => (
            <Link 
              key={category.id}
              href={`/products?category=${category.id}`}
              className="group rounded-[1.75rem] border border-zinc-200 bg-white p-5 transition-colors duration-200 hover:border-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">
                  {String(categories.indexOf(category) + 1).padStart(2, "0")}
                </span>
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-zinc-100">
                  {category.image_url ? (
                    <img src={resolveAssetUrl(category.image_url)} alt={category.name} className="h-full w-full object-cover" />
                  ) : (
                    <Layers className="h-5 w-5 text-zinc-400" />
                  )}
                </div>
              </div>
              <div className="mt-8">
                <span className="block text-base font-medium text-zinc-950 transition-colors duration-200 group-hover:text-green-700">
                  {category.name}
                </span>
                <span className="mt-2 block text-sm text-zinc-500">Explore category</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
