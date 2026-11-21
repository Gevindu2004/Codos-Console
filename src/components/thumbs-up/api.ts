// ThumbsUp Email — small client for the ThumbsUp backend (thumbsup-api/).
// The dashboard uses an httpOnly session cookie, so every call sends credentials.

export const THUMBSUP_API_URL = (
  process.env.NEXT_PUBLIC_THUMBSUP_API_URL || "http://localhost:8001"
).replace(/\/$/, "");

export class TuError extends Error {
  code: string;
  hint?: string;
  status: number;
  constructor(status: number, code: string, message: string, hint?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

type Options = {
  method?: string;
  json?: unknown;
  form?: FormData;
};

export async function tuFetch<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method || (opts.json || opts.form ? "POST" : "GET"),
    credentials: "include",
    headers: {},
  };
  if (opts.json !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.json);
  } else if (opts.form) {
    init.body = opts.form;
  }
  let res: Response;
  try {
    res = await fetch(`${THUMBSUP_API_URL}${path}`, init);
  } catch {
    throw new TuError(0, "server_offline", "Can't reach the ThumbsUp server.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body && body.error) || {};
    throw new TuError(res.status, err.code || "error", err.message || `Request failed (${res.status})`, err.hint);
  }
  return body as T;
}

// ---------------------------------------------------------------- types
export interface TuUser {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: string;
  email_verified: boolean;
  created_at: string;
}

export interface TuKey {
  id: string;
  name: string;
  kind: "secret" | "public";
  prefix: string;
  key: string | null;
  allowed_origins: string[];
  last_used_at: string | null;
  created_at: string;
  revoked: boolean;
}

export interface TuTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  to_emails: string[];
  from_name: string;
  from_email: string;
  allow_public: boolean;
  auto_reply: boolean;
  auto_reply_subject: string;
  auto_reply_text: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export interface TuAttachmentMeta {
  filename: string;
  size: number;
  content_type: string;
  delivery: "attached" | "link";
  expires_at?: string;
}

export interface TuEmail {
  id: string;
  status: "queued" | "sending" | "sent" | "delivered" | "bounced" | "complained" | "failed";
  source: "api" | "form" | "dashboard" | "auto_reply";
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  reply_to: string | null;
  subject: string;
  template_id: string | null;
  attachments: TuAttachmentMeta[];
  tags: string[];
  error: string | null;
  suppressed: string[];
  attempts: number;
  next_attempt_at: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  html?: string;
  text?: string;
  variables?: Record<string, unknown>;
  origin?: string | null;
}

export interface TuStats {
  last_30_days: { total: number; sent: number; failed: number; queued: number };
  today: number;
  daily: { date: string; sent: number; failed: number }[];
  counts: { keys: number; templates: number; webhooks: number; emails_all_time: number };
}

export interface TuWebhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret: string;
  created_at: string;
}

export interface TuWebhookDelivery {
  id: string;
  event: string;
  message_id: string | null;
  success: boolean;
  status_code: number | null;
  attempts: number;
  response: string;
  created_at: string;
}

export interface TuDnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
  required: boolean;
}

export interface TuDomain {
  id: string;
  name: string;
  status: "pending" | "verified" | "failed";
  records: TuDnsRecord[];
  last_checked_at: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface TuSuppression {
  id: string;
  email: string;
  reason: "bounce" | "complaint" | "manual";
  detail: string;
  message_id: string | null;
  created_at: string;
}

export const isFinal = (status: TuEmail["status"]) => status !== "queued" && status !== "sending";

// ---------------------------------------------------------------- helpers
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const t = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z").getTime();
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
  return new Date(t).toLocaleDateString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  return d.toLocaleString();
}

export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// ---------------------------------------------------------------- Drive Assets
export interface TuAssetConfig {
  configured: boolean;
  robot_email: string | null;
  verification_file: string;
  assets_base_url: string;
  max_file_mb: number;
  grace_minutes: number;
  cache_seconds: number;
}

export interface TuAssetProject {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  folder_id: string;
  folder_name: string;
  folder_link: string;
  status: "syncing" | "needs_verification" | "active" | "no_access" | "error";
  verified: boolean;
  verification_file: string;
  syncing: boolean;
  last_error: string | null;
  file_count: number;
  total_bytes: number;
  last_synced_at: string | null;
  created_at: string;
}

export interface TuAssetFile {
  id: string;
  path: string;
  url: string;
  mime_type: string;
  size: number;
  status: "active" | "removed" | "too_large" | "blocked" | "error";
  error: string | null;
  is_google_doc: boolean;
  is_image: boolean;
  modified_at: string | null;
  synced_at: string;
  grace_ends_at: string | null;
}

export interface TuAssetEvent {
  id: string;
  kind: string;
  path: string;
  message: string;
  created_at: string;
}

export interface TuAssetUsage {
  daily: { date: string; hits: number; bytes: number }[];
  last_30_days: { hits: number; bytes: number };
}

// ---------------------------------------------------------------- Sheets (Google Sheets as a database)
export type TuColumnType = "text" | "number" | "boolean" | "email" | "url" | "phone" | "date" | "datetime";

export interface TuSheetColumn {
  name: string;
  type: TuColumnType;
  required: boolean;
}

export interface TuSheetConfig {
  oauth_enabled: boolean;
  robot_enabled: boolean;
  robot_email: string | null;
  picker: { api_key: string; app_id: string } | null;
  types: TuColumnType[];
  limits: { max_tables: number; max_columns: number; max_rows: number; max_batch: number };
}

export interface TuSheetConnection {
  id: string;
  google_email: string;
  status: "active" | "revoked";
  last_error: string | null;
  created_at: string;
}

export interface TuSheetTable {
  id: string;
  name: string;
  columns: TuSheetColumn[];
  system_columns: string[];
  row_count: number;
  allow_public_insert: boolean;
  submit_url: string;
  refreshed_at: string | null;
}

export interface TuSheetDatabase {
  id: string;
  name: string;
  auth_mode: "oauth" | "robot";
  google_email: string | null;
  connection_id: string | null;
  spreadsheet_id: string;
  spreadsheet_title: string;
  spreadsheet_url: string;
  status: "active" | "needs_verification" | "no_access" | "error";
  verified: boolean;
  verification_code: string | null;
  last_error: string | null;
  pending_writes: number;
  failed_writes: number;
  last_synced_at: string | null;
  created_at: string;
  tables: TuSheetTable[];
}

export interface TuSheetChange {
  op: string;
  table: string;
  columns?: TuSheetColumn[];
  column?: TuSheetColumn | string;
  to?: string;
  type?: string;
  required?: boolean;
  position?: number;
}

export interface TuSheetDetect {
  kind: string;
  changes: TuSheetChange[];
  warnings: string[];
}

export interface TuSheetApply {
  steps: TuSheetChange[];
  descriptions: string[];
  applied: boolean;
  skipped: boolean;
  database: TuSheetDatabase;
}

export type TuSheetRow = { id: string; created_at: string | null; updated_at: string | null } & Record<string, unknown>;

export interface TuSheetEvent {
  id: string;
  kind: string;
  message: string;
  created_at: string;
}

export interface TuSheetMigration {
  id: string;
  name: string;
  source: string;
  descriptions: string[];
  created_at: string;
}
