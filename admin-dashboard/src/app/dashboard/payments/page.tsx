"use client";

import { useEffect, useState, useCallback } from "react";
import { getPayments, PaymentsResponse } from "@/lib/api";
import { Card, Button, Badge } from "@/components/ui";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

const statusFilters = [
  { value: "", label: "Tous" },
  { value: "completed", label: "Complétés" },
  { value: "pending", label: "En attente" },
  { value: "failed", label: "Échoués" },
];

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getPayments(page, 20, status || undefined);
      setData(result);
    } catch (error) {
      console.error("Failed to load payments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const getStatusBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "completed":
        return <Badge variant="success">Complété</Badge>;
      case "pending":
        return <Badge variant="warning">En attente</Badge>;
      case "failed":
        return <Badge variant="error">Échoué</Badge>;
      case "refunded":
        return <Badge variant="info">Remboursé</Badge>;
      default:
        return <Badge>{paymentStatus}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Paiements</h1>
        <p className="text-slate-400">
          Historique de tous les paiements
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              status === filter.value
                ? "bg-emerald-500 text-white"
                : "bg-[#1e293b] text-slate-400 hover:bg-[#334155] hover:text-white border border-[#334155]"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-emerald-500" size={48} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      ID
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Utilisateur
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Montant
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Statut
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.payments && data.payments.length > 0 ? (
                    data.payments.map((payment) => (
                      <tr
                        key={payment._id}
                        className="border-b border-[#334155]/50 hover:bg-[#334155]/30"
                      >
                        <td className="py-3 px-4 text-sm text-slate-400 font-mono">
                          {payment.stripePaymentIntentId.substring(0, 12)}...
                        </td>
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
                        <td className="py-3 px-4">
                          {getStatusBadge(payment.status)}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-400">
                          {new Date(payment.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Aucun paiement trouvé
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm text-slate-400">
                  Page {page} sur {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
