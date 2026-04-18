"use client";

import Image from "next/image";

type PageLoaderProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function PageLoader({
  title = "Loading page...",
  subtitle = "Please wait while we prepare everything for you.",
  compact = false,
}: PageLoaderProps) {
  return (
    <div
      className={`flex w-full items-center justify-center px-6 ${
        compact ? "min-h-[320px] py-12" : "min-h-[70vh] py-16"
      }`}
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="rounded-[2rem] border border-zinc-200 bg-white px-8 py-7 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
          <Image
            src="/delivery-truck-loader.gif"
            alt="Loading"
            width={128}
            height={128}
            unoptimized
            className="mx-auto h-28 w-28 object-contain sm:h-32 sm:w-32"
          />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-zinc-700">
            {title}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
