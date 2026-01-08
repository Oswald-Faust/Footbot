"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings, Settings, getInvites, createInvite, deleteInvite, InviteCode } from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";
import { Loader2, Save, AlertTriangle, Lock, Unlock, Trash2, Plus, RefreshCw, Copy } from "lucide-react";

function InviteCodesManager() {
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [isOneTime, setIsOneTime] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const { invites, legacyCodes } = await getInvites();
      setInvites([...invites, ...legacyCodes]);
    } catch (error) {
      console.error("Error loading invites", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newCode) return;
    setCreating(true);
    try {
      const invite = await createInvite(newCode, isOneTime ? 'one_time' : 'unlimited');
      setInvites([invite, ...invites]);
      setNewCode("");
    } catch (error) {
      alert("Impossible de créer le code (doublon ?)");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm("Supprimer ce code ?")) return;
    try {
      await deleteInvite(code);
      setInvites(invites.filter(i => i.code !== code));
    } catch (error) {
      alert("Erreur lors de la suppression");
    }
  };

  if (loading) return <Loader2 className="animate-spin text-slate-400" size={20} />;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">Codes d&apos;invitation</h3>
      
      <div className="flex flex-col gap-3 bg-[#1e293b] p-3 rounded-lg border border-[#334155]">
        <Input
          placeholder="Nouveau code (ex: VIP2024)"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
            <input 
              type="checkbox" 
              checked={isOneTime}
              onChange={(e) => setIsOneTime(e.target.checked)}
              className="w-4 h-4 rounded border-[#334155] bg-[#0f172a] text-emerald-500 focus:ring-emerald-500"
            />
            Usage unique
          </label>
          <Button onClick={handleCreate} isLoading={creating} disabled={!newCode} size="sm">
            <Plus size={16} /> Ajouter
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {invites.length === 0 && (
          <p className="text-sm text-slate-500 italic">Aucun code actif</p>
        )}
        {invites.map((invite) => (
          <div key={invite._id || invite.code} className={`p-3 rounded border space-y-2 ${invite.isUsed ? 'bg-red-950/20 border-red-900/30' : 'bg-[#0f172a] border-[#334155]'}`}>
            <div className="flex items-center justify-between">
              <div>
                <code className={`font-bold font-mono text-lg ${invite.isUsed ? 'text-slate-500 line-through' : 'text-emerald-400'}`}>
                  {invite.code}
                </code>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${invite.type === 'one_time' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {invite.type === 'one_time' ? 'Usage Unique' : 'Illimité'}
                  </span>
                  {invite.isLegacy && <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">Legacy</span>}
                  {invite.isUsed && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Utilisé</span>}
                </div>
              </div>
              
              <button 
                onClick={() => handleDelete(invite.code)}
                className="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            {!invite.isUsed && (
              <div className="flex items-center gap-2 bg-[#1e293b] p-2 rounded text-xs text-slate-300">
                <span className="truncate flex-1">t.me/footologuebot?start={invite.code}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`https://t.me/footologuebot?start=${invite.code}`);
                    // alert("Lien copié !");
                  }}
                  className="text-emerald-500 hover:text-emerald-400 font-medium whitespace-nowrap flex items-center gap-1"
                >
                  <Copy size={12} /> Copier
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

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
        
        {/* Access Control - UPDATED */}
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
            </div>

            {/* Invite Codes */}
            {settings.privateMode && (
              <div className="space-y-4 border-t border-[#334155] pt-4">
                <InviteCodesManager />
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
