"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import type { CustomerApiKey } from "./types";

interface Props {
  apiSlug: string;
  defaultRateLimitRpm: number;
}

export default function ApiKeyManager({ apiSlug, defaultRateLimitRpm }: Props) {
  const storageKey = `codos-customer-api-keys:${apiSlug}`;
  const storedKeys = useSyncExternalStore(
    (notify) => {
      const onChange = (event: Event) => {
        if (event instanceof StorageEvent && event.key !== storageKey) return;
        notify();
      };
      window.addEventListener("storage", onChange);
      window.addEventListener("codos-api-keys-changed", onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener("codos-api-keys-changed", onChange);
      };
    },
    () => localStorage.getItem(storageKey),
    () => null,
  );
  const keys = useMemo(() => {
    if (!storedKeys) return [];
    try {
      return JSON.parse(storedKeys) as CustomerApiKey[];
    } catch (error) {
      console.error("Could not parse stored API keys", error);
      return [];
    }
  }, [storedKeys]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"live" | "trial">("trial");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const persist = (next: CustomerApiKey[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event("codos-api-keys-changed"));
    } catch (error) {
      console.error("Could not save API keys", error);
      setMessage("Key metadata could not be saved in this browser.");
    }
  };

  const createKey = () => {
    if (!name.trim()) {
      setMessage("Enter a label for this API key.");
      return;
    }
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const prefix = environment === "live" ? "sk_live" : "sk_trial";
    const fullSecret = `${prefix}_${secret}`;
    const now = new Date().toISOString();
    const nextKey: CustomerApiKey = {
      id: `${apiSlug}-${secret.slice(0, 12)}`,
      apiSlug,
      name: name.trim(),
      keyPrefix: prefix,
      maskedKey: `${prefix}_••••${secret.slice(-4)}`,
      environment,
      rateLimitRpm: environment === "trial" ? Math.min(defaultRateLimitRpm, 60) : defaultRateLimitRpm,
      createdAt: now,
      lastUsedAt: null,
      isActive: true,
    };
    persist([nextKey, ...keys]);
    setRevealedSecret(fullSecret);
    setName("");
    setCreateOpen(false);
    setMessage("Copy this secret now. It will not be shown again.");
  };

  const revoke = (id: string) => {
    if (!window.confirm("Revoke this API key? Existing integrations using it will stop working.")) return;
    persist(keys.map((item) => item.id === id ? { ...item, isActive: false } : item));
  };

  const regenerate = (item: CustomerApiKey) => {
    if (!window.confirm(`Regenerate "${item.name}"? The previous key will be revoked.`)) return;
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const fullSecret = `${item.keyPrefix}_${secret}`;
    const replacement: CustomerApiKey = {
      ...item,
      id: `${apiSlug}-${secret.slice(0, 12)}`,
      maskedKey: `${item.keyPrefix}_••••${secret.slice(-4)}`,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      isActive: true,
    };
    persist([replacement, ...keys.map((key) => key.id === item.id ? { ...key, isActive: false } : key)]);
    setRevealedSecret(fullSecret);
    setMessage("New secret generated. Copy it now; it will not be shown again.");
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Could not copy API key", error);
      setMessage("Clipboard access was unavailable. Select and copy the key manually.");
    }
  };

  return (
    <section className="glass-panel rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-bold">API Keys</h2><p className="mt-1 text-[10px] text-[#CBD5E1]">Keys are stored locally in this browser. Treat live secrets like passwords.</p></div>
        <button onClick={() => { setCreateOpen(true); setMessage(""); }} className="h-9 px-3 rounded-lg bg-[#14B8A6] text-[#0F172A] text-xs font-bold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Create New Key</button>
      </div>

      {message && <p role="status" className="mt-4 text-xs text-[#14B8A6]">{message}</p>}
      {revealedSecret && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-amber-200">One-time secret reveal</p><p className="mt-1 text-[10px] text-[#CBD5E1]">This value is not persisted. Copy it now.</p></div><button onClick={() => setRevealedSecret(null)} aria-label="Hide secret"><X className="w-4 h-4" /></button></div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><code className="break-all text-xs">{revealedSecret}</code><button onClick={() => copy(revealedSecret)} className="h-8 px-2 rounded-md border border-[#F1F5F9]/12 text-[10px] inline-flex items-center gap-1">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}</button></div>
        </div>
      )}

      {createOpen && (
        <div className="mt-4 rounded-xl border border-[#F1F5F9]/10 p-4">
          <div className="flex justify-between items-center"><h3 className="text-sm font-bold">Create API key</h3><button onClick={() => setCreateOpen(false)} aria-label="Close create key form"><X className="w-4 h-4" /></button></div>
          <div className="mt-3 grid sm:grid-cols-[1fr_180px_auto] gap-2">
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Key label (e.g. Production app)" className="h-9 rounded-lg bg-[#0F172A]/50 border border-[#F1F5F9]/12 px-3 text-xs outline-none focus:border-[#14B8A6]" />
            <select value={environment} onChange={(event) => setEnvironment(event.target.value as "live" | "trial")} className="h-9 rounded-lg bg-[#0B1120] text-slate-100 border border-slate-700/80 px-3 text-xs focus:border-teal-400 focus:outline-none"><option className="bg-[#0B1120] text-slate-100" value="trial">Trial</option><option className="bg-[#0B1120] text-slate-100" value="live">Live</option></select>
            <button onClick={createKey} className="h-9 px-3 rounded-lg bg-[#14B8A6] text-[#0F172A] text-xs font-bold">Generate key</button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#F1F5F9]/15 p-8 text-center"><KeyRound className="w-5 h-5 text-[#14B8A6] mx-auto" /><p className="mt-2 text-xs text-[#CBD5E1]">No keys created for this API.</p></div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[10px]">
            <thead><tr className="text-[#CBD5E1]/70 border-b border-[#F1F5F9]/10"><th className="py-2 pr-3">Name / Key</th><th className="py-2 pr-3">Environment</th><th className="py-2 pr-3">Created</th><th className="py-2 pr-3">Last used</th><th className="py-2 pr-3">Status</th><th className="py-2">Actions</th></tr></thead>
            <tbody>{keys.map((item) => <tr key={item.id} className="border-b border-[#F1F5F9]/5">
              <td className="py-3 pr-3"><p className="font-semibold">{item.name}</p><code className="text-[#CBD5E1]">{item.maskedKey}</code></td>
              <td className="py-3 pr-3 capitalize">{item.environment} · {item.rateLimitRpm} RPM</td>
              <td className="py-3 pr-3">{new Date(item.createdAt).toLocaleDateString()}</td>
              <td className="py-3 pr-3">{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : "Never"}</td>
              <td className="py-3 pr-3"><span className={`inline-flex items-center gap-1 ${item.isActive ? "text-emerald-300" : "text-[#CBD5E1]"}`}>{item.isActive ? <ShieldCheck className="w-3 h-3" /> : <X className="w-3 h-3" />}{item.isActive ? "Active" : "Revoked"}</span></td>
              <td className="py-3"><div className="flex gap-2"><button disabled={!item.isActive} onClick={() => regenerate(item)} className="inline-flex items-center gap-1 text-[#14B8A6] disabled:opacity-40"><RefreshCw className="w-3 h-3" />Regenerate</button><button disabled={!item.isActive} onClick={() => revoke(item.id)} className="inline-flex items-center gap-1 text-rose-300 disabled:opacity-40"><Trash2 className="w-3 h-3" />Revoke</button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
