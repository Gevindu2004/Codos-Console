"use client";

import React, { useState } from "react";
import { Inbox, Link2, Paperclip, RefreshCw, Search } from "lucide-react";
import { TuEmail, formatDateTime, humanSize, timeAgo } from "./api";
import { useTuData } from "./hooks";
import { Button, Card, EmptyState, Input, Modal, Notice, SectionHeader, Select, Spinner, StatusPill, TabBar, Tag, cx } from "./ui";

const SOURCE_LABEL: Record<string, string> = {
  api: "API",
  form: "Website form",
  dashboard: "Dashboard test",
  auto_reply: "Auto-reply",
};

const PAGE = 20;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function LogsView() {
  const [status, setStatus] = useState<"all" | "sent" | "delivered" | "bounced" | "failed" | "queued">("all");
  const [source, setSource] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
  if (status !== "all") params.set("status", status);
  if (source) params.set("source", source);
  if (search) params.set("q", search);
  const list = useTuData<{ data: TuEmail[]; total: number }>(`/dashboard/emails?${params}`);

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE)) : 1;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Email logs"
        subtitle="Every email you send is listed here: who it went to, what it said, and whether it was delivered."
        action={
          <Button variant="secondary" onClick={list.reload}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      <Card className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <TabBar
          tabs={[
            { id: "all", label: "All" },
            { id: "sent", label: "Sent" },
            { id: "delivered", label: "Delivered" },
            { id: "bounced", label: "Bounced" },
            { id: "failed", label: "Failed" },
            { id: "queued", label: "Queued" },
          ]}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
        />
        <Select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(0);
          }}
          className="lg:w-48"
        >
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <form
          className="flex-1 relative"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            setPage(0);
          }}
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#F1F5F9]/50" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by subject, recipient or email ID, then press Enter" className="pl-9" />
        </form>
      </Card>

      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data ? (
        <Spinner />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-6 h-6" />}
          title={search || status !== "all" || source ? "No emails match your filters" : "No emails yet"}
          text={search || status !== "all" || source ? "Try another filter or search." : "Emails you send through the API, website forms or the dashboard will appear here."}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#F1F5F9]/60 border-b border-[#F1F5F9]/10">
            <div className="col-span-2">Status</div>
            <div className="col-span-3">To</div>
            <div className="col-span-4">Subject</div>
            <div className="col-span-1">Source</div>
            <div className="col-span-2 text-right">When</div>
          </div>
          <div className="divide-y divide-[#F1F5F9]/10">
            {list.data.data.map((e) => (
              <button
                key={e.id}
                onClick={() => setOpenId(e.id)}
                className="w-full text-left grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-3 px-5 py-3.5 hover:bg-[#14B8A6]/5 transition-colors cursor-pointer items-center"
              >
                <div className="md:col-span-2">
                  <StatusPill status={e.status} />
                </div>
                <div className="md:col-span-3 text-sm text-[#F1F5F9] truncate">{e.to.join(", ")}</div>
                <div className="md:col-span-4 text-sm text-[#F1F5F9]/85 truncate flex items-center gap-1.5">
                  {e.attachments.length > 0 && <Paperclip className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />}
                  <span className="truncate">{e.subject}</span>
                </div>
                <div className="md:col-span-1">
                  <Tag tone="slate">{SOURCE_LABEL[e.source]}</Tag>
                </div>
                <div className="md:col-span-2 md:text-right text-xs text-[#F1F5F9]/60">{timeAgo(e.created_at)}</div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F1F5F9]/10 text-xs text-[#F1F5F9]/65">
            <span>
              {list.data.total.toLocaleString()} email{list.data.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                ← Newer
              </Button>
              <span>
                Page {page + 1} of {pages}
              </span>
              <Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Older →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {openId && <EmailDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function EmailDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error } = useTuData<{ data: TuEmail }>(`/dashboard/emails/${id}`);
  const [tab, setTab] = useState<"preview" | "text" | "details">("preview");
  const e = data?.data;

  return (
    <Modal open onClose={onClose} title="Email details" wide>
      {error && <Notice tone="error">{error}</Notice>}
      {!e ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={e.status} />
            <Tag tone="slate">{SOURCE_LABEL[e.source]}</Tag>
            <span className="text-xs font-mono text-[#F1F5F9]/60">{e.id}</span>
          </div>
          {e.error && (
            <Notice tone={e.status === "queued" || e.status === "sent" ? "warning" : "error"} title={e.status === "queued" ? "Will retry automatically" : "What happened"}>
              {e.error}
            </Notice>
          )}
          {e.suppressed.length > 0 && (
            <Notice tone="warning">Skipped because they bounced or complained before: {e.suppressed.join(", ")}</Notice>
          )}
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {[
              ["From", e.from],
              ["To", e.to.join(", ")],
              ["CC", e.cc.join(", ") || "—"],
              ["Reply-to", e.reply_to || "—"],
              ["Created", formatDateTime(e.created_at)],
              ["Sent", formatDateTime(e.sent_at)],
              ["Delivered", formatDateTime(e.delivered_at)],
              ["Attempts", String(e.attempts)],
              ...(e.origin ? [["Website", e.origin]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 min-w-0">
                <span className="text-[#F1F5F9]/60 w-20 shrink-0">{k}</span>
                <span className="text-[#F1F5F9] break-all">{v}</span>
              </div>
            ))}
          </div>

          {e.attachments.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[#F1F5F9]/85">Files</div>
              {e.attachments.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[#F1F5F9]/12 px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 text-[#F1F5F9]">
                    {a.delivery === "link" ? <Link2 className="w-3.5 h-3.5 text-[#14B8A6]" /> : <Paperclip className="w-3.5 h-3.5 text-[#14B8A6]" />}
                    {a.filename} <span className="text-[#F1F5F9]/60">{humanSize(a.size)}</span>
                  </span>
                  <Tag tone={a.delivery === "link" ? "violet" : "teal"}>{a.delivery === "link" ? "Download link" : "Attached"}</Tag>
                </div>
              ))}
            </div>
          )}

          <TabBar
            tabs={[
              { id: "preview", label: "Preview" },
              { id: "text", label: "Plain text" },
              { id: "details", label: e.source === "form" ? "Form fields" : "Data" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div className="rounded-xl overflow-hidden border border-[#F1F5F9]/12">
            {tab === "preview" && (
              <>
                <div className="bg-white px-4 py-2.5 border-b border-slate-200 text-sm font-semibold text-slate-900">{e.subject}</div>
                <iframe title="Email preview" sandbox="" srcDoc={e.html || `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;padding:16px">${escapeHtml(e.text || "")}</pre>`} className="w-full h-[380px] bg-white" />
              </>
            )}
            {tab === "text" && <pre className="p-4 text-xs whitespace-pre-wrap text-[#F1F5F9] max-h-[420px] overflow-auto">{e.text}</pre>}
            {tab === "details" && (
              <div className="p-4">
                {e.variables && Object.keys(e.variables).length > 0 ? (
                  <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
                    {Object.entries(e.variables).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt className="text-[#F1F5F9]/60 font-semibold truncate">{k}</dt>
                        <dd className={cx("col-span-2 text-[#F1F5F9] break-words whitespace-pre-wrap")}>{String(v)}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-[#F1F5F9]/60">No extra data for this email.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
