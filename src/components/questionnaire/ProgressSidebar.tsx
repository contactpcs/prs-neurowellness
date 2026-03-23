"use client";

import { cn } from "@/lib/utils/cn";
import { Check, Circle, CircleDot } from "lucide-react";
import type { Scale } from "@/types/prs.types";

interface ProgressSidebarProps {
  scales: Array<{ scale_id: string; short_name: string }>;
  currentIndex: number;
  completedScaleIds: Set<string>;
  responses: Record<string, Record<string, number | string>>;
  onNavigate: (index: number) => void;
}

export function ProgressSidebar({
  scales, currentIndex, completedScaleIds, responses, onNavigate,
}: ProgressSidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-neutral-200 p-4 overflow-y-auto">
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
        Scales ({completedScaleIds.size}/{scales.length})
      </h3>
      <div className="space-y-1">
        {scales.map((scale, idx) => {
          const isActive = idx === currentIndex;
          const isComplete = completedScaleIds.has(scale.scale_id);
          const hasResponses = Object.keys(responses[scale.scale_id] || {}).length > 0;

          return (
            <button
              key={scale.scale_id}
              onClick={() => onNavigate(idx)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                isActive && "bg-primary-50 text-primary-700 font-medium",
                !isActive && isComplete && "text-success-700",
                !isActive && !isComplete && "text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {isComplete ? (
                <Check className="h-4 w-4 text-success-500 flex-shrink-0" />
              ) : isActive ? (
                <CircleDot className="h-4 w-4 text-primary-500 flex-shrink-0" />
              ) : (
                <Circle className={cn("h-4 w-4 flex-shrink-0", hasResponses ? "text-warning-500" : "text-neutral-300")} />
              )}
              <span className="truncate">{scale.short_name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
