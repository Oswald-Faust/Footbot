"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/dashboard/users", label: "Utilisateurs", icon: Users },
  { href: "/dashboard/payments", label: "Paiements", icon: CreditCard },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#1e293b] border-r border-[#334155] flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-[#334155]">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚽</span>
          <span className="text-xl font-bold text-white">FootBot Admin</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-400"
                      : "text-slate-400 hover:bg-[#334155] hover:text-white"
                  )}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#334155]">
        <p className="text-xs text-slate-500 text-center">
          FootBot Admin v1.0
        </p>
      </div>
    </aside>
  );
}
