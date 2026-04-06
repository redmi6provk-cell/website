"use client";

import { Category } from "@/types";
import { Input } from "@/components/ui/Input";

interface FilterSidebarProps {
  categories: Category[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  minPrice: string;
  maxPrice: string;
  onPriceChange: (min: string, max: string) => void;
}

export default function FilterSidebar({
  categories,
  selectedCategory,
  onCategoryChange,
  minPrice,
  maxPrice,
  onPriceChange,
}: FilterSidebarProps) {
  return (
    <aside className="w-full space-y-6 md:w-72">
      <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-zinc-900">Categories</h3>
        <div className="mt-4 space-y-2">
          <button
            onClick={() => onCategoryChange(null)}
            className={`block w-full rounded-2xl px-3 py-2 text-left text-sm transition ${
              !selectedCategory
                ? "bg-green-50 font-semibold text-green-700"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-green-600"
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`block w-full rounded-2xl px-3 py-2 text-left text-sm transition ${
                selectedCategory === cat.id
                  ? "bg-green-50 font-semibold text-green-700"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-green-600"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-zinc-900">Price Range</h3>
        <div className="mt-4 flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min Rs."
            value={minPrice}
            onChange={(e) => onPriceChange(e.target.value, maxPrice)}
            className="h-8 px-2 py-1 text-xs"
          />
          <span className="text-zinc-400">-</span>
          <Input
            type="number"
            placeholder="Max Rs."
            value={maxPrice}
            onChange={(e) => onPriceChange(minPrice, e.target.value)}
            className="h-8 px-2 py-1 text-xs"
          />
        </div>
      </div>
    </aside>
  );
}
