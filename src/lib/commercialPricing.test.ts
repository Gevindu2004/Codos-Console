import { describe, expect, it } from "vitest";
import { calculateFinalRetailPrice, commercialPricingTiers } from "./commercialPricing";

describe("commercial pricing tiers", () => {
  it("uses the three configured margin rates", () => {
    expect(commercialPricingTiers.map(({ marginPercent }) => marginPercent)).toEqual([25, 17.5, 12.5]);
  });

  it("rounds retail prices to six decimal places", () => {
    expect(calculateFinalRetailPrice(10, "Tier 1")).toBe(12.5);
    expect(calculateFinalRetailPrice(10, "Tier 2")).toBe(11.75);
    expect(calculateFinalRetailPrice(10, "Tier 3")).toBe(11.25);
    expect(calculateFinalRetailPrice(0.1234567, "Tier 1")).toBe(0.154321);
  });
});
