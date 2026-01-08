"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#1e293b] border-b border-[#334155] z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚽</span>
          <span className="text-lg font-bold text-white">Cotybet</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <Menu size={24} />
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8 min-h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
