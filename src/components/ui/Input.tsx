"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          "w-full rounded-lg border px-3 py-2.5 text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
          "placeholder:text-neutral-400",
          error ? "border-danger-500" : "border-neutral-300",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

export { Input };
