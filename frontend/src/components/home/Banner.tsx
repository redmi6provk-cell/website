"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    id: 1,
    title: "Daily essentials with a calmer shopping flow",
    subtitle: "Groceries, household staples, and repeat buys arranged for quick scanning and faster ordering.",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1074",
    accent: "Fresh stock"
  },
  {
    id: 2,
    title: "Snacks, drinks, and pantry picks in one clear catalog",
    subtitle: "Browse fast-moving products without visual clutter and move from discovery to cart in fewer steps.",
    image: "/images/vibrant-fmcg-products-on-display.webp",
    accent: "Popular picks"
  },
  {
    id: 3,
    title: "Personal care and home care, kept simple",
    subtitle: "A focused storefront for recurring household purchases, with pricing and availability kept easy to read.",
    image: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&q=80&w=1000",
    accent: "Everyday use"
  }
];

export default function Banner() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const next = () => setCurrent((prev) => (prev + 1) % slides.length);
  const prev = () => setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1));

  return (
    <section className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-center">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              {slides[current].accent}
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl lg:text-6xl">
              {slides[current].title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
              {slides[current].subtitle}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition-colors duration-200 hover:bg-zinc-800"
              >
                Shop Products
              </Link>
              <Link
                href="/about"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 px-6 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-zinc-900"
              >
                About Store
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-5">
              <div className="flex items-center gap-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setCurrent(index)}
                    aria-label={`Go to slide ${index + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === current ? "w-8 bg-zinc-950" : "w-2 bg-zinc-300 hover:bg-zinc-500"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={prev}
                  aria-label="Previous slide"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={next}
                  aria-label="Next slide"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-zinc-200 bg-zinc-100">
              <Image
                src={slides[current].image}
                alt={slides[current].title}
                fill
                className="object-cover transition-opacity duration-700"
                priority
              />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              <span>Minimal catalog experience</span>
              <span>{String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
