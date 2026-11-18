import { developerApi } from "./developerApi";
import { skybeakApi, type CatalogModel } from "./skybeakApi";
import type {
  MarketplaceModel,
  ModelCategory,
  PricingModel,
} from "@/components/model-hub/types";

const fallbackSkyBeakModels: CatalogModel[] = [
  {
    id: "skybeak-general-llama3",
    name: "Meta-Llama-3-8B-Instruct",
    category: "general",
    industry: null,
    base_hf_repo: "meta-llama/Meta-Llama-3-8B-Instruct",
    adapter_name: null,
    description: "Via Codos general-purpose reasoning and instruction model.",
    default_system_prompt: "You are a helpful, accurate AI assistant.",
  },
  {
    id: "skybeak-general-qwen25",
    name: "Qwen2.5-7B-Instruct",
    category: "general",
    industry: null,
    base_hf_repo: "Qwen/Qwen2.5-7B-Instruct",
    adapter_name: null,
    description: "Fast multilingual instruction model for coding and enterprise workflows.",
    default_system_prompt: "You are Qwen, a concise and capable coding assistant.",
  },
  {
    id: "skybeak-sme-v4",
    name: "SkyBeak SME Daily Business v4",
    category: "industry",
    industry: "SME & Daily Business",
    base_hf_repo: "meta-llama/Meta-Llama-3-8B-Instruct",
    adapter_name: "sme_v4",
    description: "RAG-aware champion model for SME operations, SOPs, invoicing, and daily business.",
    default_system_prompt: "You are SkyBeak SME Business AI. Use retrieved context to provide accurate operational guidance.",
  },
  {
    id: "skybeak-retail-ecom-mfg-v4",
    name: "SkyBeak Retail, E-commerce & Manufacturing v4",
    category: "industry",
    industry: "Retail, E-commerce & Manufacturing",
    base_hf_repo: "meta-llama/Meta-Llama-3-8B-Instruct",
    adapter_name: "retail_ecom_mfg_v4",
    description: "Specialized support for retail, commerce, inventory, returns, and manufacturing quality.",
    default_system_prompt: "You are SkyBeak Retail & Manufacturing AI.",
  },
  {
    id: "skybeak-healthcare-v4",
    name: "SkyBeak Healthcare & Clinical v4",
    category: "industry",
    industry: "Healthcare",
    base_hf_repo: "meta-llama/Meta-Llama-3-8B-Instruct",
    adapter_name: "healthcare_v4",
    description: "RAG-aware clinical and healthcare assistant fine-tuned for controlled enterprise knowledge.",
    default_system_prompt: "You are SkyBeak Healthcare AI.",
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeSkyBeak(model: CatalogModel): MarketplaceModel {
  const industry = model.category === "industry";
  const latency = model.adapter_name ? 680 : 420;
  return {
    id: model.id,
    slug: slugify(model.name),
    name: model.name,
    tagline: industry
      ? `Industry-tuned ${model.industry ?? "AI"} specialist`
      : "High-performance instruction model",
    description: model.description,
    providerType: "via_codos",
    developerName: "Via Codos",
    developerVerified: true,
    supportContact: "support@viacodos.com",
    category: industry ? "Industry-specific AI" : "Text generation & LLMs",
    version: model.adapter_name ? "v4" : "2024",
    architecture: model.base_hf_repo.includes("Llama") ? "Decoder-only Transformer" : "Decoder-only Transformer",
    framework: "PyTorch",
    baseModel: model.base_hf_repo,
    license: model.base_hf_repo.includes("Meta") ? "Llama 3 Community License" : "Apache 2.0",
    hostingMethod: "codos_hosted",
    supportedLanguages: ["English", "Spanish", "French", "German", "Portuguese"],
    useCases: industry
      ? ["Domain Q&A", "Document-grounded assistance", "Operational automation"]
      : ["Text generation", "Coding assistance", "Enterprise chat"],
    limitations: "May require domain-specific retrieval context for regulated or highly specialized decisions.",
    inputSchema: {
      type: "object",
      properties: {
        systemPrompt: { type: "string", description: "System instructions" },
        prompt: { type: "string", description: "User prompt" },
        temperature: { type: "number", minimum: 0, maximum: 2 },
        maxTokens: { type: "integer", minimum: 64, maximum: 4096 },
      },
      required: ["prompt"],
    },
    outputSchema: {
      type: "object",
      properties: {
        response: { type: "string" },
        usage: { type: "object" },
        latencyMs: { type: "number" },
      },
    },
    sampleInputs: [
      "Summarize the key risks in this quarterly operations report.",
      "Draft a clear response to a customer support escalation.",
      "Create a production-safe SQL troubleshooting plan.",
    ],
    pricingModel: "per_token",
    priceDisplay: "$0.0008",
    unitLabel: "per 1K tokens",
    freeTierAllowance: "50,000 tokens",
    avgLatencyMs: latency,
    status: "Published",
    inputType: "Text",
    skybeakCatalogId: model.id,
    plans: [
      { name: "Pay as you go", description: "Flexible token billing", price: "$0.0008 / 1K tokens" },
      { name: "Developer", description: "Monthly quota and priority routing", price: "$49 / month" },
    ],
  };
}

const representativeModels: MarketplaceModel[] = [
  {
    id: "third-ocr-document-pro",
    slug: "document-ocr-pro",
    name: "Document OCR Pro",
    tagline: "Structured extraction from complex documents",
    description: "Extract tables, signatures, key-value pairs, and clean text from PDFs and images.",
    providerType: "third_party",
    developerName: "Nimbus Vision Labs",
    developerVerified: true,
    supportContact: "support@nimbusvision.dev",
    category: "Document processing",
    version: "2.4",
    architecture: "Vision Transformer + OCR",
    framework: "ONNX",
    baseModel: "Nimbus-OCR-3",
    license: "Commercial",
    hostingMethod: "developer_hosted",
    supportedLanguages: ["English", "Sinhala", "Tamil", "Hindi", "Arabic"],
    useCases: ["Invoice processing", "KYC extraction", "Table recognition"],
    limitations: "Handwriting and low-resolution scans may reduce extraction confidence.",
    inputSchema: { type: "object", properties: { file: { type: "string", format: "binary" }, language: { type: "string" } }, required: ["file"] },
    outputSchema: { type: "object", properties: { text: { type: "string" }, fields: { type: "object" }, tables: { type: "array" } } },
    sampleInputs: ["sample-invoice.pdf", "sample-scan.png"],
    pricingModel: "per_inference",
    priceDisplay: "$0.012",
    unitLabel: "per document",
    freeTierAllowance: "25 documents",
    avgLatencyMs: 860,
    status: "Published",
    inputType: "Document",
    acceptedFormats: ["application/pdf", "image/png", "image/jpeg"],
    maxFileSizeMb: 20,
  },
  {
    id: "third-speech-to-text",
    slug: "speech-to-text-enterprise",
    name: "Speech-to-Text Enterprise",
    tagline: "Accurate transcription with speaker diarization",
    description: "Transcribe meetings and calls with timestamps, language detection, and speaker separation.",
    providerType: "third_party",
    developerName: "Voxline Systems",
    developerVerified: true,
    supportContact: "api@voxline.ai",
    category: "Speech recognition",
    version: "1.8",
    architecture: "Conformer Encoder",
    framework: "TensorFlow",
    baseModel: "Voxline-ASR-Large",
    license: "Commercial",
    hostingMethod: "codos_hosted",
    supportedLanguages: ["English", "Sinhala", "Tamil", "Hindi"],
    useCases: ["Call transcription", "Meeting notes", "Content indexing"],
    limitations: "Very noisy environments may require a custom vocabulary.",
    inputSchema: { type: "object", properties: { file: { type: "string", format: "binary" }, language: { type: "string" } }, required: ["file"] },
    outputSchema: { type: "object", properties: { transcript: { type: "string" }, segments: { type: "array" }, language: { type: "string" } } },
    sampleInputs: ["sample-meeting.wav", "sample-support-call.mp3"],
    pricingModel: "per_audio_minute",
    priceDisplay: "$0.006",
    unitLabel: "per audio minute",
    freeTierAllowance: "30 minutes",
    avgLatencyMs: 1250,
    status: "Published",
    inputType: "Audio",
    acceptedFormats: ["audio/wav", "audio/mpeg", "audio/mp4"],
    maxFileSizeMb: 100,
  },
  {
    id: "third-image-studio",
    slug: "image-generation-studio",
    name: "PixelForge Image Studio",
    tagline: "Production-ready branded visual generation",
    description: "Generate and refine high-resolution marketing, product, and concept imagery.",
    providerType: "third_party",
    developerName: "PixelForge AI",
    developerVerified: true,
    supportContact: "support@pixelforge.ai",
    category: "Image generation & editing",
    version: "3.1",
    architecture: "Diffusion Transformer",
    framework: "PyTorch",
    baseModel: "PixelForge-Diffusion-XL",
    license: "Commercial",
    hostingMethod: "developer_hosted",
    supportedLanguages: ["English"],
    useCases: ["Campaign assets", "Product mockups", "Image editing"],
    limitations: "Generated faces and fine text should be reviewed before publication.",
    inputSchema: { type: "object", properties: { prompt: { type: "string" }, resolution: { type: "string" }, style: { type: "string" } }, required: ["prompt"] },
    outputSchema: { type: "object", properties: { imageUrl: { type: "string" }, seed: { type: "integer" } } },
    sampleInputs: ["A modern Sri Lankan fintech office at sunrise", "Premium reusable bottle product shot"],
    pricingModel: "per_image",
    priceDisplay: "$0.035",
    unitLabel: "per generated image",
    freeTierAllowance: "10 images",
    avgLatencyMs: 3200,
    status: "Published",
    inputType: "Image",
  },
];

const extraRepresentativeModels: MarketplaceModel[] = [
  {
    id: "third-text-to-speech",
    slug: "neural-voice-studio",
    name: "Neural Voice Studio",
    tagline: "Natural multilingual voice synthesis",
    description: "Convert scripts into natural speech with pronunciation controls and SSML.",
    providerType: "third_party",
    developerName: "Auralis Labs",
    developerVerified: true,
    supportContact: "hello@auralislabs.ai",
    category: "Text-to-speech",
    version: "1.5",
    architecture: "Neural Codec",
    framework: "PyTorch",
    baseModel: "Auralis-TTS-XL",
    license: "Commercial",
    hostingMethod: "codos_hosted",
    supportedLanguages: ["English", "Sinhala", "Tamil", "Hindi"],
    useCases: ["IVR", "Audiobooks", "Accessibility"],
    limitations: "Custom speaker cloning requires separate consent and verification.",
    inputSchema: { type: "object", properties: { text: { type: "string" }, voice: { type: "string" }, language: { type: "string" } }, required: ["text"] },
    outputSchema: { type: "object", properties: { audioUrl: { type: "string" }, durationSeconds: { type: "number" } } },
    sampleInputs: ["Welcome to CODOS Console."],
    pricingModel: "per_audio_minute",
    priceDisplay: "$0.012",
    unitLabel: "per audio minute",
    freeTierAllowance: "10 minutes",
    avgLatencyMs: 980,
    status: "Published",
    inputType: "Audio",
  },
  {
    id: "third-image-inspector",
    slug: "visual-quality-inspector",
    name: "Visual Quality Inspector",
    tagline: "Detect defects and classify visual assets",
    description: "Inspect manufacturing and retail images for anomalies and classification labels.",
    providerType: "third_party",
    developerName: "ForgeSight",
    developerVerified: true,
    supportContact: "support@forgesight.ai",
    category: "Image recognition",
    version: "2.0",
    architecture: "Vision Transformer",
    framework: "TensorRT",
    baseModel: "ForgeSight-ViT",
    license: "Commercial",
    hostingMethod: "developer_hosted",
    supportedLanguages: ["English"],
    useCases: ["Defect detection", "Inventory classification", "Visual audits"],
    limitations: "Requires representative calibration images for a new defect taxonomy.",
    inputSchema: { type: "object", properties: { file: { type: "string", format: "binary" }, threshold: { type: "number" } }, required: ["file"] },
    outputSchema: { type: "object", properties: { detections: { type: "array" }, confidence: { type: "number" } } },
    sampleInputs: ["sample-defect.jpg"],
    pricingModel: "per_image",
    priceDisplay: "$0.018",
    unitLabel: "per image",
    freeTierAllowance: "50 images",
    avgLatencyMs: 740,
    status: "Published",
    inputType: "Image",
    acceptedFormats: ["image/png", "image/jpeg"],
    maxFileSizeMb: 15,
  },
  {
    id: "third-data-analyst",
    slug: "data-insights-analyst",
    name: "Data Insights Analyst",
    tagline: "Natural-language analytics for tabular data",
    description: "Upload structured datasets and receive summaries, forecasts, and anomaly detection.",
    providerType: "third_party",
    developerName: "MetricCore",
    developerVerified: true,
    supportContact: "team@metriccore.ai",
    category: "Data analysis",
    version: "1.9",
    architecture: "Hybrid SQL + LLM",
    framework: "Python",
    baseModel: "MetricCore-Analyst",
    license: "Commercial",
    hostingMethod: "codos_hosted",
    supportedLanguages: ["English"],
    useCases: ["Revenue analysis", "Anomaly detection", "Forecasting"],
    limitations: "Recommendations should be validated for sensitive financial decisions.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, dataset: { type: "string", format: "binary" } }, required: ["dataset", "query"] },
    outputSchema: { type: "object", properties: { summary: { type: "string" }, metrics: { type: "object" }, chart: { type: "object" } } },
    sampleInputs: ["sales.csv"],
    pricingModel: "subscription",
    priceDisplay: "$29",
    unitLabel: "per month",
    freeTierAllowance: "2 datasets",
    avgLatencyMs: 1100,
    status: "Published",
    inputType: "Document",
  },
  {
    id: "third-video-director",
    slug: "video-caption-studio",
    name: "Video Caption Studio",
    tagline: "Timed captions and scene summaries",
    description: "Analyze video speech and scenes to create multilingual captions and chapter summaries.",
    providerType: "third_party",
    developerName: "SceneWeave",
    developerVerified: true,
    supportContact: "api@sceneweave.dev",
    category: "Video generation & editing",
    version: "1.2",
    architecture: "Multimodal Transformer",
    framework: "PyTorch",
    baseModel: "SceneWeave-MM",
    license: "Commercial",
    hostingMethod: "developer_hosted",
    supportedLanguages: ["English", "Sinhala", "Tamil"],
    useCases: ["Captioning", "Video chapters", "Content moderation"],
    limitations: "Very fast scene changes may reduce chapter accuracy.",
    inputSchema: { type: "object", properties: { file: { type: "string", format: "binary" }, language: { type: "string" } }, required: ["file"] },
    outputSchema: { type: "object", properties: { captions: { type: "array" }, chapters: { type: "array" } } },
    sampleInputs: ["sample-product-demo.mp4"],
    pricingModel: "per_video_minute",
    priceDisplay: "$0.09",
    unitLabel: "per video minute",
    freeTierAllowance: "5 minutes",
    avgLatencyMs: 2800,
    status: "Published",
    inputType: "Video",
    acceptedFormats: ["video/mp4", "video/webm"],
    maxFileSizeMb: 200,
  },
];

function normalizeDeveloperModels(payloads: Awaited<ReturnType<typeof developerApi.listModels>>): MarketplaceModel[] {
  return payloads
    .filter((payload) => payload.status === "Published" || payload.status === "Approved")
    .map((payload, index) => {
      const form = payload.formA;
      const category = (form.category || "Text generation & LLMs") as ModelCategory;
      const validCategory = [
        "Text generation & LLMs",
        "Image generation & editing",
        "Video generation & editing",
        "Speech recognition",
        "Text-to-speech",
        "Document processing",
        "Image recognition",
        "Data analysis",
        "Industry-specific AI",
      ].includes(category) ? category : "Text generation & LLMs";
      const billing = payload.formE.billingUnit as PricingModel;
      const schemaInputType = payload.formC.inputType;
      const inputType = schemaInputType === "audio"
        ? "Audio"
        : schemaInputType === "image"
          ? "Image"
          : schemaInputType === "video"
            ? "Video"
            : schemaInputType === "document"
              ? "Document"
              : "Text";
      return {
        id: `developer-model-${index}`,
        slug: slugify(form.modelName || `developer-model-${index}`),
        name: form.modelName,
        tagline: form.shortDescription,
        description: form.detailedDescription,
        providerType: "third_party",
        developerName: form.developerId || "Independent Developer",
        developerVerified: true,
        supportContact: "support@developer.example",
        category: validCategory,
        version: form.version || "1.0",
        architecture: form.architecture || "Published model",
        framework: form.framework || "Custom",
        baseModel: form.baseModel || "Developer-provided",
        license: payload.formF.baseModelLicense || "Developer license",
        hostingMethod: payload.formB.hostingMethod === "developer_hosted" ? "developer_hosted" : "codos_hosted",
        supportedLanguages: form.supportedLanguages || ["English"],
        useCases: form.useCases || [],
        limitations: payload.formD.knownLimitations || "No limitations provided.",
        inputSchema: payload.formC.schemaJson ? (() => {
          try {
            return JSON.parse(payload.formC.schemaJson) as Record<string, unknown>;
          } catch {
            return { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] };
          }
        })() : { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] },
        outputSchema: { type: "object", properties: { response: { type: "string" } } },
        sampleInputs: payload.formD.sampleInputs || [],
        pricingModel: ["free", "per_token", "per_inference", "per_image", "per_video_minute", "per_audio_minute", "subscription", "credit_package"].includes(billing)
          ? billing
          : "per_inference",
        priceDisplay: payload.formE.rate ? `$${payload.formE.rate}` : "Free",
        unitLabel: payload.formE.billingUnit === "per_token" ? "per token" : "per inference",
        freeTierAllowance: "Developer-defined trial",
        avgLatencyMs: payload.formB.expectedLatencyMs || 900,
        status: payload.status as "Published" | "Approved",
        inputType,
        acceptedFormats: payload.formC.inputFormats,
        maxFileSizeMb: payload.formC.maxInputSizeMb,
      };
    });
}

export async function getMarketplaceModels(): Promise<MarketplaceModel[]> {
  let skyModels = fallbackSkyBeakModels;
  try {
    const catalog = await skybeakApi.getCatalog();
    if (catalog.general_models.length || catalog.industry_models.length) {
      skyModels = [...catalog.general_models, ...catalog.industry_models];
    }
  } catch {
    // The catalog fallback keeps the Model Hub useful if the backend is offline.
  }

  let developerModels: MarketplaceModel[] = [];
  try {
    const payloads = await developerApi.listModels("dev-123");
    developerModels = normalizeDeveloperModels(payloads);
  } catch {
    developerModels = [];
  }

  return [
    ...skyModels.map(normalizeSkyBeak),
    ...developerModels,
    ...representativeModels,
    ...extraRepresentativeModels,
  ];
}

export async function getMarketplaceModelBySlug(slug: string): Promise<MarketplaceModel | null> {
  const models = await getMarketplaceModels();
  return models.find((model) => model.slug === slug) ?? null;
}
