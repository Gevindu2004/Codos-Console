"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import type { MarketplaceModel } from "./types";

interface Props {
  model: MarketplaceModel | null;
  open: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ model, open, onClose }: Props) {
  const [plan, setPlan] = useState("Free trial");
  const [language, setLanguage] = useState("cURL");
  const [copied, setCopied] = useState(false);
  if (!open || !model) return null;

  const endpoint = `https://api.viacodos.com/v1/models/${model.slug}/invoke`;
  const snippets: Record<string, string> = {
    "cURL": `curl -X POST '${endpoint}' \\\n  -H 'Authorization: Bearer $CODOS_API_KEY' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"input":"Hello from CODOS"}'`,
    Python: `import requests\n\nresponse = requests.post(\n  '${endpoint}',\n  headers={'Authorization': 'Bearer $CODOS_API_KEY'},\n  json={'input': 'Hello from CODOS'}\n)\nprint(response.json())`,
    TypeScript: `const response = await fetch('${endpoint}', {\n  method: 'POST',\n  headers: {\n    Authorization: 'Bearer $CODOS_API_KEY',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({ input: 'Hello from CODOS' })\n});\nconsole.log(await response.json());`,
  };

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippets[language]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#14B8A6]">Get API access</p>
            <h2 className="mt-1 text-lg font-bold">{model.name}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[#F1F5F9]/12 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {["Free trial", "Pay-as-you-go", ...(model.plans?.map((item) => item.name) || [])].filter((value, index, all) => all.indexOf(value) === index).map((name) => (
            <button key={name} onClick={() => setPlan(name)} className={`p-3 rounded-xl border text-left ${plan === name ? "border-[#14B8A6]/60 bg-[#14B8A6]/10" : "border-[#F1F5F9]/12"}`}>
              <span className="text-xs font-bold">{name}</span>
              <span className="mt-1 block text-[10px] text-[#CBD5E1]">{name === "Free trial" ? model.freeTierAllowance : name === "Pay-as-you-go" ? model.priceDisplay : "Subscription plan"}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setPlan((value) => value)} className="mt-4 w-full h-10 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />Activate {plan}
        </button>
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              {["cURL", "Python", "TypeScript"].map((value) => (
                <button key={value} onClick={() => setLanguage(value)} className={`px-2.5 py-1.5 rounded-md text-[10px] ${language === value ? "bg-[#14B8A6]/20 text-[#14B8A6]" : "text-[#CBD5E1]"}`}>{value}</button>
              ))}
            </div>
            <button onClick={copySnippet} className="text-[10px] flex items-center gap-1 text-[#CBD5E1]">{copied ? <Check className="w-3 h-3 text-[#14B8A6]" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}</button>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-[#090D16] border border-[#F1F5F9]/10 p-4 text-[11px] leading-relaxed text-[#CBD5E1]">{snippets[language]}</pre>
        </div>
      </div>
    </div>
  );
}
