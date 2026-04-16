"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardList,
  Shield,
  LayoutDashboard,
  Phone,
  ShoppingBag,
  ShoppingCart,
  User,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { isStaffRole } from "@/lib/roles";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.replace("/auth/login?redirect=/dashboard");
    }
  }, [isAuthenticated, isInitialized, router]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-zinc-50 px-4">
        <div className="rounded-3xl border border-zinc-200 bg-white px-6 py-4 text-sm font-medium text-zinc-600 shadow-sm">
          Loading your profile...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const quickLinks = [
    {
      href: "/products",
      label: "Browse products",
      description: "Explore grocery, snacks, beverages and daily essentials.",
      icon: ShoppingBag,
    },
    {
      href: "/cart",
      label: "Open cart",
      description: "Review selected items before moving to checkout.",
      icon: ShoppingCart,
    },
    {
      href: "/dashboard/orders",
      label: "Order history",
      description: "Jo orders aapne place kiye hain unka full record yahan dekho.",
      icon: ClipboardList,
    },
  ];
  const canOpenAdmin = isStaffRole(user.role);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_25px_80px_-40px_rgba(0,0,0,0.35)]">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-green-200 bg-green-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-green-700">
                My Dashboard
              </div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
                Welcome back, {user.name.split(" ")[0]}.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
                Yeh aapka profile space hai jahan se aap shopping flow continue kar sakte ho,
                cart dekh sakte ho, aur account details ek jagah par mil jayengi.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/products">
                  <Button className="rounded-full px-6">Continue Shopping</Button>
                </Link>
                <Link href="/cart">
                  <Button variant="outline" className="rounded-full px-6">
                    View Cart
                  </Button>
                </Link>
                <Button variant="ghost" className="rounded-full px-6 text-zinc-600 hover:bg-zinc-100" onClick={logout}>
                  Logout
                </Button>
              </div>

              {canOpenAdmin && (
                <Link
                  href="/admin"
                  className="mt-8 block rounded-[1.75rem] border border-zinc-900 bg-zinc-950 p-5 text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.8)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-300">
                        <Shield className="h-3.5 w-3.5" />
                        Staff Access
                      </div>
                      <h2 className="mt-4 text-2xl font-black tracking-tight">Go to Admin Panel</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">
                        Products, orders, settings aur operations tools yahin se manage karo.
                      </p>
                    </div>
                    <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-zinc-950">
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </div>
                </Link>
              )}
            </div>

            <div className="rounded-[1.75rem] bg-zinc-950 p-6 text-white shadow-inner">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <User className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <p className="mt-1 text-sm uppercase tracking-[0.2em] text-zinc-400">{user.role}</p>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    <ShoppingBag className="h-4 w-4" />
                    Shop
                  </div>
                  <p className="text-lg font-semibold">{user.shop_name}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    <Phone className="h-4 w-4" />
                    Phone
                  </div>
                  <p className="text-lg font-semibold">{user.phone}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    <LayoutDashboard className="h-4 w-4" />
                    Member Since
                  </div>
                  <p className="text-lg font-semibold">
                    {new Date(user.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-green-200 hover:shadow-xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-zinc-900">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-green-700">
                Open
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
