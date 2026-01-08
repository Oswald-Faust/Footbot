"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  X,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/dashboard/users", label: "Utilisateurs", icon: Users },
  { href: "/dashboard/payments", label: "Paiements", icon: CreditCard },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={clsx(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed left-0 top-0 h-screen w-64 bg-[#1e293b] border-r border-[#334155] flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚽</span>
            <span className="text-xl font-bold text-white tracking-tight">Cotybet</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onClose()} // Close on click on mobile
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group font-medium",
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-l-4 border-emerald-400 shadow-sm"
                        : "text-slate-400 hover:bg-[#334155]/50 hover:text-white border-l-4 border-transparent"
                    )}
                  >
                    <item.icon size={20} className={clsx(isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-white transition-colors")} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#334155] bg-[#0f172a]/30">
          <div className="flex flex-col items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
              v1.0.0
            </div>
            <p className="text-[10px] text-slate-600">
              © 2024 Cotybet Admin
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
