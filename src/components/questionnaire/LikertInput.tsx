"use client";

import { cn } from "@/lib/utils/cn";
import type { QuestionOption } from "@/types/prs.types";

interface LikertInputProps {
  options: QuestionOption[];
  value: number | undefined;
  onChange: (val: number) => void;
  readOnly?: boolean;
}

const GRID_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
};

export function LikertInput({ options, value, onChange, readOnly }: LikertInputProps) {
  const useHorizontal = options.length >= 2 && options.length <= 5;

  if (useHorizontal) {
    const gridClass = GRID_COLS[options.length] ?? "sm:grid-cols-5";
    return (
      // Mobile: 1 col (full-width rows). sm+: horizontal grid.
      <div className={cn("grid grid-cols-1 gap-2", gridClass)}>
        {options.map((opt, i) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => !readOnly && onChange(opt.value)}
              disabled={readOnly}
              className={cn(
                // Mobile: horizontal row layout. sm+: vertical card layout.
                "flex sm:flex-col items-center sm:justify-between gap-3 sm:gap-1.5",
                "p-3 rounded-lg border-2 text-left sm:text-center transition-all sm:min-h-[72px]",
                isSelected
                  ? "border-orange-500 bg-orange-50"
                  : "border-neutral-200 bg-white hover:border-orange-300 hover:bg-orange-50/40",
                readOnly && "cursor-default opacity-75",
              )}
            >
              <span
                className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 sm:hidden",
                  isSelected ? "border-orange-500 bg-orange-500 text-white text-xs font-bold" : "border-neutral-300 text-neutral-500 text-xs font-bold",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "text-xs leading-snug flex-1 sm:flex sm:items-center sm:justify-center sm:text-center",
                  isSelected ? "text-orange-900 font-medium" : "text-neutral-700",
                )}
              >
                {opt.label}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold hidden sm:block",
                  isSelected ? "text-orange-500" : "text-neutral-400",
                )}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Vertical list for 6+ options
  return (
    <div className="space-y-2">
      {options.map((opt, i) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => !readOnly && onChange(opt.value)}
            disabled={readOnly}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all",
              isSelected
                ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                : "border-neutral-200 hover:border-orange-300 hover:bg-neutral-50",
              readOnly && "cursor-default opacity-75",
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                isSelected ? "border-orange-500" : "border-neutral-300",
              )}
            >
              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
            </div>
            <span
              className={cn(
                "text-sm flex-1",
                isSelected ? "text-orange-900 font-medium" : "text-neutral-700",
              )}
            >
              {opt.label}
            </span>
            <span className="text-xs text-neutral-400 flex-shrink-0">({i + 1})</span>
          </button>
        );
      })}
    </div>
  );
}
