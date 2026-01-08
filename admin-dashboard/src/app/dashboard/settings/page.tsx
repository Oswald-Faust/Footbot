"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings, Settings } from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";
import { Loader2, Save, AlertTriangle, Lock, Unlock, Trash2, Plus } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [newInviteCode, setNewInviteCode] = useState("");

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

  const addInviteCode = () => {
    if (!newInviteCode.trim() || !settings) return;
    const codes = [...(settings.accessCodes || []), newInviteCode.trim()];
    handleSave("access", { accessCodes: codes });
    setNewInviteCode("");
  };

  const removeInviteCode = (code: string) => {
    if (!settings) return;
    const codes = settings.accessCodes.filter((c) => c !== code);
    handleSave("access", { accessCodes: codes });
  };

  const updatePackage = (index: number, field: string, value: string | number | boolean) => {
    if (!settings) return;
    const newPackages = [...settings.creditPackages];
    newPackages[index] = { ...newPackages[index], [field]: value };
    setSettings({ ...settings, creditPackages: newPackages });
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
        
        {/* Access Control - NEW */}
        <Card title="🔒 Accès & Sécurité">
          <div className="space-y-6">
            {/* Private Mode Toggle */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.privateMode}
                  onChange={(e) =>
                    handleSave("private", { privateMode: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-[#334155] bg-[#0f172a] text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-white font-medium flex items-center gap-2">
                  {settings.privateMode ? <Lock size={16} /> : <Unlock size={16} />}
                  Mode Bot Privé
                </span>
              </label>
              <p className="text-sm text-slate-400 ml-8">
                Si activé, le bot ne sera accessible qu&apos;aux utilisateurs autorisés ou ceux disposant d&apos;un code d&apos;invitation valide.
              </p>
            </div>

            {/* Invite Codes */}
            {settings.privateMode && (
              <div className="space-y-4 border-t border-[#334155] pt-4">
                <h3 className="text-sm font-semibold text-white">Codes d&apos;invitation</h3>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Nouveau code"
                    value={newInviteCode}
                    onChange={(e) => setNewInviteCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={addInviteCode} isLoading={isSaving === "access"} disabled={!newInviteCode}>
                    <Plus size={16} />
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {settings.accessCodes?.length === 0 && (
                    <p className="text-sm text-slate-500 italic">Aucun code actif</p>
                  )}
                  {settings.accessCodes?.map((code) => (
                    <div key={code} className="bg-[#0f172a] p-3 rounded border border-[#334155] space-y-2">
                      <div className="flex items-center justify-between">
                        <code className="text-emerald-400 font-bold font-mono text-lg">{code}</code>
                        <button 
                          onClick={() => removeInviteCode(code)}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-[#1e293b] p-2 rounded text-xs text-slate-300">
                        <span className="truncate flex-1">https://t.me/footologuebot?start={code}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`https://t.me/footologuebot?start=${code}`);
                            alert("Lien copié !");
                          }}
                          className="text-emerald-500 hover:text-emerald-400 font-medium whitespace-nowrap"
                        >
                          Copier le lien
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

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
              label="Prix mensuel (€)"
              type="number"
              min={0}
              step={0.01}
              value={settings.premiumMonthlyPrice / 100}
              onChange={(e) =>
                setSettings({ ...settings, premiumMonthlyPrice: Math.round(parseFloat(e.target.value) * 100) || 0 })
              }
            />
            <p className="text-xs text-slate-400">
              {(settings.premiumMonthlyPrice / 100).toFixed(2)}€ par mois
            </p>
            
            <Input
              label="Prix annuel (€)"
              type="number"
              min={0}
              step={0.01}
              value={settings.premiumYearlyPrice / 100}
              onChange={(e) =>
                setSettings({ ...settings, premiumYearlyPrice: Math.round(parseFloat(e.target.value) * 100) || 0 })
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

      {/* Credit Packages - UPDATED */}
      <Card title="📦 Packages de crédits">
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-slate-400">
              Modifiez les prix et crédits des packages.
            </p>
            <Button
              onClick={() => handleSave("packages", { creditPackages: settings.creditPackages })}
              isLoading={isSaving === "packages"}
            >
              <Save size={16} />
              Sauvegarder les packages
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Pack</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Crédits</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Prix (€)</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Affichage</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Populaire</th>
                </tr>
              </thead>
              <tbody>
                {settings.creditPackages?.map((pkg, index) => (
                  <tr
                    key={pkg.id}
                    className="border-b border-[#334155]/50 group hover:bg-[#334155]/10"
                  >
                    <td className="py-3 px-4 text-sm text-white font-medium">
                      {pkg.name}
                      <div className="text-xs text-slate-500 font-mono">{pkg.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        value={pkg.credits}
                        onChange={(e) => updatePackage(index, 'credits', parseInt(e.target.value))}
                        className="w-24 bg-[#0f172a] border border-[#334155] rounded px-2 py-1 text-white text-sm focus:border-emerald-500 outline-none"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={pkg.price / 100}
                          onChange={(e) => updatePackage(index, 'price', Math.round(parseFloat(e.target.value) * 100) || 0)}
                          className="w-24 bg-[#0f172a] border border-[#334155] rounded px-2 py-1 text-white text-sm focus:border-emerald-500 outline-none"
                        />
                        <span className="text-slate-500 text-xs">{(pkg.price / 100).toFixed(2)}€</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">
                      ~ {settings.costPerMessage > 0 ? Math.floor(pkg.credits / settings.costPerMessage) : 0} analyses
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={pkg.popular}
                        onChange={(e) => updatePackage(index, 'popular', e.target.checked)}
                        className="w-4 h-4 rounded border-[#334155] bg-[#0f172a] text-emerald-500 focus:ring-emerald-500"
                      />
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
