"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Banner from "@/components/home/Banner";
import CategoryGrid from "@/components/home/CategoryGrid";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import { useAuthStore } from "@/store/authStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isInitialized, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, isInitialized, router]);

  if (!isInitialized || !isAuthenticated) {
    return <div className="min-h-[60vh] bg-white" />;
  }

  return (
    <div className="bg-white">
      <Banner />
      <CategoryGrid />

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="mb-8 flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">Selected Picks</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-zinc-950 sm:text-3xl">Featured products</h2>
            </div>
            <Link href="/products" className="text-sm font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-950">
              View catalog
            </Link>
          </div>

          <FeaturedProducts />
        </div>
      </section>
    </div>
  );
}
