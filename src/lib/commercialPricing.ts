export const commercialPricingTiers = [
  { tier: "Tier 1", marginPercent: 25.0, marginRate: 0.25 },
  { tier: "Tier 2", marginPercent: 17.5, marginRate: 0.175 },
  { tier: "Tier 3", marginPercent: 12.5, marginRate: 0.125 },
] as const;

export type CommercialPricingTier = (typeof commercialPricingTiers)[number]["tier"];

export interface CommercialSignoffInput {
  base_price: number;
  pricing_tier: CommercialPricingTier;
  agreement_signed: true;
  agreement_signed_by: string;
}

export function getCommercialPricingTier(tier: CommercialPricingTier) {
  return commercialPricingTiers.find((entry) => entry.tier === tier)!;
}

export function calculateFinalRetailPrice(basePrice: number, tier: CommercialPricingTier): number {
  const { marginRate } = getCommercialPricingTier(tier);
  return Math.round(basePrice * (1 + marginRate) * 1_000_000) / 1_000_000;
}
