"use client";

import React, { useState } from "react";
import { Lock, Mail, ShieldCheck, Zap, Paperclip } from "lucide-react";
import { tuFetch, TuUser } from "./api";
import { Button, Card, Field, Input, Notice, errorText } from "./ui";

export function AuthPanel({ onAuthed }: { onAuthed: (u: TuUser) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("register");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "forgot") {
        const r = await tuFetch<{ message: string }>("/dashboard/auth/password/forgot", { json: { email } });
        setInfo(r.message);
        setMode("reset");
        return;
      }
      const path =
        mode === "login" ? "/dashboard/auth/login" : mode === "reset" ? "/dashboard/auth/password/reset" : "/dashboard/auth/register";
      const body =
        mode === "login" ? { email, password } : mode === "reset" ? { email, code, password } : { name, company, email, password };
      const res = await tuFetch<{ user: TuUser }>(path, { json: body });
      onAuthed(res.user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-stretch">
      <Card className="p-8 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 text-[#14B8A6] text-xs font-bold mb-3">
          <Mail className="w-4 h-4" /> THUMBSUP EMAIL
        </div>
        <h1 className="text-3xl font-bold text-[#F1F5F9] leading-tight">Send emails from any app or website in minutes.</h1>
        <p className="text-sm text-[#F1F5F9]/70 mt-3">
          One simple API for contact forms, sign-up emails, receipts and file uploads, with security built in.
        </p>
        <ul className="mt-6 space-y-3.5">
          {[
            [Zap, "Website forms without a backend", "Paste one snippet and your form sends emails."],
            [Paperclip, "Real file uploads", "Big files automatically become secure download links."],
            [ShieldCheck, "Safe by default", "Keys locked to your website, spam blocked automatically."],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof Zap;
            return (
              <li key={title as string} className="flex gap-3">
                <span className="w-8 h-8 rounded-lg bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center shrink-0">
                  <I className="w-4 h-4" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-[#F1F5F9]">{title as string}</span>
                  <span className="block text-xs text-[#F1F5F9]/65">{text as string}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-8">
        {(mode === "forgot" || mode === "reset") && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#F1F5F9]">Reset your password</h2>
            <p className="text-xs text-[#F1F5F9]/65 mt-1">
              {mode === "forgot" ? "Enter your account email and we'll send you a 6-digit code." : "Enter the code from your email and choose a new password."}
            </p>
          </div>
        )}
        <div className={`flex gap-1 p-1 rounded-xl border border-[#F1F5F9]/12 mb-6 ${mode === "forgot" || mode === "reset" ? "hidden" : ""}`}>
          {(["register", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
                mode === m ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A]" : "text-[#F1F5F9]/70"
              }`}
            >
              {m === "register" ? "Create account" : "Log in"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Your name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Oshan" required autoComplete="name" />
              </Field>
              <Field label="Company" optional>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Via Codos" autoComplete="organization" />
              </Field>
            </div>
          )}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
          </Field>
          {mode === "reset" && (
            <Field label="6-digit code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                className="tracking-[0.3em] font-mono"
                required
              />
            </Field>
          )}
          {mode !== "forgot" && (
          <Field
            label={mode === "reset" ? "New password" : "Password"}
            help={mode === "register" || mode === "reset" ? "At least 8 characters, with letters and numbers." : undefined}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={mode === "login" ? undefined : 8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>
          )}
          {mode === "login" && (
            <button type="button" onClick={() => setMode("forgot")} className="text-xs font-bold text-[#14B8A6] cursor-pointer">
              Forgot your password?
            </button>
          )}
          {info && <Notice tone="success">{info}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" loading={busy} className="w-full">
            <Lock className="w-4 h-4" />
            {mode === "register" ? "Create my free account" : mode === "login" ? "Log in" : mode === "forgot" ? "Send reset code" : "Set new password"}
          </Button>
          {(mode === "forgot" || mode === "reset") && (
            <button type="button" onClick={() => setMode("login")} className="block mx-auto text-xs font-bold text-[#14B8A6] cursor-pointer">
              ← Back to log in
            </button>
          )}
          <p className="text-[11px] text-center text-[#F1F5F9]/60">
            Each account is fully private: you only ever see your own keys, templates and emails.
          </p>
        </form>
      </Card>
    </div>
  );
}
