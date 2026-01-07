"use client";

import clsx from "clsx";

interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "premium";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "info", children, className }: BadgeProps) {
  const variants = {
    success: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/20 text-amber-400",
    error: "bg-red-500/20 text-red-400",
    info: "bg-blue-500/20 text-blue-400",
    premium: "bg-amber-500/20 text-amber-400",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
