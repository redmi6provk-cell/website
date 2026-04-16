"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { AxiosError } from "axios";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

const loginSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length === 10 || (digits.length === 12 && digits.startsWith("91"));
    }, "Enter a valid phone number"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) {
      return;
    }

    router.replace(searchParams.get("redirect") || "/");
  }, [isAuthenticated, isInitialized, router, searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  if (isInitialized && isAuthenticated) {
    return null;
  }

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post("/auth/login", { phone: data.phone });
      const { user, token } = response.data.data;
      await setAuth(user, token);
      router.push(searchParams.get("redirect") || "/");
    } catch (err: unknown) {
      const errorResponse = err as AxiosError<{ error?: string }>;

      if (errorResponse.response?.status === 404) {
        const params = new URLSearchParams({ phone: data.phone });
        const redirect = searchParams.get("redirect");
        if (redirect) {
          params.set("redirect", redirect);
        }
        router.push(`/auth/register?${params.toString()}`);
        return;
      }

      setError(errorResponse.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center bg-white px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white p-8 sm:p-10">
        <div className="flex justify-center">
          <Link href="/" className="inline-flex items-center gap-3 text-zinc-950 transition-colors duration-200 hover:text-green-700">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-900 text-[11px] font-semibold tracking-[0.32em]">
              FM
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.24em]">FMCG Store</span>
          </Link>
        </div>

        <div className="mt-10 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-400">Login</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-zinc-950">Welcome back</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Simple sign in with your registered phone number.
          </p>
        </div>

        <form className="mt-10 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Phone Number</label>
            <input
              type="tel"
              placeholder="Enter mobile number"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              {...register("phone")}
              className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors duration-200 placeholder:text-zinc-400 focus:border-zinc-900"
            />
            {errors.phone?.message && <p className="mt-2 text-xs text-red-500">{errors.phone.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-zinc-950 text-sm font-medium text-white transition-colors duration-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="mt-8 border-t border-zinc-100 pt-6 text-center text-sm text-zinc-500">
          New here?{" "}
          <Link href="/auth/register" className="font-medium text-zinc-950 transition-colors duration-200 hover:text-green-700">
            Register account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
