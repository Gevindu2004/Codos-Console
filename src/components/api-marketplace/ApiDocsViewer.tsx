"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Play } from "lucide-react";
import type { ApiEndpointSpec, MarketplaceApi } from "./types";
import { apiV1BaseUrl } from "@/lib/developerApi";

interface Props {
  api: MarketplaceApi;
}

const methodStyles: Record<ApiEndpointSpec["method"], string> = {
  GET: "bg-sky-400/15 text-sky-300 border-sky-400/25",
  POST: "bg-emerald-400/15 text-emerald-300 border-emerald-400/25",
  PUT: "bg-amber-400/15 text-amber-300 border-amber-400/25",
  PATCH: "bg-violet-400/15 text-violet-300 border-violet-400/25",
  DELETE: "bg-rose-400/15 text-rose-300 border-rose-400/25",
};

export default function ApiDocsViewer({ api }: Props) {
  const [selectedId, setSelectedId] = useState(api.endpoints[0]?.id ?? "");
  const selected = api.endpoints.find((item) => item.id === selectedId) ?? api.endpoints[0];
  const [payload, setPayload] = useState(() => JSON.stringify(selected?.exampleRequest ?? {}, null, 2));
  const [response, setResponse] = useState("");
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [customerApiKey, setCustomerApiKey] = useState("");
  const [sandboxMode, setSandboxMode] = useState("");
  const [running, setRunning] = useState(false);
  const [codeLang, setCodeLang] = useState<"cURL" | "Python" | "TypeScript">("cURL");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => api.endpoints.reduce<Record<string, ApiEndpointSpec[]>>((groups, item) => {
    const resource = item.path.split("/").filter(Boolean)[0] || "General";
    (groups[resource] ??= []).push(item);
    return groups;
  }, {}), [api.endpoints]);

  if (!selected) return <div className="glass-panel rounded-2xl p-6 text-sm text-[#CBD5E1]">No endpoints are published for this API.</div>;

  const examplePath = selected.path.replace(/\{([^}]+)\}/g, "example-$1");
  const requestUrl = `${apiV1BaseUrl}/gateway/${api.slug}${examplePath.startsWith("/") ? examplePath : `/${examplePath}`}`;
  const snippets = {
    "cURL": `curl -X ${selected.method} '${requestUrl}' \\\n  -H 'X-CODOS-API-Key: $CODOS_API_KEY' \\\n  -H 'Content-Type: application/json'${selected.requestBodySchema ? ` \\\n  -d '${JSON.stringify(selected.exampleRequest ?? {})}'` : ""}`,
    Python: `import os\nimport requests\n\nresponse = requests.${selected.method.toLowerCase()}(\n    '${requestUrl}',\n    headers={'X-CODOS-API-Key': os.environ['CODOS_API_KEY']},${selected.requestBodySchema ? `\n    json=${JSON.stringify(selected.exampleRequest ?? {})},` : ""}\n)\nprint(response.json())`,
    TypeScript: `const CODOS_API_KEY = 'YOUR_CODOS_API_KEY';\nconst response = await fetch('${requestUrl}', {\n  method: '${selected.method}',\n  headers: { 'X-CODOS-API-Key': CODOS_API_KEY, 'Content-Type': 'application/json' },${selected.requestBodySchema ? `\n  body: JSON.stringify(${JSON.stringify(selected.exampleRequest ?? {})})` : ""}\n});\nconsole.log(await response.json());`,
  };

  const selectEndpoint = (item: ApiEndpointSpec) => {
    setSelectedId(item.id);
    setPayload(JSON.stringify(item.exampleRequest ?? {}, null, 2));
    setResponse("");
    setStatusCode(null);
    setLatency(null);
    setSandboxMode("");
  };

  const tryEndpoint = async () => {
    let parsedPayload: unknown = {};
    try {
      parsedPayload = payload.trim() ? JSON.parse(payload) : {};
    } catch {
      setStatusCode(400);
      setResponse(JSON.stringify({ error: "Request body must be valid JSON." }, null, 2));
      return;
    }
    setRunning(true);
    setResponse("");
    setSandboxMode("");
    const started = performance.now();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const requestOptions: RequestInit = {
        method: selected.method,
        headers: {
          ...(customerApiKey ? { "X-CODOS-API-Key": customerApiKey } : {}),
          Accept: "application/json",
          ...(selected.requestBodySchema ? { "Content-Type": "application/json" } : {}),
        },
        signal: controller.signal,
      };
      if (selected.requestBodySchema && selected.method !== "GET") {
        requestOptions.body = JSON.stringify(parsedPayload);
      }
      const result = await fetch(requestUrl, requestOptions);
      const body = await result.text();
      let output: unknown = body;
      try {
        output = body ? JSON.parse(body) : {};
      } catch {
        output = body;
      }
      setLatency(Math.round(performance.now() - started));
      setStatusCode(result.status);
      setResponse(typeof output === "string" ? output : JSON.stringify(output, null, 2));
      setSandboxMode("Live request via CODOS Gateway");
    } catch {
      const elapsed = Math.max(12, api.avgLatencyMs + Math.round(Math.random() * 45));
      setLatency(elapsed);
      setStatusCode(200);
      setResponse(JSON.stringify({
        ...selected.exampleResponse,
        _sandbox: {
          simulated: true,
          endpoint: selected.path,
          method: selected.method,
          request: parsedPayload,
        },
      }, null, 2));
      setSandboxMode("Simulated response · CODOS Gateway offline");
    } finally {
      window.clearTimeout(timeoutId);
      setRunning(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(snippets[codeLang]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-4">
      <aside className="glass-panel rounded-2xl p-4 h-fit">
        <h2 className="text-sm font-bold">Endpoints</h2>
        <div className="mt-3 space-y-3">
          {Object.entries(grouped).map(([resource, items]) => (
            <section key={resource}>
              <button onClick={() => setExpanded((current) => ({ ...current, [resource]: !(current[resource] ?? true) }))} className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-[#CBD5E1]/75 py-1">
                {resource}{(expanded[resource] ?? true) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {(expanded[resource] ?? true) && <div className="mt-1 space-y-1">
                {items.map((item) => (
                  <button key={item.id} onClick={() => selectEndpoint(item)} className={`w-full text-left rounded-lg p-2 ${selected.id === item.id ? "bg-[#14B8A6]/12 border border-[#14B8A6]/25" : "hover:bg-[#F1F5F9]/5"}`}>
                    <span className={`inline-flex min-w-12 justify-center rounded border px-1.5 py-0.5 text-[9px] font-bold ${methodStyles[item.method]}`}>{item.method}</span>
                    <span className="ml-2 text-[10px] font-mono">{item.path}</span>
                    <span className="block ml-1 mt-1 text-[10px] text-[#CBD5E1]">{item.summary}</span>
                  </button>
                ))}
              </div>}
            </section>
          ))}
        </div>
      </aside>

      <div className="space-y-4 min-w-0">
        <section className="glass-panel rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 py-1 text-[10px] font-bold ${methodStyles[selected.method]}`}>{selected.method}</span>
            <code className="text-xs break-all">{selected.path}</code>
          </div>
          <h2 className="mt-3 text-base font-bold">{selected.summary}</h2>
          <p className="mt-1 text-xs text-[#CBD5E1]">{`${apiV1BaseUrl}/gateway/${api.slug}`}</p>
          {selected.parameters.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-bold mb-2">Parameters</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead><tr className="text-[#CBD5E1]/70 border-b border-[#F1F5F9]/10"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">In</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Required</th><th className="py-2">Description</th></tr></thead>
                  <tbody>{selected.parameters.map((item) => <tr key={`${item.location}-${item.name}`} className="border-b border-[#F1F5F9]/5"><td className="py-2 pr-3 font-mono">{item.name}</td><td className="py-2 pr-3">{item.location}</td><td className="py-2 pr-3">{item.type || "string"}</td><td className="py-2 pr-3">{item.required ? "Yes" : "No"}</td><td className="py-2 text-[#CBD5E1]">{item.description}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <JsonPanel title="Request Schema" value={selected.requestBodySchema ?? { type: "object", properties: {} }} />
          <JsonPanel title="Response Schema" value={selected.responseSchema} />
        </div>
        <section className="glass-panel rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Try Endpoint</h3><span className="text-[10px] text-[#CBD5E1]">{sandboxMode || "Requests use the CODOS API Gateway when available."}</span></div>
          <label className="block text-xs text-[#CBD5E1]">CODOS API key
            <input type="password" autoComplete="new-password" value={customerApiKey} onChange={(event) => setCustomerApiKey(event.target.value)} placeholder="Enter your customer API key" className="mt-2 w-full rounded-lg bg-[#090D16] border border-[#F1F5F9]/10 px-3 py-2 text-xs outline-none focus:border-[#14B8A6]" />
          </label>
          {selected.requestBodySchema && <label className="block text-xs text-[#CBD5E1]">Request body
            <textarea value={payload} onChange={(event) => setPayload(event.target.value)} className="mt-2 w-full min-h-32 rounded-xl bg-[#090D16] border border-[#F1F5F9]/10 p-3 font-mono text-[11px] outline-none focus:border-[#14B8A6]" />
          </label>}
          <button onClick={tryEndpoint} disabled={running} className="h-9 px-4 rounded-lg bg-[#14B8A6] text-[#0F172A] text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50">
            <Play className="w-3.5 h-3.5" />{running ? "Sending..." : "Try Endpoint"}
          </button>
          {(response || statusCode) && <div className="rounded-xl border border-[#F1F5F9]/10 p-3">
            <div className="flex justify-between text-[10px] mb-2"><span>Status <b className={statusCode === 200 ? "text-emerald-300" : "text-rose-300"}>{statusCode}</b></span><span>{latency ?? "—"} ms</span></div>
            <pre className="overflow-x-auto text-[10px] text-[#CBD5E1]">{response}</pre>
          </div>}
        </section>
        <section className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Code examples</h3><div className="flex items-center gap-1">
            {(["cURL", "Python", "TypeScript"] as const).map((lang) => <button key={lang} onClick={() => setCodeLang(lang)} className={`px-2 py-1 rounded text-[10px] ${codeLang === lang ? "bg-[#14B8A6]/15 text-[#14B8A6]" : "text-[#CBD5E1]"}`}>{lang}</button>)}
            <button onClick={copyCode} className="ml-1 inline-flex items-center gap-1 text-[10px] text-[#CBD5E1]">{copied ? <Check className="w-3 h-3 text-[#14B8A6]" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}</button>
          </div></div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[#090D16] p-4 text-[10px] text-[#CBD5E1]">{snippets[codeLang]}</pre>
        </section>
        <section className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-bold">HTTP errors</h3>
          <div className="mt-2 space-y-2">{selected.errorCodes.map((item) => <div key={item.code} className="flex gap-3 text-[10px]"><b className="font-mono text-amber-300">{item.code}</b><span className="text-[#CBD5E1]">{item.description}</span></div>)}</div>
        </section>
      </div>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: Record<string, unknown> }) {
  return <section className="glass-panel rounded-2xl p-4 min-w-0"><h3 className="text-xs font-bold">{title}</h3><pre className="mt-3 overflow-x-auto rounded-xl bg-[#090D16] p-3 text-[10px] text-[#CBD5E1]">{JSON.stringify(value, null, 2)}</pre></section>;
}
