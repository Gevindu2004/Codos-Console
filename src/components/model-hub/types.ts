export type ProviderType = "via_codos" | "third_party";

export type ModelCategory =
  | "Text generation & LLMs"
  | "Image generation & editing"
  | "Video generation & editing"
  | "Speech recognition"
  | "Text-to-speech"
  | "Document processing"
  | "Image recognition"
  | "Data analysis"
  | "Industry-specific AI";

export type PricingModel =
  | "per_token"
  | "per_inference"
  | "per_image"
  | "per_video_minute"
  | "per_audio_minute"
  | "subscription"
  | "credit_package";

export type ModelStatus =
  | "Published"
  | "Approved"
  | "Suspended"
  | "Unpublished";

export type InputType = "Text" | "Image" | "Audio" | "Video" | "Document";

export interface MarketplaceModel {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  providerType: ProviderType;
  developerName: string;
  developerVerified: boolean;
  supportContact: string;
  category: ModelCategory;
  version: string;
  architecture: string;
  framework: string;
  baseModel: string;
  license: string;
  hostingMethod: "codos_hosted" | "developer_hosted";
  supportedLanguages: string[];
  useCases: string[];
  limitations: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  sampleInputs: string[];
  pricingModel: PricingModel;
  priceDisplay: string;
  unitLabel: string;
  avgLatencyMs: number;
  status: ModelStatus;
  inputType: InputType;
  acceptedFormats?: string[];
  maxFileSizeMb?: number;
  skybeakCatalogId?: string;
  plans?: Array<{
    name: string;
    description: string;
    price: string;
  }>;
}
