"use client";

import { SCALP_NODES } from "./scalpNodes";

/** Read-only-ish 10-20 scalp map. Electrodes are highlighted from whichever
 * library placement is currently selected. Clicking a node toggles a
 * scratch anode/cathode combination for rule-checking via
 * /neuromod/placements/validate — it does NOT create a savable montage:
 * the real backend has no endpoint to persist a new placement row, only to
 * validate one against the device's electrode rule. Continuing past this
 * step still requires picking a real placement_id from the library. */
export function PlacementMap({
  anodeSite,
  cathodeSites,
  suggestedAnode,
  suggestedCathodes,
  onNodeClick,
  interactive,
}: {
  anodeSite: string | null;
  cathodeSites: string[];
  suggestedAnode?: string | null;
  suggestedCathodes?: string[];
  onNodeClick?: (nodeId: string) => void;
  interactive: boolean;
}) {
  return (
    <div className="relative w-full" style={{ paddingTop: "96%" }}>
      <div className="absolute inset-0">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <circle cx="50" cy="50" r="46" fill="#F7F9FC" stroke="#d4d4d4" strokeWidth="0.6" />
          <path d="M 44 5.5 Q 50 -1 56 5.5" fill="none" stroke="#d4d4d4" strokeWidth="0.6" />
          <path d="M 4.5 43 Q -1 50 4.5 57" fill="none" stroke="#d4d4d4" strokeWidth="0.6" />
          <path d="M 95.5 43 Q 101 50 95.5 57" fill="none" stroke="#d4d4d4" strokeWidth="0.6" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#e5e5e5" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="50" y1="4" x2="50" y2="96" stroke="#e5e5e5" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="4" y1="50" x2="96" y2="50" stroke="#e5e5e5" strokeWidth="0.5" strokeDasharray="2 2" />
        </svg>
        {SCALP_NODES.map(([nodeId, x, y]) => {
          const isAnode = anodeSite === nodeId;
          const isCathode = cathodeSites.includes(nodeId);
          const isSuggested = suggestedAnode === nodeId || (suggestedCathodes || []).includes(nodeId);
          return (
            <div
              key={nodeId}
              onClick={() => interactive && onNodeClick?.(nodeId)}
              title={nodeId}
              className="absolute flex items-center justify-center rounded-full text-[9.5px] font-bold select-none"
              style={{
                left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)",
                width: 28, height: 28,
                cursor: interactive ? "pointer" : "default",
                background: isAnode ? "#ef4444" : isCathode ? "#171717" : isSuggested ? "#dbeafe" : "#fff",
                border: `1px solid ${isAnode ? "#b91c1c" : isCathode ? "#171717" : isSuggested ? "#93c5fd" : "#e5e5e5"}`,
                color: isAnode || isCathode ? "#fff" : isSuggested ? "#1d4ed8" : "#737373",
                boxShadow: isAnode ? "0 0 0 4px rgb(239 68 68 / .14)" : isCathode ? "0 0 0 4px rgb(23 23 23 / .14)" : "none",
                transition: "all 120ms ease-out",
              }}
            >
              {nodeId}
            </div>
          );
        })}
      </div>
      <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[10px] text-neutral-400 px-1">
        <span>Nasion ↑</span>
        <span>Inion ↓</span>
      </div>
    </div>
  );
}
