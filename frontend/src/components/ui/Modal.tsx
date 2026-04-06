"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const sizeClass = {
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  }[size];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className={`relative w-full ${sizeClass} scale-100 overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-2xl transition-all animate-in fade-in zoom-in duration-300`}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 uppercase">{title}</h2>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {children}
        </div>
      </div>
    </div>
  );
}
