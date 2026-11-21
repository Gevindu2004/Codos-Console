"use client";

// Small, consistent building blocks for the ThumbsUp Email screens.
// Colours follow the Codos Console palette, so light/dark themes work automatically.

import React, { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Loader2, X } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- layout
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl glass-panel border border-[#F1F5F9]/12", className)}>{children}</div>;
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-[#F1F5F9]">{title}</h2>
        {subtitle && <p className="text-sm text-[#F1F5F9]/70 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#14B8A6]/15 text-[#14B8A6] flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h3 className="text-base font-bold text-[#F1F5F9]">{title}</h3>
      <p className="text-sm text-[#F1F5F9]/70 mt-1.5 max-w-md mx-auto">{text}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}

// ---------------------------------------------------------------- buttons
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  size?: "sm" | "md";
};

export function Button({ variant = "primary", loading, size = "md", className = "", children, disabled, ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const variants = {
    primary: "codos-cta-btn bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] shadow-lg",
    secondary: "border border-[#F1F5F9]/15 text-[#F1F5F9] hover:border-[#14B8A6]/60 hover:text-[#14B8A6]",
    ghost: "text-[#F1F5F9]/75 hover:bg-[#14B8A6]/10 hover:text-[#14B8A6]",
    danger: "border border-red-500/40 text-red-500 hover:bg-red-500/10",
  };
  return (
    <button className={cx(base, sizes, variants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function CopyButton({ value, label = "Copy", size = "sm" }: { value: string; label?: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

// ---------------------------------------------------------------- form fields
export function Field({
  label,
  help,
  children,
  optional,
}: {
  label: string;
  help?: React.ReactNode;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-[#F1F5F9]/85">
        {label}
        {optional && <span className="font-normal text-[#F1F5F9]/50"> (optional)</span>}
      </span>
      {children}
      {help && <span className="block text-[11px] text-[#F1F5F9]/60 leading-relaxed">{help}</span>}
    </label>
  );
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-[#F1F5F9]/15 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6] transition-colors placeholder:text-[#94A3B8]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
  }
);

export function TextArea({ className = "", ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, "font-mono text-xs leading-relaxed", className)} {...rest} />;
}

export function Select({ className = "", children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputClass, "bg-[#0F172A] cursor-pointer", className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left w-full cursor-pointer group"
      aria-pressed={checked}
    >
      <span
        className={cx(
          "mt-0.5 shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors",
          checked ? "bg-[#14B8A6]" : "bg-[#94A3B8]/35"
        )}
      >
        <span className={cx("block w-5 h-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-[#F1F5F9]">{label}</span>
        {help && <span className="block text-xs text-[#F1F5F9]/65 mt-0.5">{help}</span>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- feedback
export function StatusPill({ status }: { status: string }) {
  const green = "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  const red = "bg-red-500/15 text-red-500 border-red-500/30";
  const amber = "bg-amber-500/15 text-amber-500 border-amber-500/30";
  const map: Record<string, string> = {
    sent: green,
    delivered: green,
    failed: red,
    bounced: red,
    complained: red,
    queued: amber,
    sending: amber,
  };
  const label: Record<string, string> = {
    sent: "Sent",
    delivered: "Delivered",
    failed: "Failed",
    bounced: "Bounced",
    complained: "Spam report",
    queued: "Queued",
    sending: "Sending…",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold", map[status])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label[status] || status}
    </span>
  );
}

export function Tag({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "slate" | "violet" }) {
  const tones = {
    teal: "bg-[#14B8A6]/15 text-[#14B8A6]",
    slate: "bg-[#94A3B8]/15 text-[#F1F5F9]/75",
    violet: "bg-violet-500/15 text-violet-500",
  };
  return <span className={cx("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold", tones[tone])}>{children}</span>;
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: ["border-[#14B8A6]/35 bg-[#14B8A6]/10", <Info key="i" className="w-4 h-4 text-[#14B8A6]" />],
    warning: ["border-amber-500/35 bg-amber-500/10", <AlertTriangle key="w" className="w-4 h-4 text-amber-500" />],
    error: ["border-red-500/35 bg-red-500/10", <AlertTriangle key="e" className="w-4 h-4 text-red-500" />],
    success: ["border-emerald-500/35 bg-emerald-500/10", <CheckCircle2 key="s" className="w-4 h-4 text-emerald-500" />],
  } as const;
  const [cls, icon] = tones[tone];
  return (
    <div className={cx("flex gap-3 rounded-xl border p-3.5", cls)}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="text-xs text-[#F1F5F9]/85 leading-relaxed space-y-1">
        {title && <div className="font-bold text-[#F1F5F9] text-sm">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#F1F5F9]/65">
      <Loader2 className="w-5 h-5 animate-spin text-[#14B8A6]" />
      {label}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={cx(
          "w-full max-h-[90vh] overflow-y-auto rounded-2xl glass-panel bg-[#0F172A] border border-[#F1F5F9]/15 p-6 space-y-5",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[#F1F5F9]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#F1F5F9]/60 hover:bg-[#14B8A6]/10 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- code
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-xl border border-[#F1F5F9]/12 bg-[#020617] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8]">{language}</span>
        <CopyButton value={code} />
      </div>
      <pre className="p-4 text-xs leading-relaxed overflow-x-auto text-[#E2E8F0] font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl border border-[#F1F5F9]/12">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx(
            "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
            value === t.id ? "codos-cta-btn bg-[#14B8A6] text-[#0F172A]" : "text-[#F1F5F9]/70 hover:text-[#14B8A6]"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- toasts
type Toast = { id: number; tone: "success" | "error"; text: string };
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl border glass-panel",
              t.tone === "success" ? "border-emerald-500/40" : "border-red-500/40"
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
            )}
            <span className="text-[#F1F5F9]">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

export function errorText(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message: string; hint?: string };
    return e.hint ? `${e.message} ${e.hint}` : e.message;
  }
  return "Something went wrong. Please try again.";
}
