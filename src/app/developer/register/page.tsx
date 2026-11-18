"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";

type RegistrationForm = {
  developerName: string;
  companyName: string;
  email: string;
  country: string;
  website: string;
  supportContact: string;
  termsAccepted: boolean;
};

type RegistrationField = Exclude<keyof RegistrationForm, "termsAccepted">;
type RegistrationErrors = Partial<Record<RegistrationField | "termsAccepted", string>>;

const inputClass =
  "mt-1 block w-full rounded-md border border-[#14B8A6]/30 bg-[#0F172A] px-3 py-2 text-sm text-[#F1F5F9] placeholder:text-[#CBD5E1]/40 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]";
const helperClass = "mt-1.5 text-xs text-[#CBD5E1]/60";

export default function DeveloperRegistration() {
  const [form, setForm] = useState<RegistrationForm>({
    developerName: "",
    companyName: "",
    email: "",
    country: "",
    website: "",
    supportContact: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [emailNotice, setEmailNotice] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field: RegistrationField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitted(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: RegistrationErrors = {};
    if (!form.developerName.trim()) {
      nextErrors.developerName = "Developer name is required";
    }
    if (!form.email.trim()) {
      nextErrors.email = "Developer email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Please enter a valid email address";
    }
    if (!form.country) {
      nextErrors.country = "Country is required";
    }
    if (!form.supportContact.trim()) {
      nextErrors.supportContact = "Support contact is required";
    }
    if (!form.termsAccepted) {
      nextErrors.termsAccepted = "Please accept the Developer Submission Standard & Terms of Service.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitted(true);
  };

  const fieldError = (field: RegistrationField) =>
    errors[field] ? (
      <p id={`${field}-error`} role="alert" className="mt-1.5 text-xs text-[#F87171]">
        {errors[field]}
      </p>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-xl bg-[#1E293B] p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Developer Registration</h1>
        <p className="mt-2 text-sm text-[#CBD5E1]">
          Tell us about yourself and how customers can reach you. Required fields are marked with *.
        </p>
      </div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#CBD5E1]" htmlFor="developerName">
            Developer Name *
          </label>
          <input
            id="developerName"
            name="developerName"
            type="text"
            autoComplete="name"
            value={form.developerName}
            onChange={(event) => updateField("developerName", event.target.value)}
            placeholder="e.g., name"
            aria-invalid={Boolean(errors.developerName)}
            aria-describedby={errors.developerName ? "developerName-error" : "developerName-help"}
            className={inputClass}
          />
          <p id="developerName-help" className={helperClass}>
            Full name of the primary developer or technical lead.
          </p>
          {fieldError("developerName")}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#CBD5E1]" htmlFor="companyName">
            Company Name (Optional)
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            autoComplete="organization"
            value={form.companyName}
            onChange={(event) => updateField("companyName", event.target.value)}
            placeholder="e.g., company name"
            aria-describedby="companyName-help"
            className={inputClass}
          />
          <p id="companyName-help" className={helperClass}>
            Leave blank if registering as an individual developer.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#CBD5E1]" htmlFor="email">
            Developer Email *
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => {
                updateField("email", event.target.value);
                setEmailNotice("");
              }}
              placeholder="e.g., developer@yourdomain.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : "email-help"}
              className={`${inputClass} mt-0 min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() =>
                setEmailNotice(
                  form.email.trim()
                    ? "Email verification will be available after registration."
                    : "Enter your email address first. Verification will be available after registration."
                )
              }
              className="shrink-0 rounded-md border border-[#14B8A6]/40 px-3 text-xs font-medium text-[#14B8A6] hover:bg-[#14B8A6]/10"
            >
              Verify Email
            </button>
          </div>
          <p id="email-help" className={helperClass}>
            Used for submission review updates and account verification.
          </p>
          {fieldError("email")}
          {emailNotice && <p role="status" className={helperClass}>{emailNotice}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#CBD5E1]" htmlFor="country">
            Country *
          </label>
          <select
            id="country"
            name="country"
            value={form.country}
            onChange={(event) => updateField("country", event.target.value)}
            aria-invalid={Boolean(errors.country)}
            aria-describedby={errors.country ? "country-error" : "country-help"}
            className="mt-1 block w-full rounded-md bg-[#0B1120] text-slate-100 border border-slate-700/80 px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
          >
            <option className="bg-[#0B1120] text-slate-100" value="">Select your country...</option>
            <option className="bg-[#0B1120] text-slate-100" value="Sri Lanka">Sri Lanka</option>
            <option className="bg-[#0B1120] text-slate-100" value="United States">United States</option>
            <option className="bg-[#0B1120] text-slate-100" value="United Kingdom">United Kingdom</option>
            <option className="bg-[#0B1120] text-slate-100" value="India">India</option>
            <option className="bg-[#0B1120] text-slate-100" value="Singapore">Singapore</option>
            <option className="bg-[#0B1120] text-slate-100" value="Germany">Germany</option>
            <option className="bg-[#0B1120] text-slate-100" value="Australia">Australia</option>
            <option className="bg-[#0B1120] text-slate-100" value="Canada">Canada</option>
            <option className="bg-[#0B1120] text-slate-100" value="France">France</option>
            <option className="bg-[#0B1120] text-slate-100" value="Ireland">Ireland</option>
            <option className="bg-[#0B1120] text-slate-100" value="Japan">Japan</option>
            <option className="bg-[#0B1120] text-slate-100" value="Netherlands">Netherlands</option>
            <option className="bg-[#0B1120] text-slate-100" value="New Zealand">New Zealand</option>
            <option className="bg-[#0B1120] text-slate-100" value="Other">Other</option>
          </select>
          <p id="country-help" className={helperClass}>
            Required for payout routing and tax compliance.
          </p>
          {fieldError("country")}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#CBD5E1]" htmlFor="website">
            Website / GitHub Portfolio (Optional)
          </label>
          <input
            id="website"
            name="website"
            type="url"
            autoComplete="url"
            value={form.website}
            onChange={(event) => updateField("website", event.target.value)}
            placeholder="e.g., https://github.com/your-handle or https://yourdomain.com"
            aria-describedby="website-help"
            className={inputClass}
          />
          <p id="website-help" className={helperClass}>
            Helps our review team verify your engineering background faster.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#CBD5E1]" htmlFor="supportContact">
            Customer Support Contact *
          </label>
          <input
            id="supportContact"
            name="supportContact"
            type="text"
            value={form.supportContact}
            onChange={(event) => updateField("supportContact", event.target.value)}
            placeholder="e.g., support@yourdomain.com or https://yourdomain.com/support"
            aria-invalid={Boolean(errors.supportContact)}
            aria-describedby={errors.supportContact ? "supportContact-error" : "supportContact-help"}
            className={inputClass}
          />
          <p id="supportContact-help" className={helperClass}>
            Displayed on your published API/Model pages for customer support.
          </p>
          {fieldError("supportContact")}
        </div>

        <div>
          <div className="flex items-start gap-2">
            <input
              id="termsAccepted"
              name="termsAccepted"
              type="checkbox"
              checked={form.termsAccepted}
              onChange={(event) => {
                setForm((current) => ({ ...current, termsAccepted: event.target.checked }));
                setErrors((current) => ({ ...current, termsAccepted: undefined }));
                setSubmitted(false);
              }}
              aria-invalid={Boolean(errors.termsAccepted)}
              aria-describedby={errors.termsAccepted ? "termsAccepted-error" : undefined}
              className="mt-1 h-4 w-4 rounded border-[#14B8A6] accent-[#14B8A6] focus:ring-[#14B8A6]"
            />
            <label htmlFor="termsAccepted" className="text-sm text-[#CBD5E1]">
              I accept the Developer Submission Standard &amp; Terms of Service
            </label>
          </div>
          {errors.termsAccepted && (
            <p id="termsAccepted-error" role="alert" className="mt-1.5 text-xs text-[#F87171]">
              {errors.termsAccepted}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 rounded-md bg-[#14B8A6] px-4 py-2 text-[#0F172A] transition-colors hover:bg-[#0D9488]"
        >
          <Check className="h-4 w-4" /> Register
        </button>
      </form>
      {submitted && (
        <div role="status" className="rounded-md bg-[#34D399]/10 p-4 text-[#34D399]">
          Registration submitted! Your profile will be reviewed shortly.
        </div>
      )}
    </div>
  );
}
