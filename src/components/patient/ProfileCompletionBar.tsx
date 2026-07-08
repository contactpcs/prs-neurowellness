"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks";
import { computeProfileCompletion } from "@/lib/profileCompletion";

const BRAND = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";

export function ProfileCompletionBar() {
  const { user } = useAuth();
  if (!user) return null;
  const { percent, items } = computeProfileCompletion(user);
  if (percent >= 100) return null;

  const missing = items.filter((i) => !i.done);

  return (
    <Link
      href="/patient/profile"
      className="block mb-4 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 hover:bg-sky-50 transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-semibold text-neutral-800">Complete your profile</p>
        <span className="text-sm font-bold" style={{ color: "#00A1E4" }}>{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-sky-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: BRAND }} />
      </div>
      {missing.length > 0 && (
        <p className="text-xs text-neutral-500 mt-1.5">
          Missing: {missing.slice(0, 3).map((i) => i.label).join(", ")}
          {missing.length > 3 ? ` +${missing.length - 3} more` : ""}
        </p>
      )}
    </Link>
  );
}
