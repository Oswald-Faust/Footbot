"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        "bg-[#1e293b] border border-[#334155] rounded-xl p-6 hover:border-emerald-500/50 transition-all hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {trend && (
            <p
              className={clsx(
                "text-sm mt-2",
                trend.isPositive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export function Card({ title, children, className, headerAction }: CardProps) {
  return (
    <div className={clsx("bg-[#1e293b] border border-[#334155] rounded-xl", className)}>
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
          <h3 className="font-semibold text-white">{title}</h3>
          {headerAction}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
