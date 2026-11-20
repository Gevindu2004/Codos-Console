import type { CommercialPricingTier } from "@/lib/commercialPricing";

type CommercialPricingDetailsProps = {
  basePrice?: number;
  pricingTier?: CommercialPricingTier | null;
  profitMarginPercent?: number;
  finalRetailPrice?: number;
  agreementSigned?: boolean;
  agreementSignedBy?: string | null;
  agreementSignedAt?: string | null;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6,
  }).format(amount);

export function CommercialPricingDetails({
  basePrice = 0,
  pricingTier,
  profitMarginPercent = 0,
  finalRetailPrice = 0,
  agreementSigned = false,
  agreementSignedBy,
  agreementSignedAt,
}: CommercialPricingDetailsProps) {
  const signedDate = agreementSignedAt ? new Date(agreementSignedAt) : null;
  const signedDateLabel = signedDate && !Number.isNaN(signedDate.getTime())
    ? signedDate.toLocaleString()
    : null;

  return (
    <div className="space-y-1 text-[11px] leading-relaxed">
      <p className="font-semibold text-teal-200">
        {pricingTier ? `${pricingTier} - ${profitMarginPercent}%` : "Pricing tier not set"}
      </p>
      <p className="text-slate-300">Base: {money(basePrice)}</p>
      <p className="font-semibold text-slate-100">Retail: {money(finalRetailPrice)}</p>
      {agreementSigned ? (
        <p className="text-emerald-300">
          Signed by {agreementSignedBy || "authorized signatory"}
          {signedDateLabel ? ` on ${signedDateLabel}` : ""}
        </p>
      ) : (
        <p className="text-amber-300">Agreement not signed</p>
      )}
    </div>
  );
}
