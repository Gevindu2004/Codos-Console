"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AdminUser,
  AppointmentItem,
  CallColleagueView,
  CallLogItem,
  DepartmentRoute,
  IndustryType,
  KnowledgeFAQ,
  OperatingHour,
  PhoneCountry,
  PlanTier,
  ServiceItem,
  SipTrunkConfig,
  TelephonySetupType,
  VoicePersona,
} from "./types";
import {
  CARRIER_FORWARDING_CODES,
  DEFAULT_OPERATING_HOURS,
  INDUSTRY_TEMPLATES,
  VOICE_PERSONAS,
} from "./industryTemplates";
import {
  DEMO_TENANT_PRESETS,
  MOCK_APPOINTMENTS,
  MOCK_CALL_LOGS,
} from "./mockAdminData";

export interface OnboardingStoreState {
  currentStep: number;
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
  phoneCountry: PhoneCountry;
  selectedPhoneNumber: string;
  provisionedAgentId: string | null;
  virtualPhoneNumber: string | null;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setBusinessInfo: (info: {
    businessName?: string;
    industry?: IndustryType;
    timezone?: string;
  }) => void;
  applyIndustryTemplate: (industry: IndustryType) => void;
  updateOperatingHour: (day: string, updates: Partial<OperatingHour>) => void;
  addService: (service: ServiceItem) => void;
  removeService: (id: string) => void;
  addDepartment: (dept: DepartmentRoute) => void;
  removeDepartment: (id: string) => void;
  addFaq: (faq: KnowledgeFAQ) => void;
  removeFaq: (id: string) => void;
  setVoicePersona: (persona: VoicePersona) => void;
  setGoogleCalendarConnected: (connected: boolean) => void;
  setCalendarEmail: (email: string) => void;
  setTelephonySetupType: (type: TelephonySetupType) => void;
  setForwardingNumber: (num: string) => void;
  setSelectedCarrierId: (id: string) => void;
  setNumberVerified: (verified: boolean) => void;
  setSipConfig: (config: Partial<SipTrunkConfig>) => void;
  setPlanTier: (tier: PlanTier) => void;
  setPhoneCountry: (country: PhoneCountry) => void;
  setSelectedPhoneNumber: (num: string) => void;
  setProvisionedResult: (agentId: string, phoneNumber: string) => void;
  resetWizard: () => void;
}

export type VapiSyncStatus = "idle" | "syncing" | "synced" | "failed";

export interface AdminStoreState {
  user: AdminUser | null;
  agents: AdminUser[];
  vapiSyncStatus: VapiSyncStatus;
  isAuthenticated: boolean;
  callLogs: CallLogItem[];
  appointments: AppointmentItem[];

  login: (email: string, businessName?: string) => void;
  logout: () => void;
  selectAgent: (agentId: string) => void;
  toggleAgentActive: () => void;
  updateUser: (updates: Partial<AdminUser>) => void;
  setAdminVoicePersona: (persona: VoicePersona) => void;

  addAdminService: (service: ServiceItem) => void;
  updateAdminService: (id: string, updates: Partial<ServiceItem>) => void;
  removeAdminService: (id: string) => void;

  addAdminDepartment: (dept: DepartmentRoute) => void;
  updateAdminDepartment: (
    id: string,
    updates: Partial<DepartmentRoute>
  ) => void;
  removeAdminDepartment: (id: string) => void;

  addAdminFaq: (faq: KnowledgeFAQ) => void;
  updateAdminFaq: (id: string, updates: Partial<KnowledgeFAQ>) => void;
  removeAdminFaq: (id: string) => void;
  updateAdminOperatingHour: (
    day: string,
    updates: Partial<OperatingHour>
  ) => void;

  updateAppointmentStatus: (
    id: string,
    status: AppointmentItem["status"]
  ) => void;
  rescheduleAppointment: (id: string, newDateTime: string) => void;
  simulateIncomingCall: () => void;
  switchDemoTenant: (preset: "salon" | "clinic") => void;
}

export interface NavigationContextValue {
  activeView: CallColleagueView;
  navigateTo: (view: CallColleagueView) => void;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

const initialTemplate = INDUSTRY_TEMPLATES.salon;

const DEFAULT_ADMIN_USER: AdminUser = {
  id: "usr_demo_01",
  email: "owner@luxehairlounge.com",
  businessName: initialTemplate.defaultBusinessName,
  industry: "salon",
  virtualPhoneNumber: "+1 (888) 412-9940",
  agentActive: true,
  planTier: "growth",
  timezone: "America/New_York",
  voicePersona: VOICE_PERSONAS[0],
  services: initialTemplate.defaultServices,
  departments: initialTemplate.defaultDepartments,
  knowledgeFaqs: initialTemplate.defaultFaqs,
  operatingHours: DEFAULT_OPERATING_HOURS,
};

const OnboardingContext = createContext<OnboardingStoreState | null>(null);
const AdminContext = createContext<AdminStoreState | null>(null);
const NavigationContext = createContext<NavigationContextValue | null>(null);

export const CallColleagueProvider: React.FC<{
  children: React.ReactNode;
  initialView?: CallColleagueView;
}> = ({ children, initialView = "onboarding" }) => {
  const [activeView, setActiveView] = useState<CallColleagueView>(initialView);

  // Onboarding Store State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [businessName, setBusinessName] = useState<string>(
    initialTemplate.defaultBusinessName
  );
  const [industry, setIndustry] = useState<IndustryType>("salon");
  const [timezone, setTimezone] = useState<string>("Asia/Colombo");
  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>(
    DEFAULT_OPERATING_HOURS
  );
  const [services, setServices] = useState<ServiceItem[]>(
    initialTemplate.defaultServices
  );
  const [departments, setDepartments] = useState<DepartmentRoute[]>(
    initialTemplate.defaultDepartments
  );
  const [knowledgeFaqs, setKnowledgeFaqs] = useState<KnowledgeFAQ[]>(
    initialTemplate.defaultFaqs
  );
  const [voicePersona, setVoicePersona] = useState<VoicePersona>(
    VOICE_PERSONAS[0]
  );
  const [googleCalendarConnected, setGoogleCalendarConnected] =
    useState<boolean>(false);
  const [calendarEmail, setCalendarEmail] = useState<string>("");
  const [telephonySetupType, setTelephonySetupType] =
    useState<TelephonySetupType>("new_dedicated_number");
  const [forwardingNumber, setForwardingNumber] = useState<string>("");
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>(
    CARRIER_FORWARDING_CODES[0].id
  );
  const [isNumberVerified, setIsNumberVerified] = useState<boolean>(false);
  const [sipConfig, setSipConfigState] = useState<SipTrunkConfig>({
    sipUri: "",
    authUsername: "",
    transport: "TLS",
  });
  const [planTier, setPlanTier] = useState<PlanTier>("growth");
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>("US");
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>("");
  const [provisionedAgentId, setProvisionedAgentId] = useState<string | null>(
    null
  );
  const [virtualPhoneNumber, setVirtualPhoneNumber] = useState<string | null>(
    null
  );

  // Admin Store State
  const [user, setUser] = useState<AdminUser | null>(DEFAULT_ADMIN_USER);
  const [agents, setAgents] = useState<AdminUser[]>([DEFAULT_ADMIN_USER]);
  const [vapiSyncStatus, setVapiSyncStatus] = useState<VapiSyncStatus>("idle");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [callLogs, setCallLogs] = useState<CallLogItem[]>(MOCK_CALL_LOGS);
  const [appointments, setAppointments] =
    useState<AppointmentItem[]>(MOCK_APPOINTMENTS);

  const loadTenantActivity = async (tenantId: string, isCancelled?: () => boolean) => {
    const [callsRes, apptsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/calls?tenantId=${encodeURIComponent(tenantId)}`),
      fetch(`${API_BASE_URL}/appointments?tenantId=${encodeURIComponent(tenantId)}`),
    ]);
    if (isCancelled?.()) return;
    if (callsRes.ok) {
      const callsData = (await callsRes.json()) as { calls?: CallLogItem[] };
      if (Array.isArray(callsData.calls)) {
        setCallLogs(callsData.calls);
      }
    }
    if (apptsRes.ok) {
      const apptsData = (await apptsRes.json()) as {
        appointments?: AppointmentItem[];
      };
      if (Array.isArray(apptsData.appointments)) {
        setAppointments(apptsData.appointments);
      }
    }
  };

  const pushTenantUpdates = (tenantId: string, updates: Partial<AdminUser>) => {
    setVapiSyncStatus("syncing");
    fetch(`${API_BASE_URL}/agents/${encodeURIComponent(tenantId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
      .then(async (res) => {
        if (!res.ok) {
          setVapiSyncStatus("failed");
          return;
        }
        const data = (await res.json()) as {
          tenant?: AdminUser;
          vapiSynced?: boolean;
        };
        if (data.tenant) {
          setAgents((prev) =>
            prev.some((a) => a.id === data.tenant!.id)
              ? prev.map((a) => (a.id === data.tenant!.id ? data.tenant! : a))
              : [data.tenant!, ...prev]
          );
        }
        setVapiSyncStatus(data.vapiSynced ? "synced" : "failed");
      })
      .catch((err) => {
        console.warn("[CallColleague] Tenant sync failed:", err);
        setVapiSyncStatus("failed");
      });
  };

  useEffect(() => {
    let active = true;
    const loadPersistedState = async () => {
      try {
        const agentsRes = await fetch(`${API_BASE_URL}/agents`);
        if (!active) return;
        let selectedId = DEFAULT_ADMIN_USER.id;
        if (agentsRes.ok) {
          const agentsData = (await agentsRes.json()) as {
            agents?: AdminUser[];
          };
          if (Array.isArray(agentsData.agents) && agentsData.agents.length > 0) {
            setAgents(agentsData.agents);
            const urlAgentId =
              typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("agentId")
                : null;
            const picked =
              (urlAgentId && agentsData.agents.find((a) => a.id === urlAgentId)) ||
              agentsData.agents[0];
            setUser(picked);
            selectedId = picked.id;
          }
        }
        await loadTenantActivity(selectedId, () => !active);
      } catch {
        // Keep seeded defaults if API routes are unavailable
      }
    };
    loadPersistedState();
    return () => {
      active = false;
    };
  }, []);

  const onboardingValue: OnboardingStoreState = {
    currentStep,
    businessName,
    industry,
    timezone,
    operatingHours,
    services,
    departments,
    knowledgeFaqs,
    voicePersona,
    googleCalendarConnected,
    calendarEmail,
    telephonySetupType,
    forwardingNumber,
    selectedCarrierId,
    isNumberVerified,
    sipConfig,
    planTier,
    phoneCountry,
    selectedPhoneNumber,
    provisionedAgentId,
    virtualPhoneNumber,

    setStep: (step) => setCurrentStep(step),
    nextStep: () => setCurrentStep((s) => Math.min(6, s + 1)),
    prevStep: () => setCurrentStep((s) => Math.max(1, s - 1)),

    setBusinessInfo: (info) => {
      if (info.businessName !== undefined) setBusinessName(info.businessName);
      if (info.industry !== undefined) setIndustry(info.industry);
      if (info.timezone !== undefined) setTimezone(info.timezone);
    },

    applyIndustryTemplate: (ind) => {
      const template = INDUSTRY_TEMPLATES[ind];
      const recommendedVoice =
        VOICE_PERSONAS.find((v) => v.id === template.defaultVoiceId) ||
        VOICE_PERSONAS[0];
      setIndustry(ind);
      setBusinessName(template.defaultBusinessName);
      setServices(template.defaultServices);
      setDepartments(template.defaultDepartments);
      setKnowledgeFaqs(template.defaultFaqs);
      setVoicePersona(recommendedVoice);
    },

    updateOperatingHour: (day, updates) => {
      setOperatingHours((prev) =>
        prev.map((h) => (h.day === day ? { ...h, ...updates } : h))
      );
    },

    addService: (service) => setServices((prev) => [...prev, service]),
    removeService: (id) =>
      setServices((prev) => prev.filter((s) => s.id !== id)),

    addDepartment: (dept) => setDepartments((prev) => [...prev, dept]),
    removeDepartment: (id) =>
      setDepartments((prev) => prev.filter((d) => d.id !== id)),

    addFaq: (faq) => setKnowledgeFaqs((prev) => [...prev, faq]),
    removeFaq: (id) =>
      setKnowledgeFaqs((prev) => prev.filter((f) => f.id !== id)),

    setVoicePersona: (persona) => setVoicePersona(persona),
    setGoogleCalendarConnected: (connected) =>
      setGoogleCalendarConnected(connected),
    setCalendarEmail: (email) => setCalendarEmail(email),
    setTelephonySetupType: (type) => setTelephonySetupType(type),
    setForwardingNumber: (num) => {
      setForwardingNumber(num);
      setIsNumberVerified(false);
    },
    setSelectedCarrierId: (id) => setSelectedCarrierId(id),
    setNumberVerified: (verified) => setIsNumberVerified(verified),
    setSipConfig: (config) =>
      setSipConfigState((prev) => ({ ...prev, ...config })),
    setPlanTier: (tier) => setPlanTier(tier),
    setPhoneCountry: (country) => setPhoneCountry(country),
    setSelectedPhoneNumber: (num) => setSelectedPhoneNumber(num),
    setProvisionedResult: (agentId, phoneNumber) => {
      setProvisionedAgentId(agentId);
      setVirtualPhoneNumber(phoneNumber);
    },
    resetWizard: () => {
      setCurrentStep(1);
      setBusinessName(initialTemplate.defaultBusinessName);
      setIndustry("salon");
      setServices(initialTemplate.defaultServices);
      setDepartments(initialTemplate.defaultDepartments);
      setKnowledgeFaqs(initialTemplate.defaultFaqs);
      setVoicePersona(VOICE_PERSONAS[0]);
      setGoogleCalendarConnected(false);
      setCalendarEmail("");
      setTelephonySetupType("new_dedicated_number");
      setForwardingNumber("");
      setIsNumberVerified(false);
      setPhoneCountry("US");
      setSelectedPhoneNumber("");
      setProvisionedAgentId(null);
      setVirtualPhoneNumber(null);
    },
  };

  const adminValue: AdminStoreState = {
    user,
    agents,
    vapiSyncStatus,
    isAuthenticated,
    callLogs,
    appointments,

    login: (email, bName) => {
      setIsAuthenticated(true);
      setUser((prev) =>
        prev
          ? {
              ...prev,
              email,
              businessName: bName || prev.businessName,
            }
          : {
              ...DEFAULT_ADMIN_USER,
              email,
              businessName: bName || DEFAULT_ADMIN_USER.businessName,
            }
      );
    },

    logout: () => setIsAuthenticated(false),

    selectAgent: (agentId) => {
      const found = agents.find((a) => a.id === agentId);
      if (found) {
        setUser(found);
        setVapiSyncStatus("idle");
        void loadTenantActivity(agentId).catch(() => {});
      }
    },

    toggleAgentActive: () => {
      if (!user) return;
      const nextActive = !user.agentActive;
      setUser((prev) =>
        prev ? { ...prev, agentActive: nextActive } : null
      );
      pushTenantUpdates(user.id, { agentActive: nextActive });
    },

    updateUser: (updates) => {
      setUser((prev) => {
        if (!prev) return null;
        const merged = { ...prev, ...updates };
        setAgents((list) =>
          list.some((a) => a.id === merged.id)
            ? list.map((a) => (a.id === merged.id ? merged : a))
            : [merged, ...list]
        );
        return merged;
      });
    },

    setAdminVoicePersona: (persona) => {
      setUser((prev) => (prev ? { ...prev, voicePersona: persona } : null));
      if (user) {
        pushTenantUpdates(user.id, { voicePersona: persona });
      }
    },

    addAdminService: (service) => {
      if (!user) return;
      const nextServices = [...user.services, service];
      setUser((prev) => (prev ? { ...prev, services: nextServices } : null));
      pushTenantUpdates(user.id, { services: nextServices });
    },

    updateAdminService: (id, updates) => {
      if (!user) return;
      const nextServices = user.services.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      setUser((prev) => (prev ? { ...prev, services: nextServices } : null));
      pushTenantUpdates(user.id, { services: nextServices });
    },

    removeAdminService: (id) => {
      if (!user) return;
      const nextServices = user.services.filter((s) => s.id !== id);
      setUser((prev) => (prev ? { ...prev, services: nextServices } : null));
      pushTenantUpdates(user.id, { services: nextServices });
    },

    addAdminDepartment: (dept) => {
      if (!user) return;
      const nextDepartments = [...user.departments, dept];
      setUser((prev) =>
        prev ? { ...prev, departments: nextDepartments } : null
      );
      pushTenantUpdates(user.id, { departments: nextDepartments });
    },

    updateAdminDepartment: (id, updates) => {
      if (!user) return;
      const nextDepartments = user.departments.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      );
      setUser((prev) =>
        prev ? { ...prev, departments: nextDepartments } : null
      );
      pushTenantUpdates(user.id, { departments: nextDepartments });
    },

    removeAdminDepartment: (id) => {
      if (!user) return;
      const nextDepartments = user.departments.filter((d) => d.id !== id);
      setUser((prev) =>
        prev ? { ...prev, departments: nextDepartments } : null
      );
      pushTenantUpdates(user.id, { departments: nextDepartments });
    },

    addAdminFaq: (faq) => {
      if (!user) return;
      const nextFaqs = [...user.knowledgeFaqs, faq];
      setUser((prev) =>
        prev ? { ...prev, knowledgeFaqs: nextFaqs } : null
      );
      pushTenantUpdates(user.id, { knowledgeFaqs: nextFaqs });
    },

    updateAdminFaq: (id, updates) => {
      if (!user) return;
      const nextFaqs = user.knowledgeFaqs.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      );
      setUser((prev) =>
        prev ? { ...prev, knowledgeFaqs: nextFaqs } : null
      );
      pushTenantUpdates(user.id, { knowledgeFaqs: nextFaqs });
    },

    removeAdminFaq: (id) => {
      if (!user) return;
      const nextFaqs = user.knowledgeFaqs.filter((f) => f.id !== id);
      setUser((prev) =>
        prev ? { ...prev, knowledgeFaqs: nextFaqs } : null
      );
      pushTenantUpdates(user.id, { knowledgeFaqs: nextFaqs });
    },

    updateAdminOperatingHour: (day, updates) => {
      if (!user) return;
      const nextHours = user.operatingHours.map((h) =>
        h.day === day ? { ...h, ...updates } : h
      );
      setUser((prev) =>
        prev ? { ...prev, operatingHours: nextHours } : null
      );
      pushTenantUpdates(user.id, { operatingHours: nextHours });
    },

    updateAppointmentStatus: (id, status) => {
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
      );
      fetch(`${API_BASE_URL}/appointments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).catch(() => {});
    },

    rescheduleAppointment: (id, newDateTime) => {
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === id
            ? { ...apt, dateTime: newDateTime, status: "rescheduled" }
            : apt
        )
      );
      fetch(`${API_BASE_URL}/appointments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateTime: newDateTime }),
      }).catch(() => {});
    },

    simulateIncomingCall: () => {
      const currentUser = user || DEFAULT_ADMIN_USER;
      void (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/calls`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: currentUser.id }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              call: CallLogItem;
              appointment: AppointmentItem;
            };
            setCallLogs((prev) => [data.call, ...prev]);
            setAppointments((prev) => [data.appointment, ...prev]);
            return;
          }
        } catch {
          // Fall back to local simulation if API request fails
        }

        const firstService = currentUser.services[0] || {
          name: "Consultation",
          price: 85,
          durationMinutes: 45,
          staffMember: "Lead Specialist",
        };
        const randomNames = [
          "Olivia Rodrigo",
          "Liam Neeson",
          "Noah Patel",
          "Emma Stone",
          "Lucas Gray",
        ];
        const caller =
          randomNames[Math.floor(Math.random() * randomNames.length)];
        const phone = `+1 (555) ${Math.floor(
          200 + Math.random() * 700
        )}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newCall: CallLogItem = {
          id: `call_${Date.now()}`,
          callerName: caller,
          callerPhone: phone,
          timestamp: "Just now",
          duration: "1m 24s",
          status: "booked",
          sentiment: "positive",
          serviceRequested: `${firstService.name} ($${firstService.price})`,
          summary: `Live simulated call: ${caller} inquired about ${
            firstService.name
          }. AI checked Google Calendar availability, confirmed Tomorrow at 2:00 PM with ${
            firstService.staffMember || "Senior Specialist"
          }, and sent SMS confirmation.`,
          transcript: [
            {
              role: "agent",
              text: `Hi! Thank you for calling ${currentUser.businessName}. This is ${currentUser.voicePersona.name}. How can I help you today?`,
            },
            {
              role: "user",
              text: `Hi! I'd like to book ${firstService.name} for tomorrow afternoon if possible.`,
            },
            {
              role: "agent",
              text: `Our ${firstService.name} is $${firstService.price} and takes ${firstService.durationMinutes} minutes. I have 2:00 PM open tomorrow with ${
                firstService.staffMember || "our specialist"
              }. Shall I lock that in for you?`,
            },
            {
              role: "user",
              text: `Yes please! My name is ${caller}.`,
            },
            {
              role: "agent",
              text: `All set, ${caller}! You are confirmed for tomorrow at 2:00 PM. I've just sent a calendar invite and SMS reminder to ${phone}.`,
            },
          ],
        };

        const newAppointment: AppointmentItem = {
          id: `apt_${Date.now()}`,
          clientName: caller,
          clientPhone: phone,
          serviceName: firstService.name,
          staffMember: firstService.staffMember || "Senior Specialist",
          dateTime: "Tomorrow, 2:00 PM",
          durationMinutes: firstService.durationMinutes,
          price: firstService.price,
          status: "confirmed",
          bookedVia: "AI Voice Receptionist",
        };

        setCallLogs((prev) => [newCall, ...prev]);
        setAppointments((prev) => [newAppointment, ...prev]);
      })();
    },

    switchDemoTenant: (preset) => {
      const data = DEMO_TENANT_PRESETS[preset];
      const template = INDUSTRY_TEMPLATES[data.industry];
      const voice =
        VOICE_PERSONAS.find((v) => v.id === template.defaultVoiceId) ||
        VOICE_PERSONAS[0];

      setIsAuthenticated(true);
      setVapiSyncStatus("idle");
      setUser((prev) => ({
        ...(prev || DEFAULT_ADMIN_USER),
        id: preset === "clinic" ? "ag_demo_clinic" : "ag_demo_salon",
        businessName: data.businessName,
        industry: data.industry,
        virtualPhoneNumber: data.phone,
        voicePersona: voice,
        services: template.defaultServices,
        departments: template.defaultDepartments,
        knowledgeFaqs: template.defaultFaqs,
      }));
      setCallLogs(data.calls);
      setAppointments(data.appointments);
    },
  };

  return (
    <NavigationContext.Provider
      value={{ activeView, navigateTo: (view) => setActiveView(view) }}
    >
      <OnboardingContext.Provider value={onboardingValue}>
        <AdminContext.Provider value={adminValue}>
          {children}
        </AdminContext.Provider>
      </OnboardingContext.Provider>
    </NavigationContext.Provider>
  );
};

export const useOnboardingStore = (): OnboardingStoreState => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error(
      "useOnboardingStore must be used inside CallColleagueProvider"
    );
  }
  return ctx;
};

export const useAdminStore = (): AdminStoreState => {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminStore must be used inside CallColleagueProvider");
  }
  return ctx;
};

export const useCallColleagueNavigation = (): NavigationContextValue => {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error(
      "useCallColleagueNavigation must be used inside CallColleagueProvider"
    );
  }
  return ctx;
};
