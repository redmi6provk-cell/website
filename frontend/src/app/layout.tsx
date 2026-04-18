import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FMCG E-Commerce",
  description: "FMCG E-Commerce",
};
import AppFrame from "@/components/layout/AppFrame";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
