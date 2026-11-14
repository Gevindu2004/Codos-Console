"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Clock,
  Globe,
  Sparkles,
  Check,
  Wand2,
  Briefcase,
  Plus,
  Trash2,
  DollarSign,
  User,
  PhoneForwarded,
  ShieldAlert,
  BookOpen,
  Tag,
  HelpCircle,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
  Radio,
  Calendar,
  Phone,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Lock,
  Smartphone,
  Server,
  Copy,
  KeyRound,
  AlertCircle,
  CreditCard,
  Loader2,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  LayoutDashboard,
  Play,
  Square,
} from "lucide-react";
import {
  useOnboardingStore,
  useAdminStore,
  useCallColleagueNavigation,
} from "./CallColleagueContext";
import {
  INDUSTRY_TEMPLATES,
  VOICE_PERSONAS,
  CARRIER_FORWARDING_CODES,
} from "./industryTemplates";
import {
  IndustryType,
  KnowledgeFAQ,
  PlanTier,
  TelephonySetupType,
} from "./types";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  AudioVisualizerOrb,
  cn,
  triggerConfetti,
} from "./ui";
import {
  useVapiWeb,
  useGoogleAuth,
  api,
  ProvisioningStepResult,
  speakWithPersona,
  stopPersonaSpeech,
} from "./hooks";

const STEPS = [
  { id: 1, title: "Identity", subtitle: "Hours & Preset" },
  { id: 2, title: "Services", subtitle: "Pricing & Staff" },
  { id: 3, title: "Routing", subtitle: "Call Transfers" },
  { id: 4, title: "Knowledge", subtitle: "FAQs & Policies" },
  { id: 5, title: "Voice Test", subtitle: "Live Sandbox" },
  { id: 6, title: "Deploy", subtitle: "Calendar & Phone" },
];

export const StepIndicator: React.FC = () => {
  const { currentStep, setStep } = useOnboardingStore();

  return (
    <div className="w-full py-5">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-5 w-full h-0.5 bg-slate-800 -z-10" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-[#14B8A6] to-[#2DD4BF] -z-10 transition-all duration-500"
          style={{
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
          }}
        />

        {STEPS.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <button
              key={step.id}
              onClick={() => setStep(step.id)}
              className="group flex flex-col items-center focus:outline-none cursor-pointer"
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2",
                  isCompleted &&
                    "bg-[#14B8A6] border-[#14B8A6] text-[#0F172A] shadow-lg shadow-[#14B8A6]/30",
                  isCurrent &&
                    "bg-slate-900 border-[#14B8A6] text-[#14B8A6] ring-4 ring-[#14B8A6]/20 scale-110",
                  !isCompleted &&
                    !isCurrent &&
                    "bg-slate-900 border-slate-700 text-slate-500 group-hover:border-slate-600"
                )}
              >
                {isCompleted ? <Check className="w-5 h-5 stroke-[2.5]" /> : step.id}
              </div>
              <div className="mt-2.5 text-center">
                <p
                  className={cn(
                    "text-xs font-semibold tracking-wide transition-colors",
                    isCurrent
                      ? "text-[#14B8A6]"
                      : isCompleted
                      ? "text-slate-300"
                      : "text-slate-500"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-[10px] text-slate-500 hidden sm:block">
                  {step.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const TIMEZONES = [
  { value: "Asia/Colombo", label: "Asia/Colombo (GMT+5:30)" },
  { value: "America/New_York", label: "Eastern Time - US & Canada (EST/EDT)" },
  { value: "America/Chicago", label: "Central Time - US & Canada (CST/CDT)" },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time - US & Canada (PST/PDT)",
  },
  { value: "Europe/London", label: "London, UK (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Dubai", label: "Dubai, UAE (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney, Australia (AEST)" },
];

export const Step1BusinessInfo: React.FC = () => {
  const {
    businessName,
    industry,
    timezone,
    operatingHours,
    setBusinessInfo,
    applyIndustryTemplate,
    updateOperatingHour,
    nextStep,
  } = useOnboardingStore();

  const applyHoursPreset = (
    preset: "standard" | "extended" | "weekdays_only"
  ) => {
    operatingHours.forEach((item) => {
      if (preset === "standard") {
        const isClosed = item.day === "Sunday";
        updateOperatingHour(item.day, {
          openTime: "09:00",
          closeTime: "17:00",
          isClosed,
        });
      } else if (preset === "extended") {
        updateOperatingHour(item.day, {
          openTime: "09:00",
          closeTime: "20:00",
          isClosed: false,
        });
      } else if (preset === "weekdays_only") {
        const isWeekend = item.day === "Saturday" || item.day === "Sunday";
        updateOperatingHour(item.day, {
          openTime: "09:00",
          closeTime: "18:00",
          isClosed: isWeekend,
        });
      }
    });
  };

  const detectLocalTimezone = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (TIMEZONES.some((t) => t.value === detected)) {
        setBusinessInfo({ timezone: detected });
      }
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge variant="info" className="mb-2">
              <Sparkles className="w-3 h-3 mr-1" /> Step 1 of 6
            </Badge>
            <h2 className="text-2xl font-bold text-white">
              Select Industry Template & Identity
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Choose an industry preset to auto-populate realistic services,
              transfer rules, and FAQs.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
            1-Click Industry Starter Presets (Pre-fills Services, Voice & FAQs)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(INDUSTRY_TEMPLATES) as IndustryType[])
              .filter((k) => k !== "custom")
              .map((key) => {
                const template = INDUSTRY_TEMPLATES[key];
                const isSelected = industry === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyIndustryTemplate(key)}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                      isSelected
                        ? "bg-[#14B8A6]/15 border-[#14B8A6] shadow-lg shadow-[#14B8A6]/10"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div>
                      <span className="text-2xl mb-2 block">
                        {template.icon}
                      </span>
                      <p className="font-semibold text-white text-sm">
                        {template.label}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {template.defaultServices.length} Services •{" "}
                        {template.defaultFaqs.length} FAQs
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#14B8A6]" />
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-800/80">
          <Input
            label="Business Name"
            placeholder="e.g., Luxe Hair & Color Lounge"
            value={businessName}
            onChange={(e) => setBusinessInfo({ businessName: e.target.value })}
            icon={<Building2 className="w-4 h-4" />}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Operating Timezone
              </label>
              <button
                type="button"
                onClick={detectLocalTimezone}
                className="text-[11px] text-[#14B8A6] hover:text-[#2DD4BF] flex items-center gap-1 cursor-pointer"
              >
                <Globe className="w-3 h-3" /> Auto-detect
              </button>
            </div>
            <Select
              options={TIMEZONES}
              value={timezone}
              onChange={(e) => setBusinessInfo({ timezone: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#14B8A6]/15 text-[#14B8A6]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Weekly Schedule & Closed Days
              </h3>
              <p className="text-xs text-slate-400">
                Your AI colleague only books appointments during open hours.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-[#14B8A6]" /> Quick Fill:
            </span>
            <button
              type="button"
              onClick={() => applyHoursPreset("standard")}
              className="px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              9–5 Standard
            </button>
            <button
              type="button"
              onClick={() => applyHoursPreset("extended")}
              className="px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Extended (9–8)
            </button>
            <button
              type="button"
              onClick={() => applyHoursPreset("weekdays_only")}
              className="px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Mon–Fri Only
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800/70">
          {operatingHours.map((item) => (
            <div
              key={item.day}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 w-40">
                <input
                  type="checkbox"
                  checked={!item.isClosed}
                  onChange={(e) =>
                    updateOperatingHour(item.day, {
                      isClosed: !e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 accent-[#14B8A6] cursor-pointer"
                />
                <span
                  className={
                    item.isClosed
                      ? "text-slate-500 line-through text-sm"
                      : "text-slate-200 font-medium text-sm"
                  }
                >
                  {item.day}
                </span>
              </div>

              {item.isClosed ? (
                <Badge variant="default" className="w-fit">
                  Closed All Day
                </Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={item.openTime}
                    onChange={(e) =>
                      updateOperatingHour(item.day, {
                        openTime: e.target.value,
                      })
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-[#14B8A6] focus:outline-none"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="time"
                    value={item.closeTime}
                    onChange={(e) =>
                      updateOperatingHour(item.day, {
                        closeTime: e.target.value,
                      })
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-[#14B8A6] focus:outline-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button size="lg" onClick={nextStep} disabled={!businessName.trim()}>
            Continue to Services & Staff →
          </Button>
        </div>
      </Card>
    </div>
  );
};

export const Step2Services: React.FC = () => {
  const { services, addService, removeService, nextStep, prevStep } =
    useOnboardingStore();

  const [name, setName] = useState("");
  const [staffMember, setStaffMember] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("45");
  const [description, setDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    addService({
      id: `srv_${Date.now()}`,
      name: name.trim(),
      staffMember: staffMember.trim() || "Any Available Specialist",
      price: Number(price),
      durationMinutes: Number(duration),
      description:
        description.trim() || "Standard booking service handled by AI.",
    });

    setName("");
    setStaffMember("");
    setPrice("");
    setDescription("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Badge variant="info" className="mb-2">
              Step 2 of 6
            </Badge>
            <h2 className="text-2xl font-bold text-white">
              Services, Pricing & Staff Assignment
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Your AI colleague quotes these exact prices, durations, and
              assigned specialists when callers ask.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="w-4 h-4" />{" "}
            {showAddForm ? "Close Form" : "Add Custom Service"}
          </Button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className="p-5 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 space-y-4 mb-6"
          >
            <h3 className="text-sm font-semibold text-[#14B8A6] flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Service to AI Catalog
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Service Name"
                  placeholder="e.g., Root Touch-Up & Blowdry"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Input
                label="Assigned Staff / Specialist"
                placeholder="e.g., Elena (Senior Stylist)"
                value={staffMember}
                onChange={(e) => setStaffMember(e.target.value)}
                icon={<User className="w-4 h-4" />}
              />
              <Input
                label="Price (USD)"
                type="number"
                placeholder="85"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                icon={<DollarSign className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <Select
                label="Duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                options={[
                  { value: "15", label: "15 Minutes" },
                  { value: "30", label: "30 Minutes" },
                  { value: "45", label: "45 Minutes" },
                  { value: "60", label: "1 Hour" },
                  { value: "90", label: "1.5 Hours" },
                  { value: "120", label: "2 Hours" },
                ]}
              />
              <div className="md:col-span-2">
                <Input
                  label="Spoken Context for AI (What's included?)"
                  placeholder="e.g., Includes wash, scalp massage, and blowdry"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">
                <Plus className="w-4 h-4" /> Save Service
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {services.map((srv) => (
            <div
              key={srv.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-[#14B8A6]/40 transition gap-3"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-lg bg-[#14B8A6]/15 text-[#14B8A6] mt-0.5">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-white text-sm">
                      {srv.name}
                    </h4>
                    <Badge variant="success">${srv.price}</Badge>
                    <Badge variant="default">
                      <Clock className="w-3 h-3 mr-1" /> {srv.durationMinutes}m
                    </Badge>
                    {srv.staffMember && (
                      <Badge variant="info">
                        <User className="w-3 h-3 mr-1" /> {srv.staffMember}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {srv.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => removeService(srv.id)}
                className="p-2 text-slate-500 hover:text-rose-400 transition cursor-pointer self-end sm:self-center"
                title="Remove Service"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between">
          <Button variant="outline" onClick={prevStep}>
            ← Back
          </Button>
          <Button onClick={nextStep} disabled={services.length === 0}>
            Continue to Call Routing →
          </Button>
        </div>
      </Card>
    </div>
  );
};

export const Step3Routing: React.FC = () => {
  const { departments, addDepartment, removeDepartment, nextStep, prevStep } =
    useOnboardingStore();

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [description, setDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phoneNumber.trim()) return;

    addDepartment({
      id: `dept_${Date.now()}`,
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      description:
        description.trim() ||
        "Transfer when caller requests this specific department.",
    });

    setName("");
    setPhoneNumber("");
    setDescription("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Badge variant="info" className="mb-2">
              Step 3 of 6
            </Badge>
            <h2 className="text-2xl font-bold text-white">
              Intelligent Call Transfer & Escalation
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Define when the AI should warm-transfer a caller to a live human
              or specific department phone line.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="w-4 h-4" />{" "}
            {showAddForm ? "Close Form" : "Add Transfer Line"}
          </Button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className="p-5 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 space-y-4 mb-6"
          >
            <h3 className="text-sm font-semibold text-[#14B8A6] flex items-center gap-2">
              <PhoneForwarded className="w-4 h-4" /> Add Department Transfer
              Destination
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Department or Person Name"
                placeholder="e.g., Billing & Insurance Desk"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Target Phone Number (E.164 or Local)"
                placeholder="e.g., +1 (555) 390-1122"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-3">
                <Input
                  label="Routing Condition (When should the AI transfer here?)"
                  placeholder="e.g., Transfer when caller has an urgent complaint or asks for a manager"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">
                <Plus className="w-4 h-4" /> Save Route
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800/80"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-lg bg-[#14B8A6]/15 text-[#14B8A6] mt-0.5">
                  <PhoneForwarded className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h4 className="font-semibold text-white text-sm">
                      {dept.name}
                    </h4>
                    <Badge variant="info">{dept.phoneNumber}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    <span className="text-slate-500 font-medium">Trigger:</span>{" "}
                    {dept.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => removeDepartment(dept.id)}
                className="p-2 text-slate-500 hover:text-rose-400 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/80 leading-relaxed">
            <strong>Warm Transfer & Fallback Logic:</strong> Before connecting
            the caller, your AI colleague announces the caller&apos;s name and
            reason for calling to your staff member. If the line is busy, the AI
            takes a message and sends an instant SMS summary.
          </p>
        </div>

        <div className="mt-8 flex justify-between">
          <Button variant="outline" onClick={prevStep}>
            ← Back
          </Button>
          <Button onClick={nextStep}>Continue to Knowledge & FAQs →</Button>
        </div>
      </Card>
    </div>
  );
};

export const Step4KnowledgeFAQ: React.FC = () => {
  const { knowledgeFaqs, addFaq, removeFaq, nextStep, prevStep } =
    useOnboardingStore();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] =
    useState<KnowledgeFAQ["category"]>("policy");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;

    addFaq({
      id: `faq_${Date.now()}`,
      question: question.trim(),
      answer: answer.trim(),
      category,
    });

    setQuestion("");
    setAnswer("");
    setShowAddForm(false);
  };

  const filteredFaqs =
    activeFilter === "all"
      ? knowledgeFaqs
      : knowledgeFaqs.filter((f) => f.category === activeFilter);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Badge variant="info" className="mb-2">
              Step 4 of 6
            </Badge>
            <h2 className="text-2xl font-bold text-white">
              Custom Knowledge Base & Company Policies
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Train your AI colleague on cancellation policies, parking,
              insurance, and common caller questions.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="w-4 h-4" />{" "}
            {showAddForm ? "Close Form" : "Add Custom FAQ"}
          </Button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddFaq}
            className="p-5 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 space-y-4 mb-6"
          >
            <h3 className="text-sm font-semibold text-[#14B8A6] flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Teach Your AI a New Question &
              Answer
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Caller Question / Topic"
                  placeholder="e.g., Do you require a deposit for new appointments?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>
              <Select
                label="Topic Category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as KnowledgeFAQ["category"])
                }
                options={[
                  { value: "policy", label: "Cancellation / Policy" },
                  { value: "parking", label: "Location & Parking" },
                  { value: "pricing", label: "Pricing & Insurance" },
                  { value: "general", label: "General FAQ" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-3">
                <Input
                  label="Exact AI Response"
                  placeholder="e.g., Yes, we take a $25 refundable deposit which goes toward your service."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">
                <Plus className="w-4 h-4" /> Add to Brain
              </Button>
            </div>
          </form>
        )}

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {["all", "policy", "parking", "pricing", "general"].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition cursor-pointer",
                activeFilter === cat
                  ? "bg-[#14B8A6] text-[#0F172A]"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              )}
            >
              {cat === "all" ? `All Rules (${knowledgeFaqs.length})` : cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredFaqs.map((faq) => (
            <div
              key={faq.id}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-lg bg-[#14B8A6]/15 text-[#14B8A6] mt-0.5">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-white text-sm">
                      “{faq.question}”
                    </h4>
                    <Badge variant="default">
                      <Tag className="w-3 h-3 mr-1" /> {faq.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    <span className="text-[#14B8A6] font-semibold">
                      AI Answer:
                    </span>{" "}
                    {faq.answer}
                  </p>
                </div>
              </div>

              <button
                onClick={() => removeFaq(faq.id)}
                className="p-2 text-slate-500 hover:text-rose-400 transition cursor-pointer shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between">
          <Button variant="outline" onClick={prevStep}>
            ← Back
          </Button>
          <Button onClick={nextStep}>Continue to Live Voice Sandbox →</Button>
        </div>
      </Card>
    </div>
  );
};

export const Step5VoiceAndTest: React.FC = () => {
  const {
    voicePersona,
    setVoicePersona,
    businessName,
    services,
    knowledgeFaqs,
    nextStep,
    prevStep,
  } = useOnboardingStore();

  const {
    isCallActive,
    isConnecting,
    isMuted,
    volumeLevel,
    transcript,
    startCall,
    stopCall,
    toggleMute,
  } = useVapiWeb(voicePersona.name);

  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    return () => stopPersonaSpeech();
  }, []);

  const handleTogglePreview = (
    e: React.MouseEvent,
    persona: (typeof VOICE_PERSONAS)[number]
  ) => {
    e.stopPropagation();
    setVoicePersona(persona);
    if (previewingId === persona.id) {
      stopPersonaSpeech();
      setPreviewingId(null);
      return;
    }
    setPreviewingId(persona.id);
    speakWithPersona(persona.previewText, persona.name, {
      onStart: () => setPreviewingId(persona.id),
      onEnd: () => setPreviewingId(null),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-6">
          <Badge variant="info" className="mb-2">
            Step 5 of 6
          </Badge>
          <h2 className="text-2xl font-bold text-white">
            Choose Voice Persona & Live Audio Sandbox
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Select a neural voice and test your AI receptionist in real time
            using your computer microphone & speakers.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#14B8A6]" /> Available
              Neural Voices
            </label>

            {VOICE_PERSONAS.map((persona) => {
              const isSelected = voicePersona.id === persona.id;
              const isPreviewing = previewingId === persona.id;
              return (
                <div
                  key={persona.id}
                  onClick={() => setVoicePersona(persona)}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer",
                    isSelected
                      ? "bg-[#14B8A6]/15 border-[#14B8A6] shadow-lg shadow-[#14B8A6]/10"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">
                        {persona.name}
                      </span>
                      <Badge variant={isSelected ? "info" : "default"}>
                        {persona.accent}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {persona.gender}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleTogglePreview(e, persona)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer",
                          isPreviewing
                            ? "bg-[#14B8A6] text-[#0F172A] border-[#14B8A6]"
                            : "bg-slate-900 text-[#14B8A6] border-slate-700 hover:border-[#14B8A6]"
                        )}
                        title={`Listen to ${persona.name}'s ${persona.gender.toLowerCase()} voice sample`}
                      >
                        {isPreviewing ? (
                          <>
                            <Square className="w-2.5 h-2.5 fill-current" /> Stop
                          </>
                        ) : (
                          <>
                            <Play className="w-2.5 h-2.5 fill-current" /> Preview
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{persona.tone}</p>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between p-6 rounded-2xl bg-slate-950/90 border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Radio
                  className={cn(
                    "w-4 h-4",
                    isCallActive
                      ? "text-[#14B8A6] animate-pulse"
                      : "text-slate-600"
                  )}
                />
                <span className="text-xs font-medium text-slate-300">
                  {isCallActive
                    ? `Connected to ${voicePersona.name} (Audio Enabled)`
                    : `Sandbox Ready — ${businessName}`}
                </span>
              </div>
              <Badge variant={isCallActive ? "success" : "default"}>
                {isCallActive
                  ? "LIVE MIC STREAM"
                  : `${services.length} Services • ${knowledgeFaqs.length} FAQs`}
              </Badge>
            </div>

            <div className="my-4">
              <AudioVisualizerOrb
                isActive={isCallActive}
                isConnecting={isConnecting}
                volumeLevel={volumeLevel}
              />
            </div>

            <div className="h-36 overflow-y-auto rounded-xl bg-slate-900/90 border border-slate-800/90 p-3.5 mb-5 space-y-2.5 text-xs">
              {transcript.length === 0 ? (
                <p className="text-slate-500 text-center py-10">
                  Click <strong>&quot;Test My Agent Now&quot;</strong> below to
                  hear {voicePersona.name} greet callers and answer questions
                  about {businessName}.
                </p>
              ) : (
                transcript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-2.5 rounded-lg max-w-[90%]",
                      msg.role === "agent"
                        ? "bg-[#14B8A6]/15 border border-[#14B8A6]/35 text-teal-100 mr-auto"
                        : "bg-slate-800 text-slate-200 ml-auto"
                    )}
                  >
                    <span className="font-bold text-[10px] uppercase tracking-wider block mb-0.5 opacity-70">
                      {msg.role === "agent"
                        ? `${voicePersona.name} (AI Receptionist)`
                        : "Caller"}
                    </span>
                    {msg.text}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-center gap-3 z-10">
              {!isCallActive ? (
                <Button
                  size="lg"
                  onClick={startCall}
                  isLoading={isConnecting}
                  className="w-full sm:w-auto"
                >
                  <PhoneCall className="w-4 h-4" /> Test My Agent Now (Web Audio)
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={toggleMute}
                    className={cn(
                      isMuted &&
                        "bg-rose-950/60 border-rose-500/40 text-rose-300"
                    )}
                  >
                    {isMuted ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                    {isMuted ? "Unmute Mic" : "Mute Mic"}
                  </Button>
                  <Button variant="danger" onClick={stopCall}>
                    <PhoneOff className="w-4 h-4" /> End Test Call
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between">
          <Button variant="outline" onClick={prevStep}>
            ← Back
          </Button>
          <Button
            onClick={() => {
              if (isCallActive) stopCall();
              nextStep();
            }}
          >
            Continue to Deployment & Phone Setup →
          </Button>
        </div>
      </Card>
    </div>
  );
};

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PLAN_PRICES: Record<PlanTier, { name: string; price: number }> = {
  starter: { name: "Starter Receptionist", price: 99 },
  growth: { name: "Growth Autonomous", price: 199 },
  enterprise: { name: "Pro Multi-Line", price: 399 },
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { businessName, planTier } = useOnboardingStore();
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [expiry, setExpiry] = useState("08/28");
  const [cvc, setCvc] = useState("884");
  const [cardholder, setCardholder] = useState(businessName || "Alex Rivera");
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedPlan = PLAN_PRICES[planTier];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Activate Subscription & Provision Number"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/35 flex items-center justify-between">
          <div>
            <Badge variant="info" className="mb-1">
              14-Day Free Trial Included
            </Badge>
            <h4 className="font-bold text-white text-base">
              {selectedPlan.name} Plan
            </h4>
            <p className="text-xs text-slate-400">
              Dedicated AI Number + Unlimited Concurrent Calls
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-white">
              ${selectedPlan.price}
            </span>
            <span className="text-xs text-slate-400 block">/month</span>
          </div>
        </div>

        <Input
          label="Cardholder Name"
          value={cardholder}
          onChange={(e) => setCardholder(e.target.value)}
          required
        />

        <Input
          label="Card Number (Test Mode Pre-filled)"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          icon={<CreditCard className="w-4 h-4" />}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Expiry Date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            required
          />
          <Input
            label="CVC"
            value={cvc}
            onChange={(e) => setCvc(e.target.value)}
            required
          />
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-[#14B8A6] shrink-0" />
          <span>
            256-bit SSL encrypted via Stripe. Today&apos;s charge is{" "}
            <strong className="text-white">$0.00</strong> during your 14-day
            trial.
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isProcessing}>
            <Lock className="w-4 h-4" /> Authorize & Deploy AI Agent
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const PLANS: {
  id: PlanTier;
  name: string;
  price: string;
  minutes: string;
  badge?: string;
}[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$99/mo",
    minutes: "250 Voice Mins",
  },
  {
    id: "growth",
    name: "Growth",
    price: "$199/mo",
    minutes: "750 Voice Mins",
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Pro Enterprise",
    price: "$399/mo",
    minutes: "2,500 Voice Mins",
  },
];

export const Step6CalendarAndPhone: React.FC = () => {
  const state = useOnboardingStore();
  const { updateUser, login } = useAdminStore();
  const { navigateTo } = useCallColleagueNavigation();
  const { connectGoogleCalendar, disconnectGoogleCalendar, isConnecting } =
    useGoogleAuth();

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const selectedCarrier =
    CARRIER_FORWARDING_CODES.find((c) => c.id === state.selectedCarrierId) ||
    CARRIER_FORWARDING_CODES[0];

  const handleSendOtp = async () => {
    if (!state.forwardingNumber.trim()) return;
    setIsSendingOtp(true);
    setOtpError(null);
    await api.triggerOtpVerification(state.forwardingNumber);
    setIsSendingOtp(false);
    setOtpSent(true);
  };

  const handleVerifyOtp = () => {
    if (otpInput.trim() === "4829" || otpInput.trim().length >= 4) {
      state.setNumberVerified(true);
      setOtpError(null);
    } else {
      setOtpError("Invalid code. Use demo code 4829.");
    }
  };

  const copyDialCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleProvisionConfirm = async () => {
    setShowCheckout(false);
    setIsProvisioning(true);

    const response = await api.provisionAgent({
      businessName: state.businessName,
      industry: state.industry,
      timezone: state.timezone,
      operatingHours: state.operatingHours,
      services: state.services,
      departments: state.departments,
      knowledgeFaqs: state.knowledgeFaqs,
      voicePersona: state.voicePersona,
      googleCalendarConnected: state.googleCalendarConnected,
      calendarEmail: state.calendarEmail,
      telephonySetupType: state.telephonySetupType,
      forwardingNumber: state.forwardingNumber,
      selectedCarrierId: state.selectedCarrierId,
      isNumberVerified: state.isNumberVerified,
      sipConfig: state.sipConfig,
      planTier: state.planTier,
    });

    state.setProvisionedResult(response.agentId, response.virtualPhoneNumber);
    login("owner@yourbusiness.com", state.businessName);
    updateUser({
      businessName: state.businessName,
      industry: state.industry,
      virtualPhoneNumber: response.virtualPhoneNumber,
      timezone: state.timezone,
      planTier: state.planTier,
      voicePersona: state.voicePersona,
      services: state.services,
      departments: state.departments,
      knowledgeFaqs: state.knowledgeFaqs,
      operatingHours: state.operatingHours,
    });
    setIsProvisioning(false);
    navigateTo("success");
  };

  const isDeployDisabled =
    (state.telephonySetupType === "call_forwarding" &&
      !state.forwardingNumber.trim()) ||
    (state.telephonySetupType === "sip_pbx_trunk" &&
      !state.sipConfig.sipUri.trim());

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-6">
          <Badge variant="info" className="mb-2">
            Step 6 of 6 — Final Step
          </Badge>
          <h2 className="text-2xl font-bold text-white">
            Calendar Sync & Telephony Integration
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Connect your booking calendar and choose how callers will reach your
            AI receptionist.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6]">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white">
                  Google Calendar Real-Time Sync
                </h3>
                {state.googleCalendarConnected && (
                  <Badge variant="success">Connected</Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {state.googleCalendarConnected
                  ? `Synced with ${state.calendarEmail} — AI checks conflicts before booking.`
                  : "Prevent double-bookings by allowing your AI to read free/busy slots and create events."}
              </p>
            </div>
          </div>

          {state.googleCalendarConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={disconnectGoogleCalendar}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={connectGoogleCalendar}
              isLoading={isConnecting}
            >
              Connect Google Calendar
            </Button>
          )}
        </div>

        <div className="mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
            Select Telephony Deployment Method
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {(
              [
                {
                  id: "new_dedicated_number",
                  title: "1. New Dedicated Line",
                  subtitle: "Instant Cloud Provisioning",
                  desc: "We assign a fresh toll-free or local virtual number ready to take calls immediately.",
                  icon: Phone,
                },
                {
                  id: "call_forwarding",
                  title: "2. Keep Existing Phone",
                  subtitle: "Mobile or Landline Divert",
                  desc: "Keep your current business number and forward unanswered or all calls to your AI.",
                  icon: Smartphone,
                },
                {
                  id: "sip_pbx_trunk",
                  title: "3. Connect Existing PBX",
                  subtitle: "SIP Trunk / 3CX / Twilio",
                  desc: "Bridge your existing VoIP PBX or SIP trunk directly to our Vapi voice cluster.",
                  icon: Server,
                },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              const isSelected = state.telephonySetupType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    state.setTelephonySetupType(
                      option.id as TelephonySetupType
                    )
                  }
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                    isSelected
                      ? "bg-[#14B8A6]/15 border-[#14B8A6] shadow-lg shadow-[#14B8A6]/10"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-[#14B8A6]/15 text-[#14B8A6]">
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-[#14B8A6]" />
                      )}
                    </div>
                    <h4 className="font-bold text-white text-sm">
                      {option.title}
                    </h4>
                    <span className="text-[11px] text-[#14B8A6] font-medium block mb-1.5">
                      {option.subtitle}
                    </span>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {option.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {state.telephonySetupType === "call_forwarding" && (
            <div className="mt-4 p-5 rounded-2xl bg-slate-950/90 border border-[#14B8A6]/30 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <Input
                    label="Your Existing Business Phone Number"
                    placeholder="e.g., +94 77 123 4567 or +1 (555) 234-5678"
                    value={state.forwardingNumber}
                    onChange={(e) => state.setForwardingNumber(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    We bind an AI routing bridge number to accept forwarded
                    calls from this line.
                  </p>
                </div>

                <Select
                  label="Select Your Telecom Carrier (For Star Codes)"
                  value={state.selectedCarrierId}
                  onChange={(e) => state.setSelectedCarrierId(e.target.value)}
                  options={CARRIER_FORWARDING_CODES.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.country})`,
                  }))}
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <KeyRound className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                        Caller-ID Ownership Verification
                      </h5>
                      {state.isNumberVerified ? (
                        <Badge variant="success">Verified</Badge>
                      ) : (
                        <Badge variant="warning">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {state.isNumberVerified
                        ? `Line ${state.forwardingNumber} is verified for seamless Call-Divert.`
                        : "Verify ownership via SMS/Voice code (Demo OTP: 4829)."}
                    </p>
                  </div>
                </div>

                {!state.isNumberVerified && (
                  <div className="flex items-center gap-2">
                    {!otpSent ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!state.forwardingNumber.trim()}
                        isLoading={isSendingOtp}
                        onClick={handleSendOtp}
                      >
                        Send OTP Code
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Code (4829)"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleVerifyOtp}
                        >
                          Verify
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {otpError && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {otpError}
                </p>
              )}

              <div className="p-4 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/25">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#14B8A6]">
                    {selectedCarrier.name} Call-Divert Cheat Sheet (Dial after
                    deployment)
                  </span>
                  <Badge variant="info">{selectedCarrier.country}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {[
                    {
                      label: "Forward All Calls (24/7)",
                      code: selectedCarrier.forwardAll.replace(
                        "{AI_NUMBER}",
                        "800945XXXX"
                      ),
                    },
                    {
                      label: "Forward If Busy / No Answer",
                      code: selectedCarrier.forwardBusyNoAnswer.replace(
                        "{AI_NUMBER}",
                        "800945XXXX"
                      ),
                    },
                    {
                      label: "Disable Forwarding",
                      code: selectedCarrier.cancelForwarding,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          {item.label}
                        </span>
                        <code className="text-[#14B8A6] font-mono font-bold">
                          {item.code}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyDialCode(item.code)}
                        className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                        title="Copy dial string"
                      >
                        {copiedCode === item.code ? (
                          <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {state.telephonySetupType === "sip_pbx_trunk" && (
            <div className="mt-4 p-5 rounded-2xl bg-slate-950/90 border border-[#14B8A6]/30 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#14B8A6]" /> SIP Trunk / VoIP
                  PBX Configuration
                </h4>
                <Badge variant="info">RFC 3261 Compliant</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Input
                    label="Inbound SIP Termination URI / Domain"
                    placeholder="e.g., sip:reception@pbx.yourcompany.com:5060"
                    value={state.sipConfig.sipUri}
                    onChange={(e) =>
                      state.setSipConfig({ sipUri: e.target.value })
                    }
                  />
                </div>
                <Select
                  label="Signaling Transport"
                  value={state.sipConfig.transport}
                  onChange={(e) =>
                    state.setSipConfig({
                      transport: e.target.value as "UDP" | "TCP" | "TLS",
                    })
                  }
                  options={[
                    { value: "UDP", label: "UDP (Standard Port 5060)" },
                    { value: "TCP", label: "TCP (Port 5060)" },
                    { value: "TLS", label: "TLS Encrypted (SIPS Port 5061)" },
                  ]}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="PBX Auth Username (Optional)"
                  placeholder="e.g., vapi_trunk_user"
                  value={state.sipConfig.authUsername}
                  onChange={(e) =>
                    state.setSipConfig({ authUsername: e.target.value })
                  }
                />
                <Input
                  label="Codec Negotiation"
                  value="PCMU (G.711u) / Opus 48kHz Low-Latency"
                  disabled
                />
              </div>
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
            Select Monthly Subscription Plan (14-Day Free Trial)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PLANS.map((plan) => {
              const isSelected = state.planTier === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => state.setPlanTier(plan.id)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all cursor-pointer relative",
                    isSelected
                      ? "bg-[#14B8A6]/15 border-[#14B8A6] shadow-lg"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  )}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#14B8A6] text-[#0F172A]">
                      {plan.badge}
                    </span>
                  )}
                  <p className="text-xs text-slate-400 font-medium">
                    {plan.name}
                  </p>
                  <p className="text-xl font-extrabold text-white mt-0.5">
                    {plan.price}
                  </p>
                  <p className="text-xs text-[#14B8A6] mt-1">{plan.minutes}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-semibold mb-2">
            <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
            Agent Configuration Recap
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-400">
            <div>
              <span className="block text-[10px] uppercase">Business</span>
              <strong className="text-white">{state.businessName}</strong>
            </div>
            <div>
              <span className="block text-[10px] uppercase">Voice Persona</span>
              <strong className="text-white">{state.voicePersona.name}</strong>
            </div>
            <div>
              <span className="block text-[10px] uppercase">Knowledge</span>
              <strong className="text-white">
                {state.services.length} Services • {state.knowledgeFaqs.length}{" "}
                FAQs
              </strong>
            </div>
            <div>
              <span className="block text-[10px] uppercase">Escalation</span>
              <strong className="text-white">
                {state.departments.length} Transfer Lines
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Button variant="outline" onClick={state.prevStep}>
            ← Back
          </Button>
          <Button
            size="lg"
            onClick={() => setShowCheckout(true)}
            isLoading={isProvisioning}
            disabled={isDeployDisabled}
          >
            <CheckCircle2 className="w-5 h-5" /> Deploy AI Receptionist Live{" "}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handleProvisionConfirm}
      />
    </div>
  );
};

const INITIAL_PROVISION_STEPS: ProvisioningStepResult[] = [
  {
    step: "supabase_tenant",
    status: "in_progress",
    label: "Creating Multi-Tenant Workspace",
    detail: "Saving business hours, services, and FAQ rules to Supabase...",
  },
  {
    step: "vapi_assistant",
    status: "pending",
    label: "Compiling Vapi Voice Assistant",
    detail: "Injecting system prompt, voice persona, and tool definitions...",
  },
  {
    step: "phone_binding",
    status: "pending",
    label: "Binding Telephony Endpoint",
    detail: "Allocating carrier route & linking webhook URL...",
  },
  {
    step: "smoke_test",
    status: "pending",
    label: "Running End-to-End Smoke Test",
    detail: "Verifying sub-600ms voice latency and calendar read/write...",
  },
];

export const SuccessPage: React.FC = () => {
  const {
    businessName,
    industry,
    timezone,
    planTier,
    operatingHours,
    virtualPhoneNumber,
    provisionedAgentId,
    voicePersona,
    services,
    departments,
    knowledgeFaqs,
    telephonySetupType,
    forwardingNumber,
    selectedCarrierId,
    sipConfig,
    resetWizard,
  } = useOnboardingStore();

  const { login, updateUser } = useAdminStore();
  const { navigateTo } = useCallColleagueNavigation();

  const [copied, setCopied] = useState(false);
  const [steps, setSteps] = useState<ProvisioningStepResult[]>(
    INITIAL_PROVISION_STEPS
  );
  const [isDeploymentDone, setIsDeploymentDone] = useState(false);

  const selectedCarrier =
    CARRIER_FORWARDING_CODES.find((c) => c.id === selectedCarrierId) ||
    CARRIER_FORWARDING_CODES[0];

  useEffect(() => {
    const timers: number[] = [];

    timers.push(
      window.setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) =>
            i === 0
              ? { ...s, status: "completed" }
              : i === 1
              ? { ...s, status: "in_progress" }
              : s
          )
        );
      }, 650)
    );

    timers.push(
      window.setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) =>
            i <= 1
              ? { ...s, status: "completed" }
              : i === 2
              ? { ...s, status: "in_progress" }
              : s
          )
        );
      }, 1350)
    );

    timers.push(
      window.setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) =>
            i <= 2
              ? { ...s, status: "completed" }
              : i === 3
              ? { ...s, status: "in_progress" }
              : s
          )
        );
      }, 2050)
    );

    timers.push(
      window.setTimeout(() => {
        setSteps((prev) => prev.map((s) => ({ ...s, status: "completed" })));
        setIsDeploymentDone(true);
        triggerConfetti();
      }, 2700)
    );

    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const displayPhone = virtualPhoneNumber || "+1 (888) 412-9940";
  const cleanDigits = displayPhone.replace(/\D/g, "");

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenDashboard = () => {
    login("owner@yourbusiness.com", businessName);
    updateUser({
      businessName,
      industry,
      virtualPhoneNumber: displayPhone,
      timezone,
      planTier,
      voicePersona,
      services,
      departments,
      knowledgeFaqs,
      operatingHours,
    });
    navigateTo("dashboard");
  };

  return (
    <div className="max-w-3xl mx-auto py-4">
      <Card className="text-center border-[#14B8A6]/35 relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-[#14B8A6]/20 blur-3xl pointer-events-none" />

        {!isDeploymentDone ? (
          <div className="py-6">
            <div className="w-14 h-14 rounded-2xl bg-[#14B8A6]/15 border border-[#14B8A6]/40 flex items-center justify-center mx-auto mb-4 text-[#14B8A6]">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <Badge variant="info" className="mb-2">
              Cloud Deployment Sequence
            </Badge>
            <h1 className="text-2xl font-extrabold text-white">
              Provisioning {businessName}...
            </h1>
            <p className="text-slate-400 text-xs mt-1 mb-6">
              Setting up your dedicated voice pipeline and telephony routing
            </p>

            <div className="max-w-md mx-auto text-left space-y-3">
              {steps.map((s) => (
                <div
                  key={s.step}
                  className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-start gap-3"
                >
                  {s.status === "completed" ? (
                    <CheckCircle2 className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
                  ) : s.status === "in_progress" ? (
                    <Loader2 className="w-5 h-5 text-[#14B8A6] animate-spin shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-700 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs font-bold text-white">{s.label}</p>
                    <p className="text-[11px] text-slate-400">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-[#14B8A6]/15 border border-[#14B8A6]/40 flex items-center justify-center mx-auto mb-5 text-[#14B8A6] shadow-lg shadow-[#14B8A6]/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <Badge variant="success" className="mb-3">
              <Sparkles className="w-3 h-3 mr-1" /> Agent Provisioned & Live
            </Badge>

            <h1 className="text-3xl font-extrabold text-white">
              {businessName} is Now Answered 24/7!
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">
              Your AI receptionist ({voicePersona.name}) is active with{" "}
              {services.length} services, {knowledgeFaqs.length} custom FAQ
              rules, and {departments.length} transfer routes.
            </p>

            {telephonySetupType === "new_dedicated_number" && (
              <div className="my-7 p-6 rounded-2xl bg-slate-950 border border-slate-800 max-w-md mx-auto">
                <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold block mb-2">
                  Dedicated AI Receptionist Phone Number
                </span>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl sm:text-3xl font-mono font-bold text-[#14B8A6]">
                    {displayPhone}
                  </span>
                  <button
                    onClick={() => copyText(displayPhone)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
                    title="Copy Number"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-[#14B8A6]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Agent ID: {provisionedAgentId || "ag_live_99201"} • Latency:
                  ~520ms
                </p>
              </div>
            )}

            {telephonySetupType === "call_forwarding" && (
              <div className="my-7 p-5 rounded-2xl bg-slate-950 border border-[#14B8A6]/40 max-w-lg mx-auto text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#14B8A6] flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" /> Activate Call Forwarding
                    ({selectedCarrier.name})
                  </span>
                  <Badge variant="info">Target: {displayPhone}</Badge>
                </div>
                <p className="text-xs text-slate-300">
                  From your business phone (
                  <strong>{forwardingNumber}</strong>), dial the star code below
                  to forward calls to your AI bridge number:
                </p>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      Dial on your phone keypad:
                    </span>
                    <code className="text-base font-mono font-bold text-[#14B8A6]">
                      {selectedCarrier.forwardBusyNoAnswer.replace(
                        "{AI_NUMBER}",
                        cleanDigits
                      )}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      copyText(
                        selectedCarrier.forwardBusyNoAnswer.replace(
                          "{AI_NUMBER}",
                          cleanDigits
                        )
                      )
                    }
                  >
                    <Copy className="w-3.5 h-3.5" />{" "}
                    {copied ? "Copied!" : "Copy Code"}
                  </Button>
                </div>
              </div>
            )}

            {telephonySetupType === "sip_pbx_trunk" && (
              <div className="my-7 p-5 rounded-2xl bg-slate-950 border border-[#14B8A6]/40 max-w-lg mx-auto text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#14B8A6] flex items-center gap-1.5">
                    <Server className="w-4 h-4" /> SIP Trunk Endpoint Active
                  </span>
                  <Badge variant="success">
                    {sipConfig.transport} Signaling
                  </Badge>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <code className="text-xs font-mono text-[#14B8A6] break-all">
                    {sipConfig.sipUri ||
                      `sip:${
                        provisionedAgentId || "agent"
                      }@sip.vapi.ai;transport=tls`}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyText(sipConfig.sipUri || displayPhone)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleOpenDashboard}
              >
                Open Customer Admin Dashboard{" "}
                <ExternalLink className="w-4 h-4" />
              </Button>
              <a
                href={`tel:${displayPhone}`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
              >
                <PhoneCall className="w-4 h-4 text-[#14B8A6]" /> Dial Test Call
              </a>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  resetWizard();
                  navigateTo("onboarding");
                }}
              >
                <RefreshCw className="w-4 h-4" /> Setup Another Agent
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export const OnboardingStudio: React.FC = () => {
  const { currentStep, resetWizard } = useOnboardingStore();
  const { activeView, navigateTo } = useCallColleagueNavigation();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  if (activeView === "success") {
    return <SuccessPage />;
  }

  const progressPercent = Math.round((currentStep / 6) * 100);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1BusinessInfo />;
      case 2:
        return <Step2Services />;
      case 3:
        return <Step3Routing />;
      case 4:
        return <Step4KnowledgeFAQ />;
      case 5:
        return <Step5VoiceAndTest />;
      case 6:
        return <Step6CalendarAndPhone />;
      default:
        return <Step1BusinessInfo />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Studio Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#0B1221]/85 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#14B8A6] flex items-center justify-center shadow-lg shadow-[#14B8A6]/25">
            <PhoneCall className="w-5 h-5 text-[#0F172A] stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">
                CallColleague<span className="text-[#14B8A6]">.ai</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/30">
                Agent Setup Studio
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              6-Step Autonomous Voice Receptionist Provisioning Wizard
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 bg-slate-950/80 border border-slate-800/80 px-3.5 py-1.5 rounded-full">
          <span className="text-xs font-medium text-slate-400">
            Step <strong className="text-white">{currentStep}</strong> of 6
          </span>
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#14B8A6] to-[#2DD4BF] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-[#14B8A6]">
            {progressPercent}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#14B8A6] bg-[#14B8A6]/10 border border-[#14B8A6]/25 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Auto-saved</span>
          </div>

          <button
            onClick={() => navigateTo("dashboard")}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#14B8A6] hover:text-white px-3 py-1.5 rounded-lg bg-[#14B8A6]/12 hover:bg-[#14B8A6]/25 border border-[#14B8A6]/30 transition cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Client Portal</span>
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800/70 transition cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span className="hidden sm:inline">Setup Help</span>
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/70 transition cursor-pointer"
            title="Reset Wizard"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      <StepIndicator />

      <div className="mt-2">{renderStep()}</div>

      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="How CallColleague AI Setup Works"
      >
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            <strong className="text-white">
              1. Pick an Industry Template:
            </strong>{" "}
            Start with pre-built services, staff assignments, and FAQs tailored
            for Salons, Clinics, Travel Agencies, or Law Firms.
          </p>
          <p>
            <strong className="text-white">
              2. Customize Services & Call Transfers:
            </strong>{" "}
            Add your exact pricing and phone numbers for human handoff when
            callers have urgent requests.
          </p>
          <p>
            <strong className="text-white">3. Test Live in Browser:</strong> In
            Step 5, speak directly to your AI receptionist using your computer
            microphone before paying a cent.
          </p>
          <p>
            <strong className="text-white">
              4. Instant Phone Number or Call Forwarding:
            </strong>{" "}
            In Step 6, get a dedicated phone number or forward your existing
            mobile/landline number.
          </p>
          <div className="pt-3 flex justify-end">
            <Button size="sm" onClick={() => setShowHelpModal(false)}>
              Got it, let&apos;s build
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Configuration?"
      >
        <p className="text-xs text-slate-300 mb-5">
          This will restore default industry templates and return you to Step 1.
          Are you sure you want to reset your progress?
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              resetWizard();
              setShowResetModal(false);
            }}
          >
            Yes, Reset Wizard
          </Button>
        </div>
      </Modal>
    </div>
  );
};
