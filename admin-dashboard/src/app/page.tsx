"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="text-center">
        <div className="text-6xl mb-4">⚽</div>
        <p className="text-slate-400">Redirection vers le dashboard...</p>
      </div>
    </div>
  );
}
