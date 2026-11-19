"use client";

import { useMemo, useState } from "react";
import { Star, X } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminContext";
import { CommercialPricingDetails } from "@/components/developer/CommercialPricingDetails";

const selectClass = "rounded-lg border border-slate-700/80 bg-[#0B1120] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none";

export default function LiveCatalogPage() {
  const { liveProducts, suspendLiveProduct, republishProduct, toggleFeaturedProduct } = useAdmin();
  const [status, setStatus] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const visible = useMemo(() => status === "All" ? liveProducts : liveProducts.filter((product) => product.status === status), [liveProducts, status]);
  const selected = liveProducts.find((product) => product.id === selectedId);

  const submitSuspend = () => {
    if (!selectedId || !reason.trim()) {
      setError("A compliance reason is required.");
      return;
    }
    suspendLiveProduct(selectedId, reason);
    setSelectedId(null);
    setReason("");
    setError("");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Marketplace lifecycle</p><h1 className="mt-1 text-3xl font-bold">Live Catalog</h1><p className="mt-2 text-sm text-slate-400">Govern first-party Via Codos and third-party API and model listings.</p></div><label className="text-xs text-slate-400">Listing status<select value={status} onChange={(event) => setStatus(event.target.value)} className={`${selectClass} ml-2`}><option className="bg-[#0B1120] text-slate-100" value="All">All</option><option className="bg-[#0B1120] text-slate-100" value="Published">Published</option><option className="bg-[#0B1120] text-slate-100" value="Suspended">Suspended</option><option className="bg-[#0B1120] text-slate-100" value="Unpublished">Unpublished</option></select></label></header>
      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#111C2E]">
        <table className="w-full min-w-[1250px] text-left text-sm">
          <thead className="border-b border-slate-700 bg-[#0B1120]/70 text-xs uppercase tracking-wider text-slate-400">
            <tr>{["Product", "Provider", "Type", "Status", "Commercial terms", "Featured", "Updated", "Governance"].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.map((product) => (
              <tr key={product.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-4">
                  <p className="font-semibold">{product.name}</p>
                  <p className="mt-1 text-[10px] text-slate-500">/{product.slug}</p>
                  {product.complianceReason && <p className="mt-1 max-w-xs truncate text-[10px] text-rose-300" title={product.complianceReason}>{product.complianceReason}</p>}
                </td>
                <td className="px-4 py-4">
                  <p className="text-xs text-slate-300">{product.providerType === "via_codos" ? "Via Codos Official" : product.developerName}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{product.providerType === "via_codos" ? "First-party" : "Verified developer"}</p>
                </td>
                <td className="px-4 py-4 text-xs uppercase text-slate-400">{product.productType === "api" ? "API" : "AI Model"}</td>
                <td className="px-4 py-4"><span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">{product.status}</span></td>
                <td className="px-4 py-4">
                  <CommercialPricingDetails
                    basePrice={product.basePrice}
                    pricingTier={product.pricingTier}
                    profitMarginPercent={product.profitMarginPercent}
                    finalRetailPrice={product.finalRetailPrice}
                    agreementSigned={product.agreementSigned}
                    agreementSignedBy={product.agreementSignedBy}
                    agreementSignedAt={product.agreementSignedAt}
                  />
                </td>
                <td className="px-4 py-4"><button onClick={() => toggleFeaturedProduct(product.id)} aria-label={`${product.featured ? "Unfeature" : "Feature"} ${product.name}`} className={`rounded-lg p-2 ${product.featured ? "text-amber-300" : "text-slate-500 hover:text-amber-300"}`}><Star className={`h-4 w-4 ${product.featured ? "fill-current" : ""}`} /></button></td>
                <td className="px-4 py-4 text-xs text-slate-400">{new Date(product.updatedAt).toLocaleDateString()}</td>
                <td className="px-4 py-4">{product.status === "Published" ? <button onClick={() => { setSelectedId(product.id); setError(""); setReason(""); }} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-400/10">Suspend</button> : <button onClick={() => republishProduct(product.id)} className="rounded-lg border border-teal-400/30 px-3 py-2 text-xs font-semibold text-teal-200 hover:bg-teal-400/10">Republish</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No listings match this status.</p>}
      </div>
      {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#111C2E] p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-rose-300">Compliance action</p><h2 className="mt-1 text-lg font-bold">Suspend {selected.name}</h2></div><button onClick={() => setSelectedId(null)} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button></div><label htmlFor="compliance-reason" className="mb-2 block text-sm text-slate-300">Required compliance reason</label><textarea id="compliance-reason" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-[#0B1120] p-3 text-sm text-slate-100 focus:border-teal-400 focus:outline-none" placeholder="Document the compliance or safety concern." />{error && <p className="mt-2 text-sm text-rose-300">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button onClick={() => setSelectedId(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Cancel</button><button onClick={submitSuspend} className="rounded-lg bg-rose-400 px-3 py-2 text-sm font-bold text-slate-950">Suspend listing</button></div></div></div>}
    </div>
  );
}
