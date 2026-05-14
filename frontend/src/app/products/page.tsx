"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Category, Product } from "@/types";
import api from "@/lib/api";
import ProductCard from "@/components/product/ProductCard";
import FilterSidebar from "@/components/product/FilterSidebar";
import { ChevronLeft, ChevronRight, Layers, Search as SearchIcon, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { resolveAssetUrl } from "@/lib/images";
import { Input } from "@/components/ui/Input";

const PRODUCTS_PER_PAGE = 10;

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const category = searchParams.get("category");
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const sort = searchParams.get("sort") || "stock_desc";
  const search = searchParams.get("search") || "";
  const view = searchParams.get("view") || "";
  const showCategoriesOnly = view === "categories";

  useEffect(() => {
    const fetchCategories = async () => {
      setIsCategoriesLoading(true);
      try {
        const response = await api.get("/categories");
        setCategories(response.data?.data || []);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
        setCategories([]);
      } finally {
        setIsCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (category) queryParams.set("category", category);
        if (minPrice) queryParams.set("minPrice", minPrice);
        if (maxPrice) queryParams.set("maxPrice", maxPrice);
        if (sort) queryParams.set("sort", sort);
        if (search) queryParams.set("search", search);
        queryParams.set("page", page.toString());
        queryParams.set("limit", search ? "100" : PRODUCTS_PER_PAGE.toString());

        const response = await api.get(`/products?${queryParams.toString()}`);
        const payload = response.data?.data;
        setProducts(payload?.items || []);
        setTotal(payload?.total || 0);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        setProducts([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [category, minPrice, maxPrice, sort, search, page]);

  const selectedCategoryName = categories.find((item) => item.id === category)?.name;

  const normalizedSearch = search.trim().toLowerCase();

  const visibleProducts = useMemo(() => {
    if (!normalizedSearch) {
      return products;
    }

    return products.filter((product) => {
      const searchableText = [
        product.name,
        product.description,
        product.brand_info?.name,
        product.category_info?.name,
        product.unit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [normalizedSearch, products]);

  const updateFilters = (newFilters: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    params.set("page", "1");
    router.push(`/products?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/products?${params.toString()}`);
  };

  const handleSearchChange = (value: string) => {
    const trimmedValue = value.trim();
    const nextSearch = trimmedValue || null;
    updateFilters({ search: nextSearch });
  };

  const totalPages = Math.ceil(total / PRODUCTS_PER_PAGE);
  const sortLabel =
    sort === "stock_desc"
      ? "Stock: High to Low"
      : sort === "stock_asc"
        ? "Stock: Low to High"
        : sort === "price_asc"
          ? "Price: Low to High"
          : sort === "price_desc"
            ? "Price: High to Low"
            : sort === "discount_desc"
              ? "Highest Discount"
              : "Latest";
  const categoryCountLabel = isCategoriesLoading ? "Loading categories..." : `${categories.length} categories available`;

  return (
    <div className="min-h-screen bg-white py-8 md:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-6 border-b border-zinc-100 pb-8 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200/60 bg-zinc-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              <Sparkles className="h-3 w-3" />
              Catalogue
            </div>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl md:text-5xl">
              {selectedCategoryName
                ? selectedCategoryName
                : search
                  ? `Search: "${search}"`
                  : "All Products"}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-500 md:text-base">
              {search
                ? "Here are the matching results for your search. Use filters to narrow them down."
                : selectedCategoryName
                ? `Explore everything we have in the ${selectedCategoryName} category.`
                : "Browse our entire collection. Use the sidebar filters to find exactly what you need."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-8 md:pb-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Items</div>
              <div className="mt-1 text-2xl font-black text-zinc-900">{search ? visibleProducts.length : total}</div>
            </div>
            {showCategoriesOnly ? (
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Categories</div>
                <div className="mt-1 text-2xl font-black text-zinc-900">{categories.length}</div>
              </div>
            ) : (minPrice || maxPrice) ? (
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Price Range</div>
                <div className="mt-1 text-lg font-bold text-zinc-900">
                  {`Rs. ${minPrice || "0"} - ${maxPrice || "Any"}`}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          {!showCategoriesOnly && (
            <div className="hidden md:block">
              <FilterSidebar
                categories={categories}
                selectedCategory={category}
                onCategoryChange={(cat) => updateFilters({ category: cat })}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onPriceChange={(min, max) => updateFilters({ minPrice: min || null, maxPrice: max || null })}
              />
            </div>
          )}

          {!showCategoriesOnly && (
            <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm shadow-sm md:hidden">
              <div>
                <div className="font-semibold text-zinc-900">{selectedCategoryName || "All products"}</div>
                <div className="text-xs text-zinc-500">{total} products found</div>
              </div>
              <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {sortLabel}
              </div>
            </div>
          )}

          {!showCategoriesOnly && isSidebarOpen && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden">
              <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl">
                <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-4">
                  <h2 className="text-lg font-bold text-zinc-900">Filters</h2>
                  <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)}>
                    Close
                  </Button>
                </div>
                <FilterSidebar
                  categories={categories}
                  selectedCategory={category}
                  onCategoryChange={(cat) => {
                    updateFilters({ category: cat });
                    setIsSidebarOpen(false);
                  }}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  onPriceChange={(min, max) => updateFilters({ minPrice: min || null, maxPrice: max || null })}
                />
              </div>
            </div>
          )}

          {!showCategoriesOnly && isSortOpen && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm md:hidden">
              <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-white p-5 shadow-2xl">
                <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-4">
                  <h2 className="text-lg font-bold text-zinc-900">Sort Products</h2>
                  <Button variant="ghost" size="sm" onClick={() => setIsSortOpen(false)}>
                    Close
                  </Button>
                </div>
                <div className="space-y-3">
                  {[
                    { value: "stock_desc", label: "Stock: High to Low" },
                    { value: "stock_asc", label: "Stock: Low to High" },
                    { value: "newest", label: "Latest" },
                    { value: "price_asc", label: "Price: Low to High" },
                    { value: "price_desc", label: "Price: High to Low" },
                    { value: "discount_desc", label: "Highest Discount" },
                  ].map((option) => (
                    <button
                      key={option.value || "latest"}
                      onClick={() => {
                        updateFilters({ sort: option.value });
                        setIsSortOpen(false);
                      }}
                      className={`block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                        sort === option.value || (!sort && option.value === "")
                          ? "bg-green-50 text-green-700"
                          : "bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 pb-36 md:pb-0">
            {!showCategoriesOnly && (
              <div className="mb-6 hidden items-center justify-between gap-4 md:flex">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-zinc-900">{selectedCategoryName || "All Products"}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {isCategoriesLoading
                      ? "Loading categories..."
                      : `${search ? visibleProducts.length : total} products found${search ? ` for "${search}"` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-72">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      type="search"
                      value={search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search by product, brand..."
                      className="h-11 rounded-full border-zinc-200 bg-white pl-10 pr-4 shadow-sm focus-visible:ring-green-500"
                    />
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => updateFilters({ sort: e.target.value })}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="stock_desc">Stock: High to Low</option>
                    <option value="stock_asc">Stock: Low to High</option>
                    <option value="newest">Sort by: Latest</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="discount_desc">Highest Discount</option>
                  </select>
                </div>
              </div>
            )}

            {showCategoriesOnly ? (
              <div className="rounded-[32px] border border-zinc-100 bg-white p-4 shadow-sm sm:p-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">All Categories</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Har category par tap karke uske products dekh sakte ho.
                  </p>
                </div>
                {isCategoriesLoading ? (
                  <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-40 animate-pulse rounded-[28px] bg-zinc-100" />
                    ))}
                  </div>
                ) : categories.length > 0 ? (
                  <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {categories.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => router.push(`/products?category=${item.id}`)}
                        className="group flex flex-col items-center rounded-[28px] border border-zinc-100 bg-zinc-50/70 px-4 py-5 text-center transition hover:border-green-100 hover:bg-green-50"
                      >
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-sm">
                          {item.image_url ? (
                            <img
                              src={resolveAssetUrl(item.image_url)}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Layers className="h-8 w-8 text-zinc-400" />
                          )}
                        </div>
                        <div className="mt-4 text-sm font-bold uppercase tracking-wide text-zinc-900">
                          {item.name}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col items-center justify-center rounded-[28px] bg-zinc-50/50 py-16 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white border border-zinc-100 shadow-sm transition-transform duration-500 hover:scale-105">
                      <Layers className="h-8 w-8 text-zinc-300" strokeWidth={1.2} />
                    </div>
                    <h3 className="text-lg font-black tracking-tight text-zinc-900">No categories found</h3>
                    <p className="mt-2 text-sm text-zinc-500">Categories abhi available nahi hain.</p>
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-[28px] bg-zinc-100"></div>
                ))}
              </div>
            ) : visibleProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                  {visibleProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {!search && totalPages > 1 && (
                  <div className="mt-12 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => handlePageChange(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-medium">
                      Page {page} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => handlePageChange(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[32px] bg-white px-4 text-center">
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-[2.5rem] bg-zinc-50 border border-zinc-100 transition-transform duration-500 hover:scale-105">
                    <SearchIcon className="h-10 w-10 text-zinc-300" strokeWidth={1.2} />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
                    {search ? `No products found for "${search}"` : "No products match your filters"}
                  </h2>
                  <p className="mt-4 text-sm leading-loose text-zinc-500">
                    {search
                      ? "Spelling change karke dekho, ya broader search try karo. Category aur price filters bhi clear kar sakte ho."
                      : "Category ya price range thoda reset karke dekho, ya phir sabhi products par wapas aa jao."}
                  </p>
                  <button
                    onClick={() => router.push("/products")}
                    className="group mt-8 inline-flex items-center rounded-full bg-zinc-950 px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:-translate-y-1 hover:bg-zinc-800 hover:shadow-xl hover:shadow-zinc-900/20"
                  >
                    {search ? "Clear search and filters" : "Clear all filters"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!showCategoriesOnly && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_-20px_rgba(0,0,0,0.45)] backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-12 rounded-2xl"
              onClick={() => setIsSidebarOpen(true)}
              leftIcon={SlidersHorizontal}
            >
              Filters
            </Button>
            <Button
              variant="secondary"
              className="h-12 rounded-2xl"
              onClick={() => setIsSortOpen(true)}
            >
              Sort By
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageContent />
    </Suspense>
  );
}
