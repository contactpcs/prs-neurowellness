"use client";

import { cn } from "@/lib/utils/cn";
import type { QuestionOption } from "@/types/prs.types";

interface LikertInputProps {
  options: QuestionOption[];
  value: number | undefined;
  onChange: (val: number) => void;
  readOnly?: boolean;
}

export function LikertInput({ options, value, onChange, readOnly }: LikertInputProps) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => !readOnly && onChange(opt.value)}
            disabled={readOnly}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-lg border text-left transition-all",
              isSelected
                ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200"
                : "border-neutral-200 hover:border-primary-300 hover:bg-neutral-50",
              readOnly && "cursor-default opacity-75"
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
              isSelected ? "border-primary-500" : "border-neutral-300"
            )}>
              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
            </div>
            <div className="flex-1">
              <span className={cn(
                "text-sm",
                isSelected ? "text-primary-900 font-medium" : "text-neutral-700"
              )}>
                {opt.label}
              </span>
            </div>
            <span className="text-xs text-neutral-400 flex-shrink-0">({opt.value})</span>
          </button>
        );
      })}
    </div>
  );
}
