"use client";

import type { MarketplaceModel } from "./types";

interface Props {
  model: MarketplaceModel;
  temperature: number;
  maxTokens: number;
  topP: number;
  onTemperature: (value: number) => void;
  onMaxTokens: (value: number) => void;
  onTopP: (value: number) => void;
  resolution: string;
  onResolution: (value: string) => void;
  language: string;
  onLanguage: (value: string) => void;
}

export default function PlaygroundParameterPanel(props: Props) {
  const isText = props.model.inputType === "Text";
  return (
    <aside className="glass-panel rounded-2xl p-4 space-y-5 h-fit">
      <h3 className="text-sm font-bold">Parameters</h3>
      {isText ? (
        <>
          <ParameterSlider label="Temperature" value={props.temperature} min={0} max={2} step={0.1} onChange={props.onTemperature} />
          <ParameterSlider label="Max Tokens" value={props.maxTokens} min={64} max={4096} step={64} onChange={props.onMaxTokens} />
          <ParameterSlider label="Top P" value={props.topP} min={0} max={1} step={0.05} onChange={props.onTopP} />
        </>
      ) : (
        <>
          {props.model.inputType === "Image" && (
            <label className="block text-xs text-[#CBD5E1]">Resolution
              <select value={props.resolution} onChange={(event) => props.onResolution(event.target.value)} className="mt-2 w-full h-9 rounded-lg bg-[#0B1120] text-slate-100 border border-slate-700/80 px-2 focus:border-teal-400 focus:outline-none">
                <option className="bg-[#0B1120] text-slate-100">1024x1024</option><option className="bg-[#0B1120] text-slate-100">768x768</option><option className="bg-[#0B1120] text-slate-100">1536x1024</option>
              </select>
            </label>
          )}
          {(props.model.inputType === "Audio" || props.model.category === "Speech recognition") && (
            <label className="block text-xs text-[#CBD5E1]">Language
              <select value={props.language} onChange={(event) => props.onLanguage(event.target.value)} className="mt-2 w-full h-9 rounded-lg bg-[#0B1120] text-slate-100 border border-slate-700/80 px-2 focus:border-teal-400 focus:outline-none">
                {props.model.supportedLanguages.map((language) => <option className="bg-[#0B1120] text-slate-100" key={language}>{language}</option>)}
              </select>
            </label>
          )}
          {props.model.inputType === "Document" && (
            <label className="block text-xs text-[#CBD5E1]">Output format
              <select className="mt-2 w-full h-9 rounded-lg bg-[#0B1120] text-slate-100 border border-slate-700/80 px-2 focus:border-teal-400 focus:outline-none"><option className="bg-[#0B1120] text-slate-100">Structured JSON</option><option className="bg-[#0B1120] text-slate-100">Markdown</option><option className="bg-[#0B1120] text-slate-100">Plain text</option></select>
            </label>
          )}
          {props.model.inputType === "Video" && (
            <label className="block text-xs text-[#CBD5E1]">Analysis mode
              <select className="mt-2 w-full h-9 rounded-lg bg-[#0B1120] text-slate-100 border border-slate-700/80 px-2 focus:border-teal-400 focus:outline-none"><option className="bg-[#0B1120] text-slate-100">Captions + Chapters</option><option className="bg-[#0B1120] text-slate-100">Scene summary</option></select>
            </label>
          )}
        </>
      )}
    </aside>
  );
}

function ParameterSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-[#CBD5E1]">
      <span className="flex justify-between mb-2"><span>{label}</span><span className="font-mono text-[#F1F5F9]">{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[#14B8A6]" />
    </label>
  );
}
