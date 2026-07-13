"use client";

import { cn } from "@/lib/utils/cn";
import { Brain } from "lucide-react";
import type { ConditionBattery } from "@/types/prs.types";

interface ConditionSelectorProps {
  conditions: ConditionBattery[];
  selectedId: string | null;
  onSelect: (conditionId: string) => void;
}

export function ConditionSelector({ conditions, selectedId, onSelect }: ConditionSelectorProps) {
  return (
    <div className="w-full grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {conditions.map((cond) => {
        const isSelected = selectedId === cond.condition_id;
        return (
          <button
            key={cond.condition_id}
            onClick={() => onSelect(cond.condition_id)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all",
              isSelected
                ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200 shadow-sm"
                : "border-neutral-200 hover:border-primary-300 hover:bg-neutral-50"
            )}
          >
            <Brain className={cn("h-7 w-7", isSelected ? "text-primary-500" : "text-neutral-400")} />
            <span className={cn("text-sm font-medium leading-tight", isSelected ? "text-primary-900" : "text-neutral-700")}>
              {cond.label}
            </span>
            <span className="text-xs text-neutral-500">{cond.scale_ids.length} scales</span>
          </button>
        );
      })}
    </div>
  );
}
