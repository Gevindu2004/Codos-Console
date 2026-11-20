"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Circle, FileText, KeyRound, Send } from "lucide-react";
import { TuEmail, TuStats, TuUser, timeAgo } from "./api";
import { useTuData } from "./hooks";
import { Button, Card, Spinner, StatusPill, Notice } from "./ui";
import type { TuView } from "./ThumbsUpEmailWorkspace";

export function OverviewView({ user, go }: { user: TuUser; go: (v: TuView) => void }) {
  const stats = useTuData<TuStats>("/dashboard/stats");
  const recent = useTuData<{ data: TuEmail[] }>("/dashboard/emails?limit=5");

  if (stats.error) return <Notice tone="error">{stats.error}</Notice>;
  if (!stats.data) return <Spinner />;
  const s = stats.data;

  const steps = [
    {
      done: s.counts.keys > 0,
      icon: KeyRound,
      title: "Create an API key",
      text: "A secret key for your server, or a public key for your website form.",
      action: () => go("keys"),
      cta: "Create key",
    },
    {
      done: s.counts.templates > 0,
      icon: FileText,
      title: "Make an email template",
      text: "Start from a ready-made design: contact form, welcome email, receipt…",
      action: () => go("templates"),
      cta: "New template",
    },
    {
      done: s.counts.emails_all_time > 0,
      icon: Send,
      title: "Send your first email",
      text: "Try it right here, then copy the code into your app.",
      action: () => go("send"),
      cta: "Send test",
    },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const total = s.last_30_days.sent + s.last_30_days.failed;
  const rate = total ? Math.round((s.last_30_days.sent / total) * 100) : null;
  const maxDay = Math.max(1, ...s.daily.map((d) => d.sent + d.failed));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#F1F5F9]">Welcome, {user.name.split(" ")[0]} 👋</h2>
        <p className="text-sm text-[#F1F5F9]/70 mt-1">
          Here&apos;s how your emails are doing. New to this?{" "}
          <button onClick={() => go("guide")} className="font-bold text-[#14B8A6] hover:underline cursor-pointer">
            Read the step-by-step guide
          </button>
          .
        </p>
      </div>

      {doneCount < 3 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#F1F5F9]">Get started in 3 steps</h3>
            <span className="text-xs font-bold text-[#14B8A6]">{doneCount} of 3 done</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#94A3B8]/20 mb-5 overflow-hidden">
            <div className="h-full bg-[#14B8A6] rounded-full transition-all" style={{ width: `${(doneCount / 3) * 100}%` }} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {steps.map((st, i) => (
              <div
                key={st.title}
                className={`rounded-xl border p-4 flex flex-col gap-3 ${
                  st.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-[#F1F5F9]/12"
                }`}
              >
                <div className="flex items-center gap-2">
                  {st.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-[#F1F5F9]/40" />}
                  <span className="text-xs font-bold text-[#F1F5F9]/60">STEP {i + 1}</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-[#F1F5F9]">{st.title}</div>
                  <div className="text-xs text-[#F1F5F9]/65 mt-1">{st.text}</div>
                </div>
                {!st.done && (
                  <Button size="sm" onClick={st.action} className="self-start mt-auto">
                    {st.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Sent (30 days)", s.last_30_days.sent.toLocaleString(), "text-emerald-500"],
          ["Failed (30 days)", s.last_30_days.failed.toLocaleString(), s.last_30_days.failed ? "text-red-500" : "text-[#F1F5F9]"],
          ["Sent today", s.today.toLocaleString(), "text-[#F1F5F9]"],
          ["Success rate", rate === null ? "—" : `${rate}%`, "text-[#14B8A6]"],
        ].map(([label, value, color]) => (
          <Card key={label} className="p-5">
            <div className="text-xs font-semibold text-[#F1F5F9]/65">{label}</div>
            <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="p-6 lg:col-span-3">
          <h3 className="text-sm font-bold text-[#F1F5F9] mb-1">Last 14 days</h3>
          <p className="text-xs text-[#F1F5F9]/60 mb-5">Emails per day</p>
          <div className="flex items-end gap-1.5 h-36">
            {s.daily.map((d) => {
              const h = ((d.sent + d.failed) / maxDay) * 100;
              const fh = d.sent + d.failed ? (d.failed / (d.sent + d.failed)) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 h-full flex flex-col justify-end group relative" title={`${d.date}: ${d.sent} sent, ${d.failed} failed`}>
                  <div className="w-full rounded-t-md overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(h, 2)}%` }}>
                    <div className="w-full bg-[#14B8A6]" style={{ height: `${100 - fh}%` }} />
                    <div className="w-full bg-red-500" style={{ height: `${fh}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-[#F1F5F9]/50 mt-2">
            <span>{s.daily[0]?.date.slice(5)}</span>
            <span>Today</span>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#F1F5F9]">Recent emails</h3>
            <button onClick={() => go("logs")} className="text-xs font-bold text-[#14B8A6] cursor-pointer">
              View all →
            </button>
          </div>
          {!recent.data ? (
            <Spinner />
          ) : recent.data.data.length === 0 ? (
            <p className="text-sm text-[#F1F5F9]/60 py-8 text-center">No emails yet. Your sent emails will show up here.</p>
          ) : (
            <ul className="space-y-3">
              {recent.data.data.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#F1F5F9] truncate">{e.subject}</div>
                    <div className="text-[11px] text-[#F1F5F9]/60 truncate">
                      to {e.to.join(", ")} · {timeAgo(e.created_at)}
                    </div>
                  </div>
                  <StatusPill status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
