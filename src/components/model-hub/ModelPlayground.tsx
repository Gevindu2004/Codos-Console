"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Braces, FileUp, Play } from "lucide-react";
import type { MarketplaceModel } from "./types";
import PlaygroundParameterPanel from "./PlaygroundParameterPanel";

interface Props {
  model: MarketplaceModel;
}

export default function ModelPlayground({ model }: Props) {
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [topP, setTopP] = useState(0.9);
  const [resolution, setResolution] = useState("1024x1024");
  const [language, setLanguage] = useState(model.supportedLanguages[0] || "English");
  const [systemPrompt, setSystemPrompt] = useState(model.providerType === "via_codos" ? "You are a helpful CODOS AI assistant." : "");
  const [prompt, setPrompt] = useState(model.sampleInputs[0] || "");
  const [schemaValues, setSchemaValues] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [fileName, setFileName] = useState("");
  const [output, setOutput] = useState("");
  const [latency, setLatency] = useState(model.avgLatencyMs);
  const [tokens, setTokens] = useState(0);
  const isText = model.inputType === "Text";
  const rawProperties = model.inputSchema.properties;
  const schemaProperties = rawProperties && typeof rawProperties === "object" && !Array.isArray(rawProperties)
    ? Object.entries(rawProperties as Record<string, unknown>)
    : [];
  const requiredInputs = Array.isArray(model.inputSchema.required)
    ? model.inputSchema.required.filter((value): value is string => typeof value === "string")
    : [];
  const builtInInputNames = new Set(["prompt", "temperature", "maxTokens", "topP", "language", "resolution"]);
  if (model.providerType === "via_codos") builtInInputNames.add("systemPrompt");
  const fileInputNames = new Set(schemaProperties
    .filter(([, property]) => property !== null && typeof property === "object" && (property as Record<string, unknown>).format === "binary")
    .map(([name]) => name));

  const runTest = () => {
    const missing = requiredInputs.filter((name) => {
      if (name === "prompt") return !prompt.trim();
      if (name === "systemPrompt" && model.providerType === "via_codos") return !systemPrompt.trim();
      if (name === "file" || fileInputNames.has(name)) return !fileName.trim();
      if (["temperature", "maxTokens", "topP"].includes(name)) return false;
      return !schemaValues[name]?.trim();
    });
    if (missing.length) {
      setOutput(`Required schema inputs missing: ${missing.join(", ")}.`);
      return;
    }
    setIsRunning(true);
    setOutput("");
    window.setTimeout(() => {
      const elapsed = Math.max(model.avgLatencyMs, 180) + Math.round(Math.random() * 120);
      const used = isText ? Math.max(42, Math.round(prompt.length / 3.2)) : 0;
      setLatency(elapsed);
      setTokens(used);
      setOutput(isText
        ? `Response preview for "${model.name}":\n\n${prompt}\n\nThis simulated response demonstrates the selected model's generated output, grounded against CODOS routing telemetry and the configured parameters.`
        : JSON.stringify({
            status: "success",
            model: model.slug,
            file: fileName || "sample-test-file",
            language,
            resolution,
            input: schemaValues,
            result: model.category === "Document processing"
              ? { documentType: "invoice", fields: { invoiceId: "INV-2026-018", total: "$1,240.00" }, confidence: 0.96 }
              : { preview: "Structured model output is ready.", confidence: 0.94 },
          }, null, 2));
      setIsRunning(false);
    }, 850);
  };

  const validateFile = (file: File) => {
    if (model.maxFileSizeMb && file.size > model.maxFileSizeMb * 1024 * 1024) {
      setOutput(`File rejected: maximum size is ${model.maxFileSizeMb} MB.`);
      return;
    }
    if (model.acceptedFormats?.length && !model.acceptedFormats.includes(file.type)) {
      setOutput(`Unsupported format: ${file.type || "unknown"}. Accepted formats: ${model.acceptedFormats.join(", ")}`);
      return;
    }
    setFileName(file.name);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-4">
      <div className="space-y-4">
        {isText ? (
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            {model.providerType === "via_codos" && (
              <label className="block text-xs text-[#CBD5E1]">System prompt
                <textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} className="mt-2 w-full h-20 resize-none rounded-xl bg-[#0F172A]/40 border border-[#F1F5F9]/12 p-3 text-sm outline-none focus:border-[#14B8A6]" />
              </label>
            )}
            <label className="block text-xs text-[#CBD5E1]">User prompt
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Enter a prompt to test this model..." className="mt-2 w-full h-32 resize-none rounded-xl bg-[#0F172A]/40 border border-[#F1F5F9]/12 p-3 text-sm outline-none focus:border-[#14B8A6]" />
            </label>
            <div className="flex flex-wrap gap-2">
              {model.sampleInputs.map((sample) => (
                <button key={sample} onClick={() => setPrompt(sample)} className="text-[10px] px-2.5 py-1.5 rounded-full border border-[#F1F5F9]/12 text-[#CBD5E1] hover:border-[#14B8A6]/50">{sample.length > 46 ? `${sample.slice(0, 46)}...` : sample}</button>
              ))}
            </div>
          </div>
        ) : (
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) validateFile(file); }}
            className="glass-panel rounded-2xl p-5 border-dashed"
          >
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center text-center">
              <input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) validateFile(file); }} accept={model.acceptedFormats?.join(",")} />
              <FileUp className="w-7 h-7 text-[#14B8A6] mb-2" />
              <span className="text-sm font-semibold">{fileName || "Drag & drop or choose a file"}</span>
              <span className="mt-1 text-[10px] text-[#CBD5E1]">{model.acceptedFormats?.join(", ") || "Supported input"} · Max {model.maxFileSizeMb || 50} MB</span>
            </label>
            {model.sampleInputs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {model.sampleInputs.map((sample) => <button key={sample} onClick={() => setFileName(sample)} className="text-[10px] px-2.5 py-1.5 rounded-full border border-[#F1F5F9]/12">{sample}</button>)}
              </div>
            )}
          </div>
        )}
        {schemaProperties.some(([name, property]) =>
          !builtInInputNames.has(name) &&
          !fileInputNames.has(name) &&
          !(name === "file" && property !== null && typeof property === "object" && (property as Record<string, unknown>).format === "binary"),
        ) && (
          <section className="glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold">Schema-defined inputs</h3>
            {schemaProperties.map(([name, propertyValue]) => {
              const property = propertyValue !== null && typeof propertyValue === "object"
                ? propertyValue as Record<string, unknown>
                : {};
              const type = typeof property.type === "string" ? property.type : "string";
              const format = typeof property.format === "string" ? property.format : "";
              const description = typeof property.description === "string" ? property.description : "";
              if (builtInInputNames.has(name) || fileInputNames.has(name) || (name === "file" && format === "binary")) return null;
              if (type === "boolean") {
                return <label key={name} className="flex items-center gap-2 text-xs text-[#CBD5E1]"><input type="checkbox" checked={schemaValues[name] === "true"} onChange={(event) => setSchemaValues((values) => ({ ...values, [name]: String(event.target.checked) }))} className="accent-[#14B8A6]" /><span>{name}{requiredInputs.includes(name) ? " *" : ""}</span></label>;
              }
              const value = schemaValues[name] ?? "";
              return <label key={name} className="block text-xs text-[#CBD5E1]">{name}{requiredInputs.includes(name) ? " *" : ""}
                {type === "object" || type === "array"
                  ? <textarea value={value} onChange={(event) => setSchemaValues((values) => ({ ...values, [name]: event.target.value }))} rows={3} placeholder={description || `Enter ${type} data`} className="mt-1.5 w-full rounded-lg border border-[#F1F5F9]/12 bg-[#0F172A]/50 p-2 text-xs text-[#F1F5F9] outline-none focus:border-[#14B8A6]" />
                  : <input type={type === "number" || type === "integer" ? "number" : "text"} value={value} onChange={(event) => setSchemaValues((values) => ({ ...values, [name]: event.target.value }))} placeholder={description || `Enter ${name}`} className="mt-1.5 w-full rounded-lg border border-[#F1F5F9]/12 bg-[#0F172A]/50 px-3 py-2 text-xs text-[#F1F5F9] outline-none focus:border-[#14B8A6]" />}
              </label>;
            })}
          </section>
        )}
        <button onClick={runTest} disabled={isRunning} className="h-10 px-4 rounded-xl bg-[#14B8A6] text-[#0F172A] text-xs font-bold flex items-center gap-2 disabled:opacity-60">
          {isRunning ? "Running test..." : <><Play className="w-4 h-4" />Run Test</>}
        </button>
        <div className="glass-panel rounded-2xl p-4 min-h-52">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold">Output</span>
            <div className="flex items-center gap-2">
              {output && <button onClick={() => setShowJson((value) => !value)} className="text-[10px] flex items-center gap-1 text-[#CBD5E1]"><Braces className="w-3 h-3" />{showJson ? "Preview" : "Raw JSON"}</button>}
              {model.providerType === "via_codos" && (
                <Link href="/console" className="text-[10px] text-[#14B8A6] flex items-center gap-1">Open Full RAG Workspace <ArrowUpRight className="w-3 h-3" /></Link>
              )}
            </div>
          </div>
          {isRunning ? (
            <div className="h-28 flex items-center gap-2 text-xs text-[#CBD5E1]"><span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />Streaming response...</div>
          ) : output ? (
            showJson && isText ? <pre className="text-xs whitespace-pre-wrap text-[#CBD5E1]">{JSON.stringify({ response: output, input: schemaValues, latencyMs: latency, tokens }, null, 2)}</pre> : <pre className="text-xs whitespace-pre-wrap text-[#CBD5E1]">{output}</pre>
          ) : (
            <div className="h-28 flex items-center justify-center text-xs text-[#CBD5E1]/60">Run a test to inspect the response.</div>
          )}
          {output && (
            <div className="mt-4 pt-3 border-t border-[#F1F5F9]/10 flex gap-4 text-[10px] font-mono text-[#CBD5E1]">
              <span>{latency} ms latency</span><span>{tokens || 1} tokens / estimate</span>
            </div>
          )}
        </div>
      </div>
      <PlaygroundParameterPanel model={model} temperature={temperature} maxTokens={maxTokens} topP={topP} onTemperature={setTemperature} onMaxTokens={setMaxTokens} onTopP={setTopP} resolution={resolution} onResolution={setResolution} language={language} onLanguage={setLanguage} />
    </div>
  );
}
