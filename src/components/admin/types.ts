import type {
  ApiSubmissionPayload,
  AuditLogEntry,
  DeveloperProfile,
  ModelSubmissionPayload,
  ProductType,
} from "@/components/developer/types";
import type { CommercialPricingTier } from "@/lib/commercialPricing";

export type { ProductType, SubmissionStatus } from "@/components/developer/types";

export interface AdminDeveloperApplication extends Pick<
  DeveloperProfile,
  "developerName" | "companyName" | "email" | "emailVerified" | "country" | "website" | "supportContact"
> {
  id: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  reviewNotes: string;
}

export type AutomatedCheckStatus = "pending" | "pass" | "warn" | "fail";
export type AutomatedCheckKey =
  | "httpsEndpoint"
  | "schemaValidation"
  | "authSecurity"
  | "sandboxInference"
  | "legalCompliance";

export interface AutomatedCheckResult {
  status: AutomatedCheckStatus;
  summary: string;
  checkedAt?: string;
}

export type AdminSubmissionPayload = ApiSubmissionPayload | ModelSubmissionPayload;

interface AdminSubmissionBase {
  id: string;
  marketplaceProductId?: string;
  developerId?: string;
  slug?: string;
  developerName: string;
  providerType: "via_codos" | "third_party";
  automatedChecks: Record<AutomatedCheckKey, AutomatedCheckResult>;
  reviewNotes: string;
  submittedAt: string;
  basePrice?: number;
  pricingTier?: CommercialPricingTier | null;
  profitMarginPercent?: number;
  finalRetailPrice?: number;
  agreementSigned?: boolean;
  agreementSignedBy?: string | null;
  agreementSignedAt?: string | null;
  agreementVersion?: string;
}

export type AdminSubmissionItem = AdminSubmissionBase & (
  | { productType: "api"; payload: ApiSubmissionPayload }
  | { productType: "model"; payload: ModelSubmissionPayload }
);

export interface AdminLiveProduct {
  id: string;
  slug: string;
  name: string;
  productType: ProductType;
  providerType: "via_codos" | "third_party";
  developerName: string;
  status: "Published" | "Suspended" | "Unpublished";
  featured: boolean;
  updatedAt: string;
  basePrice?: number;
  pricingTier?: CommercialPricingTier | null;
  profitMarginPercent?: number;
  finalRetailPrice?: number;
  agreementSigned?: boolean;
  agreementSignedBy?: string | null;
  agreementSignedAt?: string | null;
  agreementVersion?: string;
  complianceReason?: string;
  submissionId?: string;
}

export interface AdminPayoutBatch {
  id: string;
  developerId: string;
  developerName: string;
  period: string;
  grossRevenue: number;
  commissionRate: number;
  platformFee: number;
  netPayout: number;
  method: string;
  status: "Pending Approval" | "Processing" | "Paid";
  reference: string;
}

export interface GovernanceAuditEvent extends AuditLogEntry {
  id: string;
  actor: string;
  category: "Developer" | "Submission" | "Catalog" | "Payout" | "Configuration";
  target: string;
  action: string;
  statusTransition?: string;
  notes: string;
}

export interface AdminState {
  developers: AdminDeveloperApplication[];
  submissions: AdminSubmissionItem[];
  liveProducts: AdminLiveProduct[];
  payouts: AdminPayoutBatch[];
  auditEvents: GovernanceAuditEvent[];
  commissionRate: number;
}
