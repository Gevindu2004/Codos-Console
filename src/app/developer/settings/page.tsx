"use client";

import React, { useState, useEffect } from "react";
import { useDeveloper } from "@/components/developer/DeveloperContext";
import {
  User,
  Building2,
  Mail,
  Globe,
  Phone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Save,
} from "lucide-react";

type PayoutMethod = "stripe" | "bank_transfer" | "paypal" | "wise";

interface FormState {
  developerName: string;
  companyName: string;
  email: string;
  country: string;
  website: string;
  supportContact: string;
  payoutMethod: PayoutMethod;
  stripeAccountId: string;
  bankAccountNumber: string;
  bankRoutingNumber: string;
  bankAccountName: string;
  paypalEmail: string;
  wiseEmail: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia",
  "Germany", "India", "Singapore", "France", "Netherlands", "Other",
];

const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: "stripe", label: "Stripe Connect" },
  { value: "bank_transfer", label: "Bank Transfer (ACH / SWIFT)" },
  { value: "paypal", label: "PayPal" },
  { value: "wise", label: "Wise (TransferWise)" },
];

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.developerName.trim()) errors.developerName = "Developer name is required.";
  if (!form.companyName.trim()) errors.companyName = "Company name is required.";
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = "A valid email is required.";
  if (!form.country) errors.country = "Country is required.";
  if (form.website && !/^https?:\/\/.+/.test(form.website))
    errors.website = "Website must start with https:// or http://";
  if (!form.supportContact.trim()) errors.supportContact = "Support contact is required.";
  if (form.payoutMethod === "stripe" && !form.stripeAccountId.trim())
    errors.stripeAccountId = "Stripe account ID is required.";
  if (form.payoutMethod === "bank_transfer") {
    if (!form.bankAccountNumber.trim()) errors.bankAccountNumber = "Account number is required.";
    if (!form.bankRoutingNumber.trim()) errors.bankRoutingNumber = "Routing / SWIFT code is required.";
    if (!form.bankAccountName.trim()) errors.bankAccountName = "Account holder name is required.";
  }
  if (form.payoutMethod === "paypal" && (!form.paypalEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.paypalEmail)))
    errors.paypalEmail = "A valid PayPal email is required.";
  if (form.payoutMethod === "wise" && (!form.wiseEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.wiseEmail)))
    errors.wiseEmail = "A valid Wise email is required.";
  return errors;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#CBD5E1]">{label}</label>
      {children}
      {error && <p className="text-xs text-[#F87171]">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full bg-[#0F172A] border border-[#F1F5F9]/10 rounded-lg px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#CBD5E1]/40 focus:outline-none focus:border-[#14B8A6] transition-colors";

export default function SettingsPage() {
  const { profile } = useDeveloper();
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [form, setForm] = useState<FormState>({
    developerName: profile?.developerName ?? "",
    companyName: profile?.companyName ?? "",
    email: profile?.email ?? "",
    country: profile?.country ?? "",
    website: profile?.website ?? "",
    supportContact: profile?.supportContact ?? "",
    payoutMethod: (profile?.payoutMethod as PayoutMethod) ?? "stripe",
    stripeAccountId: (profile?.payoutDetails as any)?.stripeAccountId ?? "",
    bankAccountNumber: "",
    bankRoutingNumber: "",
    bankAccountName: "",
    paypalEmail: "",
    wiseEmail: "",
  });

  // Sync when profile loads
  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        developerName: profile.developerName,
        companyName: profile.companyName,
        email: profile.email,
        country: profile.country ?? f.country,
        website: profile.website ?? f.website,
        supportContact: profile.supportContact ?? f.supportContact,
        payoutMethod: (profile.payoutMethod as PayoutMethod) ?? "stripe",
        stripeAccountId: (profile.payoutDetails as any)?.stripeAccountId ?? f.stripeAccountId,
      }));
    }
  }, [profile]);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
    setSaved(false);
  };

  const handleSave = () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    // In real impl: call developerApi.updateProfile(...)
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const emailVerified = profile?.emailVerified ?? false;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Profile &amp; Payout Settings</h1>
        <p className="text-sm text-[#CBD5E1] mt-1">
          Manage your developer profile, verify your email, and configure payout details.
        </p>
      </div>

      {/* Email Verification Banner */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border ${
          emailVerified
            ? "bg-[#34D399]/10 border-[#34D399]/30"
            : "bg-[#FBBF24]/10 border-[#FBBF24]/30"
        }`}
      >
        {emailVerified ? (
          <CheckCircle2 className="w-5 h-5 text-[#34D399] mt-0.5 shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-[#FBBF24] mt-0.5 shrink-0" />
        )}
        <div>
          <p className="text-sm font-semibold text-[#F1F5F9]">
            {emailVerified ? "Email Verified" : "Email Not Verified"}
          </p>
          <p className="text-xs text-[#CBD5E1] mt-0.5">
            {emailVerified
              ? `${form.email} is confirmed and active.`
              : "Please verify your email to publish products and receive payouts."}
          </p>
          {!emailVerified && (
            <button className="mt-2 px-3 py-1 text-xs bg-[#FBBF24] text-[#0F172A] rounded-lg font-semibold hover:bg-[#F59E0B] cursor-pointer">
              Resend Verification Email
            </button>
          )}
        </div>
      </div>

      {/* Profile Section */}
      <div className="bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10 p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]/10">
          <User className="w-4 h-4 text-[#14B8A6]" />
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Developer Profile</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Developer / Studio Name *" error={errors.developerName}>
            <input
              className={inputCls}
              value={form.developerName}
              onChange={set("developerName")}
              placeholder="e.g. Acme Devs"
            />
          </Field>
          <Field label="Company Name *" error={errors.companyName}>
            <input
              className={inputCls}
              value={form.companyName}
              onChange={set("companyName")}
              placeholder="e.g. Acme Corp"
            />
          </Field>
          <Field label="Verified Email *" error={errors.email}>
            <div className="relative">
              <input
                className={inputCls + " pr-8"}
                value={form.email}
                onChange={set("email")}
                type="email"
                placeholder="devs@example.com"
              />
              {emailVerified && (
                <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#34D399]" />
              )}
            </div>
          </Field>
          <Field label="Country *" error={errors.country}>
            <select
              className={inputCls}
              value={form.country}
              onChange={set("country")}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Website / Portfolio" error={errors.website}>
            <input
              className={inputCls}
              value={form.website}
              onChange={set("website")}
              placeholder="https://yourcompany.com"
            />
          </Field>
          <Field label="Support Contact *" error={errors.supportContact}>
            <input
              className={inputCls}
              value={form.supportContact}
              onChange={set("supportContact")}
              placeholder="support@yourcompany.com"
            />
          </Field>
        </div>
      </div>

      {/* Payout Section */}
      <div className="bg-[#1E293B] rounded-xl border border-[#F1F5F9]/10 p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]/10">
          <CreditCard className="w-4 h-4 text-[#14B8A6]" />
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Payout Method</h2>
        </div>

        <Field label="Payout Method">
          <select
            className={inputCls}
            value={form.payoutMethod}
            onChange={set("payoutMethod")}
          >
            {PAYOUT_METHODS.map((pm) => (
              <option key={pm.value} value={pm.value}>
                {pm.label}
              </option>
            ))}
          </select>
        </Field>

        {form.payoutMethod === "stripe" && (
          <Field label="Stripe Connected Account ID *" error={errors.stripeAccountId}>
            <input
              className={inputCls}
              value={form.stripeAccountId}
              onChange={set("stripeAccountId")}
              placeholder="acct_1XXXXXXXXXX"
            />
          </Field>
        )}

        {form.payoutMethod === "bank_transfer" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Account Holder Name *" error={errors.bankAccountName}>
              <input
                className={inputCls}
                value={form.bankAccountName}
                onChange={set("bankAccountName")}
                placeholder="John Smith"
              />
            </Field>
            <Field label="Account Number *" error={errors.bankAccountNumber}>
              <input
                className={inputCls}
                value={form.bankAccountNumber}
                onChange={set("bankAccountNumber")}
                placeholder="000123456789"
              />
            </Field>
            <Field label="Routing / SWIFT Code *" error={errors.bankRoutingNumber}>
              <input
                className={inputCls}
                value={form.bankRoutingNumber}
                onChange={set("bankRoutingNumber")}
                placeholder="021000021 or BOFAUS3N"
              />
            </Field>
          </div>
        )}

        {form.payoutMethod === "paypal" && (
          <Field label="PayPal Email *" error={errors.paypalEmail}>
            <input
              className={inputCls}
              value={form.paypalEmail}
              onChange={set("paypalEmail")}
              type="email"
              placeholder="payments@yourcompany.com"
            />
          </Field>
        )}

        {form.payoutMethod === "wise" && (
          <Field label="Wise Account Email *" error={errors.wiseEmail}>
            <input
              className={inputCls}
              value={form.wiseEmail}
              onChange={set("wiseEmail")}
              type="email"
              placeholder="wise@yourcompany.com"
            />
          </Field>
        )}

        <p className="text-xs text-[#CBD5E1]/70">
          Payouts are processed on the 1st of each month for balances over $50. CODOS
          never stores full bank account numbers — data is encrypted and tokenized.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#14B8A6] text-[#0F172A] rounded-xl font-semibold text-sm hover:bg-[#0d9488] transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-[#34D399] font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Changes saved successfully!
          </span>
        )}
        {Object.keys(errors).length > 0 && (
          <span className="text-sm text-[#F87171]">
            Please fix the errors above before saving.
          </span>
        )}
      </div>
    </div>
  );
}
