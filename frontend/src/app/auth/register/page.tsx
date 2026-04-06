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

const registerSchema = z.object({
  name: z.string().trim().min(1, "Full name is required"),
  shop_name: z.string().trim().min(1, "Shop name is required"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length === 10 || (digits.length === 12 && digits.startsWith("91"));
    }, "Enter a valid phone number"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    const phone = searchParams.get("phone");
    if (phone) {
      setValue("phone", phone);
    }
  }, [searchParams, setValue]);

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post("/auth/register", data);
      const { user, token } = response.data.data;
      setAuth(user, token);
      router.push(searchParams.get("redirect") || "/");
    } catch (err: unknown) {
      const errorResponse = err as AxiosError<{ error?: string }>;
      setError(errorResponse.response?.data?.error || "Registration failed. Please try again.");
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
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-400">Register</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-zinc-950">Create account</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Minimal signup flow to get your shop started quickly.
          </p>
        </div>

        <form className="mt-10 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Full Name</label>
            <input
              type="text"
              placeholder="Enter full name"
              autoComplete="name"
              {...register("name")}
              className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors duration-200 placeholder:text-zinc-400 focus:border-zinc-900"
            />
            {errors.name?.message && <p className="mt-2 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Shop Name</label>
            <input
              type="text"
              placeholder="Enter shop name"
              {...register("shop_name")}
              className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors duration-200 placeholder:text-zinc-400 focus:border-zinc-900"
            />
            {errors.shop_name?.message && <p className="mt-2 text-xs text-red-500">{errors.shop_name.message}</p>}
          </div>

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
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="mt-8 border-t border-zinc-100 pt-6 text-center text-sm text-zinc-500">
          Already registered?{" "}
          <Link href="/auth/login" className="font-medium text-zinc-950 transition-colors duration-200 hover:text-green-700">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
