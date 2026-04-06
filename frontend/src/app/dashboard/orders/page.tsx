"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, PackageCheck, ShoppingBag } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Order } from "@/types";

export default function DashboardOrdersPage() {
  const router = useRouter();
  const { isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.replace("/auth/login?redirect=/dashboard/orders");
      return;
    }

    const fetchOrders = async () => {
      try {
        const res = await api.get("/orders");
        setOrders(res.data.data || []);
      } catch (error) {
        console.error("Failed to fetch orders");
      } finally {
        setLoading(false);
      }
    };

    if (isInitialized && isAuthenticated) {
      fetchOrders();
    }
  }, [isInitialized, isAuthenticated, router]);

  if (!isInitialized || loading) {
    return <div className="p-12 text-center">Loading your orders...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">My Orders</h1>
            <p className="text-zinc-500">Aapke sab placed orders aur unke items yahan dikhte hain.</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-zinc-200 bg-white p-16 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-zinc-300" />
            <h2 className="mt-4 text-2xl font-bold text-zinc-900">No orders yet</h2>
            <p className="mt-2 text-zinc-500">Abhi tak aapne koi order place nahi kiya.</p>
            <Link href="/products" className="mt-6 inline-block">
              <Button className="rounded-full px-6">Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Order ID</p>
                    <p className="mt-1 font-semibold text-zinc-900">{order.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Placed On</p>
                    <p className="mt-1 font-semibold text-zinc-900">
                      {new Date(order.created_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Status</p>
                    <div className="mt-1 inline-flex rounded-full bg-green-50 px-3 py-1 text-sm font-semibold capitalize text-green-700">
                      {order.status}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Total</p>
                    <p className="mt-1 text-lg font-bold text-zinc-900">Rs. {order.total}</p>
                  </div>
                </div>

                <div className="px-6 py-6">
                  <div className="mb-5 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Delivery Address</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{order.address}</p>
                  </div>

                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
                            <PackageCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900">{item.product?.name || "Product"}</p>
                            <p className="text-sm text-zinc-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="font-bold text-zinc-900">Rs. {item.price * item.quantity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
