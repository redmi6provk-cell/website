"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

type SuccessPopupProps = {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  title?: string;
};

export function SuccessPopup({
  isOpen,
  message,
  onClose,
  title = "Success",
}: SuccessPopupProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-[2rem] border border-emerald-100 bg-white p-6 text-center shadow-[0_28px_80px_rgba(15,23,42,0.22)] animate-in fade-in zoom-in duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Close success popup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h3 className="mt-4 text-xl font-black tracking-tight text-zinc-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{message}</p>
      </div>
    </div>
  );
}
