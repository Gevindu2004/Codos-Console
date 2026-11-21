import { describe, expect, it } from "vitest";
import { generateMarketplaceIntegrationMetadata } from "./developerApi";

describe("marketplace integration metadata", () => {
  it("generates API snippets for the first OpenAPI operation through the CODOS gateway", () => {
    const metadata = generateMarketplaceIntegrationMetadata("api", "currency-api", {
      paths: {
        "/v1/rates": {
          post: { requestBody: {} },
        },
      },
    });

    expect(metadata.gateway_url).toBe("http://localhost:8000/api/v1/gateway/currency-api");
    expect(metadata.public_page_url).toBe("/apis/currency-api");
    expect(metadata.integration_snippets.curl).toContain(
      "curl --request POST 'http://localhost:8000/api/v1/gateway/currency-api/v1/rates'",
    );
    expect(metadata.integration_snippets.typescript).toContain('"X-CODOS-API-Key"');
    expect(metadata.integration_snippets.python).not.toContain("developer.example");
  });

  it("uses the model inference path and POST body in starter snippets", () => {
    const metadata = generateMarketplaceIntegrationMetadata(
      "model",
      "text-model",
      null,
      { inference_path: "/v1/infer" },
    );

    expect(metadata.public_page_url).toBe("/models/text-model");
    expect(metadata.integration_snippets.curl).toContain(
      "curl --request POST 'http://localhost:8000/api/v1/gateway/text-model/v1/infer'",
    );
    expect(metadata.integration_snippets.python).toContain('json={"input": "your input"}');
  });
});
