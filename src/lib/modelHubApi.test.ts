import { afterEach, describe, expect, it, vi } from "vitest";
import { developerApi } from "./developerApi";
import { skybeakApi } from "./skybeakApi";
import { getMarketplaceModels } from "./modelHubApi";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Model Hub catalog", () => {
  it("supplements partial SkyBeak catalogs without duplicating models", async () => {
    vi.spyOn(skybeakApi, "getCatalog").mockResolvedValue({
      general_models: [
        {
          id: "live-llama",
          name: "Meta-Llama-3-8B-Instruct",
          category: "general",
          industry: null,
          base_hf_repo: "meta-llama/Meta-Llama-3-8B-Instruct",
          adapter_name: null,
          description: "Live SkyBeak catalog entry",
          default_system_prompt: "Be helpful.",
        },
      ],
      industry_models: [],
    });
    vi.spyOn(developerApi, "listModels").mockResolvedValue([]);

    const models = await getMarketplaceModels();
    const matchingModels = models.filter((model) => model.slug === "meta-llama-3-8b-instruct");

    expect(matchingModels).toHaveLength(1);
    expect(matchingModels[0].description).toBe("Live SkyBeak catalog entry");
    expect(matchingModels[0].providerType).toBe("via_codos");
    expect(models.some((model) => model.slug === "skybeak-healthcare-clinical-v4")).toBe(true);
    expect(models.some((model) => model.providerType === "third_party")).toBe(true);
  });
});
