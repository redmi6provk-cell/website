"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { canAccessAdmin } from "@/lib/roles";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Upload, FileText, CheckCircle2, AlertCircle, ChevronLeft } from "lucide-react";

export default function AdminUploadPage() {
  const router = useRouter();
  const { user, isAuthenticated, checkAuth } = useAuthStore();
  
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string; errors?: string[] } | null>(null);

  useEffect(() => {
    checkAuth();
    if (!isAuthenticated || (user && !canAccessAdmin(user.role))) {
      router.push("/");
    }
  }, [isAuthenticated, user, router, checkAuth]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    setStatus(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/admin/products/csv", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.errors && response.data.errors.length > 0) {
        setStatus({
          type: "error",
          message: "CSV processed with some errors.",
          errors: response.data.errors,
        });
      } else {
        setStatus({
          type: "success",
          message: "Bulk upload successful! All products added/updated.",
        });
        setFile(null);
      }
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.response?.data?.error || "Failed to upload CSV. Please ensure the format is correct.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" onClick={() => router.back()} leftIcon={ChevronLeft} className="mb-8">
           Admin Dashboard
        </Button>

        <div className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm lg:p-12">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-600">
               <Upload className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Bulk Product Upload</h1>
            <p className="mt-2 text-zinc-500 text-sm">Upload a CSV file to add or update multiple products at once.</p>
          </div>

          <div className="space-y-8">
            {/* CSV Format Info */}
            <div className="rounded-2xl bg-zinc-50 p-6 border border-zinc-100">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-4 w-4 text-zinc-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">Required CSV Format</h3>
                </div>
                <p className="text-xs text-zinc-500 mb-4">Your CSV should include the following headers in order shown:</p>
                <div className="overflow-x-auto text-[10px] font-mono bg-white p-3 rounded-lg border border-zinc-100 shadow-inner">
                    name, description, category, brand, price, discount, stock, unit, image_url
                </div>
                <ul className="mt-4 space-y-1 text-xs text-zinc-500 list-disc list-inside">
                    <li>Price and stock must be numbers.</li>
                    <li>Discount is optional (default 0).</li>
                    <li>Image URL should be a valid web link.</li>
                </ul>
            </div>

            {/* Upload Area */}
            <div className={`relative rounded-3xl border-2 border-dashed p-10 text-center transition-colors ${
              file ? "border-green-600 bg-green-50/20" : "border-zinc-200 hover:border-zinc-300"
            }`}>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className="flex flex-col items-center">
                <FileText className={`h-12 w-12 mb-4 ${file ? "text-green-600" : "text-zinc-300"}`} />
                {file ? (
                   <div className="space-y-1">
                      <p className="text-sm font-bold text-zinc-900">{file.name}</p>
                      <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(2)} KB</p>
                   </div>
                ) : (
                   <div>
                      <p className="text-sm font-bold text-zinc-900">Click to upload or drag and drop</p>
                      <p className="text-xs text-zinc-500 mt-1">CSV files only (max. 10MB)</p>
                   </div>
                )}
              </div>
            </div>

            {/* Status Messages */}
            {status && (
              <div className={`rounded-2xl p-4 flex gap-4 border ${
                status.type === "success" ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-700"
              }`}>
                {status.type === "success" ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                <div className="space-y-2">
                   <p className="text-sm font-bold">{status.message}</p>
                   {status.errors && status.errors.length > 0 && (
                      <ul className="text-xs list-disc list-inside space-y-1 opacity-80 max-h-40 overflow-y-auto">
                         {status.errors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                   )}
                </div>
              </div>
            )}

            <Button
              className="w-full h-12 rounded-2xl"
              onClick={handleUpload}
              disabled={!file || isLoading}
              isLoading={isLoading}
              leftIcon={Upload}
            >
              Start Upload
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
