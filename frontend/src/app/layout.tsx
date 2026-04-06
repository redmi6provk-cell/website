import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FMCG E-Commerce",
  description: "FMCG E-Commerce",
};

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CartToast from "@/components/layout/CartToast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <CartToast />
      </body>
    </html>
  );
}
