"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings, Settings } from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";
import { Loader2, Save, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (section: string, updates: Partial<Settings>) => {
    setIsSaving(section);
    try {
      const updated = await updateSettings(updates);
      setSettings(updated);
      alert("Paramètres sauvegardés !");
    } catch (error) {
      alert("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center text-slate-400 py-12">
        Erreur lors du chargement des paramètres
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Paramètres</h1>
        <p className="text-slate-400">
          Configurez les paramètres de votre bot
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Free Messages */}
        <Card title="🎁 Messages gratuits">
          <div className="space-y-4">
            <Input
              label="Limite de messages gratuits"
              type="number"
              min={0}
              max={100}
              value={settings.freeMessagesLimit}
              onChange={(e) =>
                setSettings({ ...settings, freeMessagesLimit: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-sm text-slate-400">
              Nombre de messages gratuits accordés à chaque nouvel utilisateur.
            </p>
            <Button
              onClick={() => handleSave("free", { freeMessagesLimit: settings.freeMessagesLimit })}
              isLoading={isSaving === "free"}
            >
              <Save size={16} />
              Sauvegarder
            </Button>
          </div>
        </Card>

        {/* Pricing */}
        <Card title="💰 Tarification">
          <div className="space-y-4">
            <Input
              label="Coût par message (centimes)"
              type="number"
              min={0}
              step={0.1}
              value={settings.costPerMessage}
              onChange={(e) =>
                setSettings({ ...settings, costPerMessage: parseFloat(e.target.value) || 0 })
              }
            />
            <p className="text-sm text-slate-400">
              Coût déduit des crédits pour chaque analyse (après les messages gratuits).
            </p>
            <Button
              onClick={() => handleSave("pricing", { costPerMessage: settings.costPerMessage })}
              isLoading={isSaving === "pricing"}
            >
              <Save size={16} />
              Sauvegarder
            </Button>
          </div>
        </Card>

        {/* Premium */}
        <Card title="👑 Abonnement Premium">
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.premiumEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, premiumEnabled: e.target.checked })
                }
                className="w-5 h-5 rounded border-[#334155] bg-[#0f172a] text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-white">Activer les abonnements Premium</span>
            </label>
            
            <Input
              label="Prix mensuel (centimes)"
              type="number"
              min={0}
              value={settings.premiumMonthlyPrice}
              onChange={(e) =>
                setSettings({ ...settings, premiumMonthlyPrice: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-slate-400">
              {(settings.premiumMonthlyPrice / 100).toFixed(2)}€ par mois
            </p>
            
            <Input
              label="Prix annuel (centimes)"
              type="number"
              min={0}
              value={settings.premiumYearlyPrice}
              onChange={(e) =>
                setSettings({ ...settings, premiumYearlyPrice: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-slate-400">
              {(settings.premiumYearlyPrice / 100).toFixed(2)}€ par an
              ({" "}économie de {((settings.premiumMonthlyPrice * 12 - settings.premiumYearlyPrice) / 100).toFixed(2)}€)
            </p>
            
            <Button
              onClick={() =>
                handleSave("premium", {
                  premiumEnabled: settings.premiumEnabled,
                  premiumMonthlyPrice: settings.premiumMonthlyPrice,
                  premiumYearlyPrice: settings.premiumYearlyPrice,
                })
              }
              isLoading={isSaving === "premium"}
            >
              <Save size={16} />
              Sauvegarder
            </Button>
          </div>
        </Card>

        {/* Maintenance */}
        <Card title="🔧 Mode Maintenance">
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) =>
                  setSettings({ ...settings, maintenanceMode: e.target.checked })
                }
                className="w-5 h-5 rounded border-[#334155] bg-[#0f172a] text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-white">Mode maintenance activé</span>
            </label>
            
            {settings.maintenanceMode && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="text-amber-400 flex-shrink-0" size={20} />
                <p className="text-sm text-amber-200">
                  Le mode maintenance est activé. Les utilisateurs non-admin ne pourront pas envoyer de messages.
                </p>
              </div>
            )}
            
            <p className="text-sm text-slate-400">
              Active le mode maintenance pour bloquer temporairement les nouveaux messages.
              Les administrateurs peuvent toujours utiliser le bot.
            </p>
            
            <Button
              onClick={() => handleSave("maintenance", { maintenanceMode: settings.maintenanceMode })}
              isLoading={isSaving === "maintenance"}
              variant={settings.maintenanceMode ? "danger" : "primary"}
            >
              <Save size={16} />
              {settings.maintenanceMode ? "Désactiver" : "Activer"}
            </Button>
          </div>
        </Card>
      </div>

      {/* Credit Packages */}
      <Card title="📦 Packages de crédits">
        <div className="space-y-4">
          <p className="text-sm text-slate-400 mb-4">
            Packages disponibles à l&apos;achat pour les utilisateurs.
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Nom
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Crédits
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Prix
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Messages
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                    Populaire
                  </th>
                </tr>
              </thead>
              <tbody>
                {settings.creditPackages?.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="border-b border-[#334155]/50 hover:bg-[#334155]/30"
                  >
                    <td className="py-3 px-4 text-sm text-slate-400 font-mono">
                      {pkg.id}
                    </td>
                    <td className="py-3 px-4 text-sm text-white">
                      {pkg.name}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">
                      {pkg.credits}
                    </td>
                    <td className="py-3 px-4 text-sm text-emerald-400">
                      {(pkg.price / 100).toFixed(2)}€
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">
                      {Math.floor(pkg.credits / settings.costPerMessage)}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {pkg.popular ? (
                        <span className="text-amber-400">⭐ Oui</span>
                      ) : (
                        <span className="text-slate-500">Non</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
