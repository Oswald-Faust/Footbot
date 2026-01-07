"use client";

import { useEffect, useState, useCallback } from "react";
import { getUsers, getUser, updateUser, addCredits, User, UsersResponse } from "@/lib/api";
import { Card, Button, Input, Badge, Modal } from "@/components/ui";
import { Search, Eye, Ban, CreditCard, Shield, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

export default function UsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  
  // Modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getUsers(page, 20, search || undefined);
      setData(result);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleViewUser = async (telegramId: number) => {
    try {
      const result = await getUser(telegramId);
      setSelectedUser(result.user);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Failed to load user:", error);
    }
  };

  const handleAddCredits = async () => {
    if (!selectedUser) return;
    const amount = prompt("Nombre de crédits (en centimes) à ajouter :");
    if (!amount) return;

    setIsUpdating(true);
    try {
      await addCredits(selectedUser.telegramId, parseFloat(amount));
      alert(`${amount} crédits ajoutés avec succès !`);
      setIsModalOpen(false);
      loadUsers();
    } catch (error) {
      alert("Erreur lors de l'ajout des crédits");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleBan = async () => {
    if (!selectedUser) return;
    const newBanStatus = !selectedUser.isBanned;
    
    let banReason: string | null = null;
    if (newBanStatus) {
      banReason = prompt("Raison du ban (optionnel) :");
    }

    setIsUpdating(true);
    try {
      await updateUser(selectedUser.telegramId, {
        isBanned: newBanStatus,
        banReason: banReason || undefined,
      });
      alert(newBanStatus ? "Utilisateur banni" : "Utilisateur débanni");
      setIsModalOpen(false);
      loadUsers();
    } catch (error) {
      alert("Erreur lors de la mise à jour");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMakeAdmin = async () => {
    if (!selectedUser) return;
    if (!confirm("Êtes-vous sûr de vouloir rendre cet utilisateur admin ?")) return;

    setIsUpdating(true);
    try {
      await updateUser(selectedUser.telegramId, { isAdmin: true });
      alert("Utilisateur promu admin");
      setIsModalOpen(false);
      loadUsers();
    } catch (error) {
      alert("Erreur lors de la promotion");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Utilisateurs</h1>
          <p className="text-slate-400">
            Gérez vos utilisateurs et leurs quotas
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
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
                      ID Telegram
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Username
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Nom
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Messages
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Crédits
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users && data.users.length > 0 ? (
                    data.users.map((user) => (
                      <tr
                        key={user._id}
                        className="border-b border-[#334155]/50 hover:bg-[#334155]/30"
                      >
                        <td className="py-3 px-4 text-sm text-white font-mono">
                          {user.telegramId}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300">
                          {user.username ? `@${user.username}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-white">
                          {user.firstName || ""} {user.lastName || ""}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300">
                          {user.totalMessagesSent}
                        </td>
                        <td className="py-3 px-4 text-sm text-emerald-400">
                          {user.credits}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {user.isPremium && (
                              <Badge variant="premium">👑 Premium</Badge>
                            )}
                            {user.isAdmin && (
                              <Badge variant="info">⚙️ Admin</Badge>
                            )}
                            {user.isBanned ? (
                              <Badge variant="error">Banni</Badge>
                            ) : (
                              <Badge variant="success">Actif</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewUser(user.telegramId)}
                          >
                            <Eye size={16} />
                            Voir
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Aucun utilisateur trouvé
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

      {/* User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="👤 Détails utilisateur"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-slate-400">ID Telegram</p>
                <p className="text-white font-mono">{selectedUser.telegramId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Username</p>
                <p className="text-white">
                  {selectedUser.username ? `@${selectedUser.username}` : "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Nom</p>
                <p className="text-white">
                  {selectedUser.firstName || ""} {selectedUser.lastName || ""}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Messages envoyés</p>
                <p className="text-white">{selectedUser.totalMessagesSent}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Messages gratuits</p>
                <p className="text-white">
                  {selectedUser.freeMessagesUsed} / {selectedUser.freeMessagesLimit}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Crédits</p>
                <p className="text-emerald-400 font-medium">{selectedUser.credits} centimes</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Dépenses totales</p>
                <p className="text-white">{(selectedUser.totalSpent / 100).toFixed(2)}€</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Premium</p>
                <p className="text-white">
                  {selectedUser.isPremium
                    ? `👑 Jusqu'au ${new Date(selectedUser.premiumUntil!).toLocaleDateString("fr-FR")}`
                    : "Non"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Inscrit le</p>
                <p className="text-white">
                  {new Date(selectedUser.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-400">Dernière activité</p>
                <p className="text-white">
                  {new Date(selectedUser.lastActiveAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 pt-4 border-t border-[#334155]">
              {selectedUser.isAdmin && <Badge variant="info">⚙️ Admin</Badge>}
              {selectedUser.isPremium && <Badge variant="premium">👑 Premium</Badge>}
              {selectedUser.isBanned ? (
                <Badge variant="error">🚫 Banni</Badge>
              ) : (
                <Badge variant="success">✅ Actif</Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-[#334155]">
              <Button
                variant="primary"
                onClick={handleAddCredits}
                disabled={isUpdating}
              >
                <CreditCard size={16} />
                Ajouter crédits
              </Button>
              <Button
                variant={selectedUser.isBanned ? "secondary" : "danger"}
                onClick={handleToggleBan}
                disabled={isUpdating}
              >
                <Ban size={16} />
                {selectedUser.isBanned ? "Débannir" : "Bannir"}
              </Button>
              {!selectedUser.isAdmin && (
                <Button
                  variant="outline"
                  onClick={handleMakeAdmin}
                  disabled={isUpdating}
                >
                  <Shield size={16} />
                  Rendre Admin
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
