"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { canAccessERP } from "@/lib/roles";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ADMIN_PANEL_SESSION_KEY = "admin-panel-unlocked";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsUnlocked(sessionStorage.getItem(ADMIN_PANEL_SESSION_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!isAuthenticated || (user && !canAccessERP(user.role))) {
      router.replace("/");
      return;
    }

    if (pathname === "/admin" && user && canAccessERP(user.role)) {
      return;
    }
  }, [isInitialized, isAuthenticated, user, router, pathname]);

  const canEnterAdminArea = useMemo(() => canAccessERP(user?.role), [user?.role]);

  const handleVerifyPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsVerifying(true);
    setErrorMessage("");

    try {
      await api.post("/admin/panel-access/verify", { password });
      sessionStorage.setItem(ADMIN_PANEL_SESSION_KEY, "true");
      setIsUnlocked(true);
      setPassword("");
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || "Admin panel password verify nahi hua");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isInitialized) {
    return <div className="p-12 text-center">Checking admin access...</div>;
  }

  if (!isAuthenticated || !canEnterAdminArea) {
    return null;
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.1),_transparent_30%),linear-gradient(180deg,_#fafaf9_0%,_#f8fafc_100%)] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.4)] sm:p-10">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Extra Security</p>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Admin Panel Password</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Admin area kholne ke liye shared panel password dalo. Ye gate sab `/admin` pages par apply hoga.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleVerifyPassword}>
              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Panel Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter admin panel password"
                    className="h-14 rounded-2xl border-zinc-200 pl-11"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {errorMessage ? <p className="text-sm font-medium text-red-600">{errorMessage}</p> : null}

              <Button type="submit" className="h-14 w-full rounded-2xl text-base font-semibold" disabled={isVerifying}>
                {isVerifying ? "Checking..." : "Unlock Admin Panel"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
