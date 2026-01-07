"use client";

import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Sidebar />
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
