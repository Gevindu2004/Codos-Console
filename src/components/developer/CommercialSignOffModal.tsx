"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { ApiSubmissionPayload, ModelSubmissionPayload } from "./types";
import {
  calculateFinalRetailPrice,
  commercialPricingTiers,
  type CommercialPricingTier,
  type CommercialSignoffInput,
} from "@/lib/commercialPricing";
import {
  postMarketplaceCommercialSignoff,
} from "@/lib/developerApi";
import { applyMarketplaceCommercialSignoff } from "@/lib/marketplaceStore";

type CommercialProductBase = {
  id: string;
  marketplaceProductId?: string;
  basePrice?: number;
  pricingTier?: CommercialPricingTier | null;
  agreementSigned?: boolean;
};

type CommercialProduct =
  | (CommercialProductBase & { productType: "api"; payload: ApiSubmissionPayload })
  | (CommercialProductBase & { productType: "model"; payload: ModelSubmissionPayload });

const terms = [
  "The selected margin tier is added to the developer's base price to calculate the customer-facing retail price.",
  "Customer requests for this product are routed through the CODOS Marketplace Gateway and may be metered for billing and usage records.",
  "The developer confirms that the submitted base price and billing unit are accurate and authorizes publication at the calculated retail price.",
  "The authorized signatory, agreement version, selected tier, and sign-off timestamp are recorded with this product.",
];

const unitLabels: Record<string, string> = {
  free: "per request",
  pay_per_request: "per request",
  per_inference: "per inference",
  per_token: "per 1K tokens",
  per_image: "per image",
  per_video_min: "per video minute",
  per_audio_min: "per audio minute",
  subscription: "per month",
  monthly_subscription: "per month",
  credit_package: "per credit package",
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(amount);

export function CommercialSignOffModal({
  product,
  onClose,
}: {
  product: CommercialProduct;
  onClose: () => void;
}) {
  const formPrice = product.productType === "api"
    ? product.payload.formE.pricePerRequest ?? 0
    : product.payload.formE.rate ?? 0;
  const billingValue = product.productType === "api"
    ? product.payload.formE.pricingModel[0] ?? "pay_per_request"
    : product.payload.formE.billingUnit || "per_inference";
  const billingUnit = unitLabels[billingValue] ?? billingValue.replaceAll("_", " ");
  const [basePrice, setBasePrice] = useState(String(product.basePrice && product.basePrice > 0 ? product.basePrice : formPrice));
  const [pricingTier, setPricingTier] = useState<CommercialPricingTier>(product.pricingTier ?? "Tier 1");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [signatory, setSignatory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const parsedBasePrice = Number(basePrice);
  const validBasePrice = Number.isFinite(parsedBasePrice) && parsedBasePrice >= 0;
  const marginRate = commercialPricingTiers.find((tier) => tier.tier === pricingTier)!.marginRate;
  const marginAmount = validBasePrice ? parsedBasePrice * marginRate : 0;
  const finalRetailPrice = validBasePrice
    ? calculateFinalRetailPrice(parsedBasePrice, pricingTier)
    : 0;

  const confirmSignoff = async () => {
    const authorizedName = signatory.trim();
    if (!agreementAccepted) {
      setError("Accept the commercial agreement before publishing.");
      return;
    }
    if (!authorizedName) {
      setError("Enter the authorized signatory name.");
      return;
    }
    if (!validBasePrice) {
      setError("Enter a valid non-negative base price.");
      return;
    }

    const input: CommercialSignoffInput = {
      base_price: parsedBasePrice,
      pricing_tier: pricingTier,
      agreement_signed: true,
      agreement_signed_by: authorizedName,
    };
    setSubmitting(true);
    setError("");
    try {
      const savedRecord = product.marketplaceProductId
        ? await postMarketplaceCommercialSignoff(product.marketplaceProductId, input)
        : null;
      applyMarketplaceCommercialSignoff(
        product.marketplaceProductId ?? product.id,
        input,
        savedRecord,
      );
      onClose();
    } catch (signoffError) {
      setError(signoffError instanceof Error ? signoffError.message : "Could not complete commercial sign-off.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="commercial-signoff-title">
      <section className="my-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#111827] text-slate-100 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">Agreement & final pricing</p>
            <h2 id="commercial-signoff-title" className="mt-1 text-xl font-bold">Sign Agreement & Set Pricing</h2>
            <p className="mt-1 text-sm text-slate-400">
              {product.productType === "api" ? product.payload.formA.productName : product.payload.formA.modelName}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close commercial sign-off" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
          <section>
            <h3 className="text-sm font-bold">Step 1 — CODOS Partner Agreement Sign-Off</h3>
            <div className="mt-3 max-h-40 space-y-3 overflow-y-auto rounded-xl border border-slate-700 bg-[#0B1120] p-4 text-xs leading-relaxed text-slate-300">
              <p className="font-semibold text-slate-100">Commercial terms summary · Agreement v1.0</p>
              <p>This summary records the commercial settings for this marketplace product. Refer to the full CODOS Marketplace Commercial & Revenue Share Agreement for the complete terms.</p>
              <ul className="list-inside list-disc space-y-2">
                {terms.map((term) => <li key={term}>{term}</li>)}
              </ul>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={agreementAccepted}
                onChange={(event) => setAgreementAccepted(event.target.checked)}
                className="mt-0.5 accent-teal-400"
              />
              <span>I agree to the CODOS Marketplace Commercial &amp; Revenue Share Agreement</span>
            </label>
            <label className="mt-3 block text-xs font-medium text-slate-300">
              Authorized Signatory Name
              <input
                value={signatory}
                onChange={(event) => setSignatory(event.target.value)}
                maxLength={180}
                autoComplete="name"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B1120] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none"
                placeholder="Full legal name"
              />
            </label>
          </section>

          <section>
            <h3 className="text-sm font-bold">Step 2 — Actual Base Price &amp; Profit Tier</h3>
            <label className="mt-3 block text-xs font-medium text-slate-300">
              Actual Base Price ($ USD) — {billingUnit}
              <input
                type="number"
                min="0"
                step="0.000001"
                value={basePrice}
                onChange={(event) => setBasePrice(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B1120] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none"
              />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {commercialPricingTiers.map((tier) => (
                <button
                  key={tier.tier}
                  type="button"
                  aria-pressed={pricingTier === tier.tier}
                  onClick={() => setPricingTier(tier.tier)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    pricingTier === tier.tier
                      ? "border-teal-300 bg-teal-400/10 text-teal-200"
                      : "border-slate-700 bg-[#0B1120] text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <span className="block text-xs font-bold">{tier.tier}</span>
                  <span className="mt-1 block text-sm">{tier.marginPercent}% Profit Margin</span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-teal-400/30 bg-teal-400/5 p-4">
              <h4 className="text-sm font-bold text-slate-100">Live Price Breakdown</h4>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Developer Base Price</dt><dd>{validBasePrice ? money(parsedBasePrice) : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">CODOS Profit ({(marginRate * 100).toFixed(1)}%)</dt><dd>+{validBasePrice ? money(marginAmount) : "—"}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-700 pt-2 text-sm font-bold text-teal-200"><dt>Final Customer Marketplace Price</dt><dd>{validBasePrice ? money(finalRetailPrice) : "—"}</dd></div>
              </dl>
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 bg-[#0B1120] px-5 py-4 sm:px-7">
          <div className="min-w-0 text-xs text-slate-400">
            <CheckCircle2 className="mr-1 inline h-4 w-4 text-teal-300" />
            Sign-off records your name, pricing, tier, and timestamp.
          </div>
          <div className="flex items-center gap-2">
            {error && <p role="alert" className="max-w-xs text-xs text-rose-300">{error}</p>}
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
            <button
              type="button"
              disabled={submitting || !agreementAccepted || !signatory.trim() || !validBasePrice}
              onClick={() => void confirmSignoff()}
              className="rounded-lg bg-teal-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Publishing..." : "Confirm Agreement & Publish Live"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
