"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

// type="password" gets a show/hide eye toggle automatically.
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type, ...props }, ref) => {
    const isPassword = type === "password";
    const [visible, setVisible] = useState(false);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={isPassword && visible ? "text" : type}
            className={cn(
              "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-all duration-150",
              "placeholder:text-neutral-400",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
              "hover:border-neutral-400",
              error
                ? "border-danger-400 focus:ring-danger-500/20 focus:border-danger-500"
                : "border-neutral-300",
              className,
              // After className so a caller's px-* can't cover the eye button.
              isPassword && "pr-10"
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-neutral-400 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-danger-600 flex items-center gap-1">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
