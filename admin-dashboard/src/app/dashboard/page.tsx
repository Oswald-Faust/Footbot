"use client";

import { useEffect, useState } from "react";
import { getStats, DashboardStats } from "@/lib/api";
import { StatCard, Card } from "@/components/ui";
import { Users, MessageSquare, DollarSign, Activity, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
      setError("Impossible de charger les statistiques. Vérifiez que le backend est lancé sur le port 3000.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={loadStats}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-slate-400 py-12">
        Aucune donnée disponible
      </div>
    );
  }

  const messagesChartData = stats.messagesPerDay?.map((d) => ({
    date: new Date(d._id).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    count: d.count,
  })) || [];

  const revenueChartData = stats.revenuePerDay?.map((d) => ({
    date: new Date(d._id).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    amount: d.amount / 100,
  })) || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Vue d&apos;ensemble</h1>
        <p className="text-slate-400">
          Bienvenue sur le tableau de bord FootBot Admin
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Utilisateurs"
          value={stats.totalUsers?.toLocaleString() || "0"}
          icon={<Users size={24} />}
        />
        <StatCard
          title="Messages"
          value={stats.totalMessages?.toLocaleString() || "0"}
          icon={<MessageSquare size={24} />}
        />
        <StatCard
          title="Revenus"
          value={`${((stats.totalRevenue || 0) / 100).toFixed(2)}€`}
          icon={<DollarSign size={24} />}
        />
        <StatCard
          title="Actifs (7j)"
          value={stats.activeUsers?.toLocaleString() || "0"}
          icon={<Activity size={24} />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="📈 Messages par jour">
          <div className="h-64">
            {messagesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={messagesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f8fafc" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Pas de données disponibles
              </div>
            )}
          </div>
        </Card>

        <Card title="💵 Revenus par jour">
          <div className="h-64">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f8fafc" }}
                    formatter={(value) => value !== undefined ? [`${Number(value).toFixed(2)}€`, "Revenus"] : ["", ""]}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Pas de données disponibles
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="💳 Derniers paiements">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Utilisateur
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Montant
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPayments && stats.recentPayments.length > 0 ? (
                  stats.recentPayments.slice(0, 5).map((payment) => (
                    <tr
                      key={payment._id}
                      className="border-b border-[#334155]/50 hover:bg-[#334155]/30"
                    >
                      <td className="py-3 px-4 text-sm text-white">
                        {payment.userId?.username
                          ? `@${payment.userId.username}`
                          : payment.userId?.firstName || `ID: ${payment.telegramId}`}
                      </td>
                      <td className="py-3 px-4 text-sm text-emerald-400 font-medium">
                        {(payment.amount / 100).toFixed(2)}€
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-300">
                        {payment.type === "credits" ? "💰 Crédits" : "👑 Premium"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      Aucun paiement
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="🏆 Top utilisateurs">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Utilisateur
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Messages
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Dépenses
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.topUsers && stats.topUsers.length > 0 ? (
                  stats.topUsers.slice(0, 5).map((user) => (
                    <tr
                      key={user._id}
                      className="border-b border-[#334155]/50 hover:bg-[#334155]/30"
                    >
                      <td className="py-3 px-4 text-sm text-white">
                        {user.username
                          ? `@${user.username}`
                          : user.firstName || `ID: ${user.telegramId}`}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-300">
                        {user.totalMessagesSent}
                      </td>
                      <td className="py-3 px-4 text-sm text-emerald-400 font-medium">
                        {(user.totalSpent / 100).toFixed(2)}€
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      Aucun utilisateur
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
