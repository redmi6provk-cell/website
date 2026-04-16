"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin, canAccessERP } from "@/lib/roles";
import api from "@/lib/api";
import { ListOrdered, UploadCloud, Users, Settings, Package, ArrowUpRight, Layers, Tag, BarChart3, Receipt, WalletCards, Landmark } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  
  const [stats, setStats] = useState({ products: 0, orders: 0, users: 0 });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isInitialized && (!isAuthenticated || (user && !canAccessAdmin(user.role) && !canAccessERP(user.role)))) {
      router.push("/");
    }
  }, [isInitialized, isAuthenticated, user, router]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let products = 0;
        let orders = 0;

        if (canAccessAdmin(user?.role)) {
          const [pRes, oRes] = await Promise.all([
            api.get("/admin/products"),
            api.get("/admin/orders"),
          ]);
          products = pRes.data.data?.total || 0;
          orders = oRes.data.data?.length || 0;
        }

        setStats({
          products,
          orders,
          users: 0
        });
      } catch (error) {
        console.error("Failed to fetch admin stats");
      }
    };

    if (isInitialized && isAuthenticated && user && (canAccessAdmin(user.role) || canAccessERP(user.role))) {
      fetchStats();
    }
  }, [isInitialized, isAuthenticated, user]);

  const menuItems = [
    { title: "Manage Products", icon: Package, link: "/admin/products", color: "bg-blue-50 text-blue-600", count: stats.products },
    { title: "Manage Orders", icon: ListOrdered, link: "/admin/orders", color: "bg-orange-50 text-orange-600", count: stats.orders },
    { title: "ERP Dashboard", icon: BarChart3, link: "/admin/arp", color: "bg-indigo-50 text-indigo-600" },
    { title: "Manage Parties", icon: Users, link: "/admin/parties", color: "bg-pink-50 text-pink-600" },
    { title: "Manage Categories", icon: Layers, link: "/admin/categories", color: "bg-orange-50 text-orange-600" },
    { title: "Manage Brands", icon: Tag, link: "/admin/brands", color: "bg-blue-50 text-blue-600" },
    { title: "Bulk CSV Upload", icon: UploadCloud, link: "/admin/upload", color: "bg-green-50 text-green-600" },
    { title: "Store Settings", icon: Settings, link: "/admin/settings", color: "bg-zinc-50 text-zinc-600" },
    { title: "Products Summary", icon: Receipt, link: "/admin/products-summary", color: "bg-amber-50 text-amber-600" },
    { title: "Add Purchase", icon: WalletCards, link: "/admin/purchases", color: "bg-emerald-50 text-emerald-600" },
    { title: "OFFLINE Sale", icon: Receipt, link: "/admin/offline-sell", color: "bg-yellow-50 text-yellow-700" },
  ].filter((item) => {
    if (item.link === "/admin/arp" || item.link === "/admin/parties") {
      return canAccessERP(user?.role);
    }
    return canAccessAdmin(user?.role);
  });

  const upcomingCards = [
    {
      title: "Add Expenses",
      icon: Landmark,
      color: "bg-rose-50 text-rose-600",
      description: "Daily expense tracking aur payment outflow yahan manage hoga.",
      link: "/admin/expenses",
    },
  ].filter(() => canAccessAdmin(user?.role));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),_transparent_28%),linear-gradient(180deg,_#fafaf9_0%,_#f8fafc_100%)] py-10 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 overflow-hidden rounded-[2rem] border border-zinc-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-green-700">
                Store Control Center
              </div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">Admin Dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-zinc-500 sm:text-base">
                Welcome back, {user?.name}. Products, orders, ERP aur operations ke saare important modules yahin se access karo.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
           {menuItems.map((item) => (
               <Link 
                key={item.title} 
                href={item.link}
                className="group relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[2rem] border border-zinc-200/70 bg-white p-6 shadow-[0_16px_45px_-36px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_24px_55px_-34px_rgba(15,23,42,0.4)] sm:p-7"
               >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent transition-all duration-300 group-hover:via-green-300" />
                  <div className="flex items-center justify-between">
                    <div className={`rounded-[1.35rem] p-4 ${item.color}`}>
                       <item.icon className="h-6 w-6" />
                    </div>
                    <div className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-300 transition-all group-hover:border-green-200 group-hover:text-green-600">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-10">
                    <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Admin Module</div>
                    <h3 className="text-[1.45rem] font-black tracking-tight text-zinc-900">{item.title}</h3>
                    {item.count !== undefined && (
                        <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                          {item.title === "Manage Orders"
                            ? `${item.count} orders available to review`
                            : `${item.count} items currently in catalog`}
                        </p>
                    )}
                    {item.count === undefined && (
                      <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                        Open module and manage linked store operations.
                      </p>
                    )}
                  </div>
               </Link>
           ))}

           {upcomingCards.map((item) => {
             const cardContent = (
               <div
                key={item.title}
                className="group relative flex min-h-[240px] h-full flex-col justify-between overflow-hidden rounded-[2rem] border border-zinc-200/70 bg-white p-6 shadow-[0_16px_45px_-36px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_24px_55px_-34px_rgba(15,23,42,0.4)] sm:p-7"
               >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent transition-all duration-300 group-hover:via-rose-200" />
                  <div className="flex items-center justify-between">
                    <div className={`rounded-[1.35rem] p-4 ${item.color}`}>
                       <item.icon className="h-6 w-6" />
                    </div>
                   
                  </div>
                  <div className="mt-10">
                    <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Admin Module</div>
                    <h3 className="text-[1.45rem] font-black tracking-tight text-zinc-900">{item.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">{item.description}</p>
                  </div>
               </div>
             );

             if (item.link) {
               return (
                 <Link key={item.title} href={item.link}>
                   {cardContent}
                 </Link>
               );
             }

             return cardContent;
           })}
        </div>
      </div>
    </div>
  );
}
