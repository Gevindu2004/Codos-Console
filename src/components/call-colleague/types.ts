export type IndustryType = "salon" | "clinic" | "travel" | "legal" | "custom";

export type PlanTier = "starter" | "growth" | "enterprise";

export type TelephonySetupType =
  | "new_dedicated_number"
  | "call_forwarding"
  | "sip_pbx_trunk";

export type PhoneCountry = "US" | "GB" | "AU";
export type PhoneNumberType = "local" | "mobile" | "tollfree";

export interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  country: PhoneCountry;
  numberType: PhoneNumberType;
  monthlyPrice: string;
  requiresBundle: boolean;
  capabilities?: { voice?: boolean; sms?: boolean };
}

export interface ByoTwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export interface OperatingHour {
  day: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  staffMember?: string;
  price: number;
  durationMinutes: number;
  description: string;
}

export interface DepartmentRoute {
  id: string;
  name: string;
  phoneNumber: string;
  description: string;
}

export interface KnowledgeFAQ {
  id: string;
  question: string;
  answer: string;
  category: "policy" | "parking" | "pricing" | "general";
}

export interface VoicePersona {
  id: string;
  name: string;
  gender: string;
  accent: string;
  tone: string;
  previewText: string;
}

export interface SipTrunkConfig {
  sipUri: string;
  authUsername: string;
  transport: "UDP" | "TCP" | "TLS";
}

export interface CarrierForwardingGuide {
  id: string;
  name: string;
  country: string;
  forwardAll: string;
  forwardBusyNoAnswer: string;
  cancelForwarding: string;
}

export interface AgentProvisionPayload {
  businessName: string;
  industry: IndustryType;
  timezone: string;
  operatingHours: OperatingHour[];
  services: ServiceItem[];
  departments: DepartmentRoute[];
  knowledgeFaqs: KnowledgeFAQ[];
  voicePersona: VoicePersona;
  googleCalendarConnected: boolean;
  calendarEmail: string;
  telephonySetupType: TelephonySetupType;
  forwardingNumber: string;
  selectedCarrierId: string;
  isNumberVerified: boolean;
  sipConfig: SipTrunkConfig;
  planTier: PlanTier;
  phoneCountry?: PhoneCountry;
  selectedPhoneNumber?: string;
  byoTwilio?: ByoTwilioConfig;
}

export interface ProvisionResponse {
  agentId: string;
  virtualPhoneNumber: string;
  sipEndpointUri?: string;
  status: "active" | "provisioning";
}

export interface CallLogItem {
  id: string;
  callerName: string;
  callerPhone: string;
  timestamp: string;
  duration: string;
  status: "booked" | "transferred" | "completed" | "missed";
  sentiment: "positive" | "neutral" | "urgent";
  summary: string;
  serviceRequested?: string;
  recordingUrl?: string;
  transcript: { role: "agent" | "user"; text: string }[];
}

export interface AppointmentItem {
  id: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  staffMember: string;
  dateTime: string;
  durationMinutes: number;
  price: number;
  status: "confirmed" | "rescheduled" | "cancelled";
  bookedVia: "AI Voice Receptionist" | "Manual";
}

export interface AdminUser {
  id: string;
  googleCalendarConnected?: boolean;
  calendarEmail?: string;
  email: string;
  businessName: string;
  industry: IndustryType;
  virtualPhoneNumber: string;
  agentActive: boolean;
  planTier: PlanTier;
  timezone: string;
  voicePersona: VoicePersona;
  services: ServiceItem[];
  departments: DepartmentRoute[];
  knowledgeFaqs: KnowledgeFAQ[];
  operatingHours: OperatingHour[];
}

export type CallColleagueView =
  | "onboarding"
  | "success"
  | "login"
  | "dashboard";
