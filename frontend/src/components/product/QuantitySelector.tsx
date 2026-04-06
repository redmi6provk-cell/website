"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

interface QuantitySelectorProps {
  quantity: number;
  min?: number;
  max: number;
  onChange: (quantity: number) => void;
  size?: "sm" | "md";
}

function clampQuantity(quantity: number, min: number, max: number) {
  const safeMax = Math.max(min, max);
  return Math.min(Math.max(quantity, min), safeMax);
}

export function QuantitySelector({
  quantity,
  min = 1,
  max,
  onChange,
  size = "md",
}: QuantitySelectorProps) {
  const [draftValue, setDraftValue] = useState(String(quantity));

  useEffect(() => {
    setDraftValue(String(quantity));
  }, [quantity]);

  const commitValue = (nextValue: string) => {
    const parsed = Number.parseInt(nextValue, 10);
    const nextQuantity = Number.isNaN(parsed) ? quantity : clampQuantity(parsed, min, max);
    setDraftValue(String(nextQuantity));
    if (nextQuantity !== quantity) {
      onChange(nextQuantity);
    }
  };

  const wrapperClass = size === "sm" ? "rounded-lg p-0.5" : "rounded-xl p-1";
  const buttonSizeClass = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const inputWidthClass = size === "sm" ? "w-10 text-sm" : "w-20 text-base";

  return (
    <div className={`inline-flex items-center border border-zinc-200 bg-white ${wrapperClass}`}>
      <button
        type="button"
        onClick={() => commitValue(String(quantity - 1))}
        className={`flex ${buttonSizeClass} items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={quantity <= min}
      >
        <Minus className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={Math.max(min, max)}
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={(event) => commitValue(event.target.value)}
        onFocus={(event) => event.target.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitValue(draftValue);
            event.currentTarget.blur();
          }
        }}
        className={`${inputWidthClass} appearance-none border-0 bg-transparent px-0 text-center font-bold text-zinc-900 outline-none [MozAppearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />

      <button
        type="button"
        onClick={() => commitValue(String(quantity + 1))}
        className={`flex ${buttonSizeClass} items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={quantity >= Math.max(min, max)}
      >
        <Plus className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      </button>
    </div>
  );
}
