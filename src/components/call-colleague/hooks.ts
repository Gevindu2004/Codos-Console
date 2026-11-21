"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Vapi from "@vapi-ai/web";
import { useOnboardingStore } from "./CallColleagueContext";
import { VOICE_PERSONAS } from "./industryTemplates";
import { AgentProvisionPayload, ProvisionResponse } from "./types";

const MALE_VOICE_KEYWORDS = [
  "uk english male",
  "david",
  "mark",
  "guy",
  "ryan",
  "george",
  "andrew",
  "brian",
  "christopher",
  "eric",
  "steffan",
  "davis",
  "jason",
  "tony",
  "william",
  "james",
  "prabhat",
  "ravi",
  "rishi",
  "madhur",
  "daniel",
  "alex",
  "oliver",
  "arthur",
  "fred",
  "aaron",
  "thomas",
  "gordon",
  "lee",
  "sam",
  "benjamin",
  "sean",
  "mitchell",
  "connor",
  "male",
];

const FEMALE_VOICE_KEYWORDS = [
  "uk english female",
  "google us english",
  "zira",
  "aria",
  "jenny",
  "michelle",
  "ana",
  "emma",
  "ava",
  "libby",
  "sonia",
  "maisie",
  "hazel",
  "susan",
  "catherine",
  "natasha",
  "hayley",
  "samantha",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "neerja",
  "heera",
  "swara",
  "kalpana",
  "veena",
  "clara",
  "molly",
  "fiona",
  "female",
];

interface PersonaSpeechProfile {
  isMale: boolean;
  langPrefs: string[];
  preferredVoiceNames: string[];
  fallbackSlotIndex: number;
  matchedPitch: number;
  fallbackPitch: number;
  rate: number;
}

const PERSONA_SPEECH_PROFILES: Record<string, PersonaSpeechProfile> = {
  sophia: {
    isMale: false,
    langPrefs: ["en-us"],
    preferredVoiceNames: ["aria", "jenny", "ava", "emma", "google us english", "samantha", "zira"],
    fallbackSlotIndex: 0,
    matchedPitch: 1.1,
    fallbackPitch: 1.18,
    rate: 1.04,
  },
  maya: {
    isMale: false,
    langPrefs: ["en-gb", "en-ie"],
    preferredVoiceNames: ["sonia", "libby", "maisie", "google uk english female", "hazel", "susan", "moira"],
    fallbackSlotIndex: 1,
    matchedPitch: 1.0,
    fallbackPitch: 1.08,
    rate: 0.96,
  },
  marcus: {
    isMale: true,
    langPrefs: ["en-us"],
    preferredVoiceNames: ["andrew", "christopher", "david", "guy", "davis", "eric", "mark"],
    fallbackSlotIndex: 0,
    matchedPitch: 0.78,
    fallbackPitch: 0.56,
    rate: 0.92,
  },
  liam: {
    isMale: true,
    langPrefs: ["en-au", "en-nz", "en-gb"],
    preferredVoiceNames: ["william", "james", "ryan", "george", "daniel", "oliver", "google uk english male", "mark", "guy"],
    fallbackSlotIndex: 1,
    matchedPitch: 1.04,
    fallbackPitch: 0.78,
    rate: 1.08,
  },
  arjun: {
    isMale: true,
    langPrefs: ["en-in", "en-lk", "en-gb"],
    preferredVoiceNames: ["prabhat", "ravi", "rishi", "madhur", "arthur", "brian", "tony", "mark", "google uk english male"],
    fallbackSlotIndex: 2,
    matchedPitch: 0.91,
    fallbackPitch: 0.67,
    rate: 0.97,
  },
};

function matchesVoiceKeyword(voiceNameLower: string, keyword: string): boolean {
  if (keyword.includes(" ")) {
    return voiceNameLower.includes(keyword);
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(voiceNameLower);
}

function getPersonaProfile(voiceName: string): PersonaSpeechProfile {
  const key = voiceName.trim().toLowerCase();
  if (PERSONA_SPEECH_PROFILES[key]) {
    return PERSONA_SPEECH_PROFILES[key];
  }
  const persona = VOICE_PERSONAS.find(
    (p) => p.name.toLowerCase() === key || p.id.toLowerCase() === key
  );
  if (persona && PERSONA_SPEECH_PROFILES[persona.name.toLowerCase()]) {
    return PERSONA_SPEECH_PROFILES[persona.name.toLowerCase()];
  }
  const isMale = persona?.gender.toLowerCase() === "male";
  return {
    isMale,
    langPrefs: ["en-us"],
    preferredVoiceNames: [],
    fallbackSlotIndex: 0,
    matchedPitch: isMale ? 0.88 : 1.06,
    fallbackPitch: isMale ? 0.65 : 1.15,
    rate: isMale ? 0.97 : 1.02,
  };
}

function classifyVoiceGender(voice: SpeechSynthesisVoice): "male" | "female" | "unknown" {
  const lower = voice.name.toLowerCase();
  const isExplicitFemale = FEMALE_VOICE_KEYWORDS.some((kw) =>
    matchesVoiceKeyword(lower, kw)
  );
  const isExplicitMale = MALE_VOICE_KEYWORDS.some((kw) =>
    matchesVoiceKeyword(lower, kw)
  );
  if (isExplicitMale && !isExplicitFemale) return "male";
  if (isExplicitFemale && !isExplicitMale) return "female";
  return "unknown";
}

function scoreVoiceForProfile(
  voice: SpeechSynthesisVoice,
  profile: PersonaSpeechProfile
): number {
  const lower = voice.name.toLowerCase();
  const normLang = voice.lang.toLowerCase().replace("_", "-");
  const gender = classifyVoiceGender(voice);

  let score = 0;

  if (profile.isMale) {
    if (gender === "male") score += 200;
    else if (gender === "female") score -= 250;
  } else {
    if (gender === "female") score += 200;
    else if (gender === "male") score -= 250;
  }

  // Prefer higher-priority language/accent prefixes earlier in langPrefs
  const langIdx = profile.langPrefs.findIndex((prefix) =>
    normLang.startsWith(prefix)
  );
  if (langIdx !== -1) {
    score += 60 - langIdx * 18;
  }

  // Prefer persona-specific named voices earlier in preferredVoiceNames
  const nameIdx = profile.preferredVoiceNames.findIndex((hint) =>
    matchesVoiceKeyword(lower, hint)
  );
  if (nameIdx !== -1) {
    score += 45 - nameIdx * 4;
  }

  if (lower.includes("natural") || lower.includes("neural") || lower.includes("online")) {
    score += 14;
  }

  return score;
}

function resolveBestSpeechVoice(
  voices: SpeechSynthesisVoice[],
  voiceName: string
): {
  voice: SpeechSynthesisVoice | null;
  isMatchedGender: boolean;
  profile: PersonaSpeechProfile;
} {
  const profile = getPersonaProfile(voiceName);
  const englishVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith("en")
  );
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  if (pool.length === 0) {
    return { voice: null, isMatchedGender: false, profile };
  }

  const targetGender = profile.isMale ? "male" : "female";
  const sameGenderPersonas = VOICE_PERSONAS.filter(
    (p) => (p.gender.toLowerCase() === "male") === profile.isMale
  );
  const genderMatchedPool = pool.filter(
    (v) => classifyVoiceGender(v) === targetGender
  );

  // Assign distinct voices across personas of the same gender whenever multiple voices exist
  if (sameGenderPersonas.some((p) => p.name.toLowerCase() === voiceName.trim().toLowerCase())) {
    const usedVoiceUris = new Set<string>();
    const assigned = new Map<string, SpeechSynthesisVoice>();

    // First pass: assign personas that have an exact primary language + gender match
    const orderedPersonas = [...sameGenderPersonas].sort((a, b) => {
      const pa = getPersonaProfile(a.name);
      const pb = getPersonaProfile(b.name);
      const aHasPrimaryLang = genderMatchedPool.some((v) =>
        v.lang.toLowerCase().replace("_", "-").startsWith(pa.langPrefs[0])
      );
      const bHasPrimaryLang = genderMatchedPool.some((v) =>
        v.lang.toLowerCase().replace("_", "-").startsWith(pb.langPrefs[0])
      );
      if (aHasPrimaryLang !== bHasPrimaryLang) return aHasPrimaryLang ? -1 : 1;
      return pa.fallbackSlotIndex - pb.fallbackSlotIndex;
    });

    for (const p of orderedPersonas) {
      const pProfile = getPersonaProfile(p.name);
      const candidates = [...pool].sort(
        (v1, v2) => scoreVoiceForProfile(v2, pProfile) - scoreVoiceForProfile(v1, pProfile)
      );
      const genderCandidates = candidates.filter(
        (v) => classifyVoiceGender(v) === targetGender
      );

      let picked: SpeechSynthesisVoice | undefined;
      if (genderCandidates.length > 0) {
        picked =
          genderCandidates.find((v) => !usedVoiceUris.has(v.voiceURI)) ||
          genderCandidates[pProfile.fallbackSlotIndex % genderCandidates.length];
      } else {
        picked =
          candidates.find((v) => !usedVoiceUris.has(v.voiceURI)) ||
          candidates[pProfile.fallbackSlotIndex % candidates.length];
      }

      if (picked) {
        assigned.set(p.name.toLowerCase(), picked);
        usedVoiceUris.add(picked.voiceURI);
      }
    }

    const mappedVoice = assigned.get(voiceName.trim().toLowerCase()) || null;
    if (mappedVoice) {
      return {
        voice: mappedVoice,
        isMatchedGender: classifyVoiceGender(mappedVoice) === targetGender,
        profile,
      };
    }
  }

  const bestVoice =
    [...pool].sort(
      (v1, v2) => scoreVoiceForProfile(v2, profile) - scoreVoiceForProfile(v1, profile)
    )[0] || null;

  return {
    voice: bestVoice,
    isMatchedGender: bestVoice ? classifyVoiceGender(bestVoice) === targetGender : false,
    profile,
  };
}

let activeSpeechToken = 0;
let activeUtteranceRef: SpeechSynthesisUtterance | null = null;

export function stopPersonaSpeech(): void {
  activeSpeechToken += 1;
  activeUtteranceRef = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakWithPersona(
  text: string,
  voiceName: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    callbacks?.onEnd?.();
    return;
  }

  const token = ++activeSpeechToken;
  const synth = window.speechSynthesis;
  synth.cancel();

  const runSpeak = () => {
    if (token !== activeSpeechToken) return;

    const voices = synth.getVoices();
    const { voice, isMatchedGender, profile } = resolveBestSpeechVoice(
      voices,
      voiceName
    );

    const utterance = new SpeechSynthesisUtterance(text);
    activeUtteranceRef = utterance;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.rate = profile.rate;
    utterance.pitch = isMatchedGender
      ? profile.matchedPitch
      : profile.fallbackPitch;

    utterance.onstart = () => {
      if (token === activeSpeechToken) callbacks?.onStart?.();
    };
    utterance.onend = () => {
      if (activeUtteranceRef === utterance) activeUtteranceRef = null;
      if (token === activeSpeechToken) callbacks?.onEnd?.();
    };
    utterance.onerror = () => {
      if (activeUtteranceRef === utterance) activeUtteranceRef = null;
      if (token === activeSpeechToken) callbacks?.onEnd?.();
    };

    synth.speak(utterance);
  };

  if (synth.getVoices().length === 0) {
    let spoken = false;
    const handleVoicesChanged = () => {
      if (spoken) return;
      spoken = true;
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      runSpeak();
    };
    synth.addEventListener("voiceschanged", handleVoicesChanged);
    window.setTimeout(() => {
      if (!spoken) {
        spoken = true;
        synth.removeEventListener("voiceschanged", handleVoicesChanged);
        runSpeak();
      }
    }, 150);
  } else {
    runSpeak();
  }
}

export interface ProvisioningStepResult {
  step: "supabase_tenant" | "vapi_assistant" | "phone_binding" | "smoke_test";
  status: "pending" | "in_progress" | "completed";
  label: string;
  detail: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export const api = {
  provisionAgent: async (
    payload: AgentProvisionPayload,
    onStepUpdate?: (step: ProvisioningStepResult["step"]) => void
  ): Promise<ProvisionResponse> => {
    onStepUpdate?.("supabase_tenant");
    onStepUpdate?.("vapi_assistant");

    const response = await fetch(`${API_BASE_URL}/agents/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as {
        detail?: string;
        error?: string;
      };
      throw new Error(err.detail || err.error || "Failed to provision Vapi agent");
    }

    onStepUpdate?.("phone_binding");
    onStepUpdate?.("smoke_test");
    return (await response.json()) as ProvisionResponse;
  },

  searchAvailableNumbers: async (
    country: string,
    areaCode: string,
    numberType: string
  ): Promise<{
    mode: "twilio" | "sandbox";
    country: string;
    numberType: string;
    requiresBundle: boolean;
    numbers: import("./types").AvailablePhoneNumber[];
    error?: string;
  }> => {
    const params = new URLSearchParams({ country, numberType });
    if (areaCode.trim()) params.set("areaCode", areaCode.trim());
    const response = await fetch(
      `${API_BASE_URL}/telephony/numbers/search?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error("Failed to search available numbers");
    }
    return response.json();
  },

  triggerOtpVerification: async (
    phoneNumber: string
  ): Promise<{ sent: boolean; demoCode?: string }> => {
    const response = await fetch(`${API_BASE_URL}/telephony/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", phoneNumber }),
    });
    return (await response.json()) as { sent: boolean; demoCode?: string };
  },

  verifyOtpCode: async (
    phoneNumber: string,
    code: string
  ): Promise<{ verified: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/telephony/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", phoneNumber, code }),
    });
    return (await response.json()) as { verified: boolean };
  },
};

const CC_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

/**
 * Real per-tenant Google Calendar OAuth (server-side code flow).
 * The agent must already exist (provisioned) so the refresh token can be
 * stored against its tenant. Google redirects back to /console?gcal=...
 */
export const useGoogleAuth = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const connectGoogleCalendar = useCallback(async (agentId: string) => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const res = await fetch(
        `${CC_API_BASE}/integrations/google/connect?agentId=${encodeURIComponent(agentId)}`
      );
      const data = await res.json();
      if (!res.ok || !data.authUrl) {
        throw new Error(data.detail || "Could not start Google sign-in.");
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Google sign-in failed.");
      setIsConnecting(false);
    }
  }, []);

  const disconnectGoogleCalendar = useCallback(async (agentId: string) => {
    setAuthError(null);
    try {
      const res = await fetch(
        `${CC_API_BASE}/integrations/google/${encodeURIComponent(agentId)}`,
        { method: "DELETE" }
      );
      return res.ok;
    } catch {
      setAuthError("Could not disconnect Google Calendar.");
      return false;
    }
  }, []);

  return {
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    isConnecting,
    authError,
  };
};

export const useVapiWeb = (voiceName: string = "Sophia") => {
  const {
    businessName,
    industry,
    timezone,
    operatingHours,
    services,
    departments,
    knowledgeFaqs,
    voicePersona,
  } = useOnboardingStore();

  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [transcript, setTranscript] = useState<
    { role: "agent" | "user"; text: string }[]
  >([]);

  const vapiRef = useRef<Vapi | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const speakText = useCallback(
    (text: string) => {
      speakWithPersona(text, voiceName);
    },
    [voiceName]
  );

  const startCall = useCallback(async () => {
    setIsConnecting(true);
    setIsMuted(false);
    setTranscript([]);
    clearTimers();
    stopPersonaSpeech();

    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim();
    const hasRealVapiKey = Boolean(publicKey && publicKey !== "API KEY 1");

    if (hasRealVapiKey && publicKey) {
      try {
        if (vapiRef.current) {
          await vapiRef.current.stop().catch(() => {});
          vapiRef.current = null;
        }

        let assistantDto: Record<string, unknown> | null = null;
        try {
          const res = await fetch(`${API_BASE_URL}/agents/sandbox-config`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessName,
              industry,
              timezone,
              operatingHours,
              services,
              departments,
              knowledgeFaqs,
              voicePersona,
            }),
          });
          if (res.ok) {
            assistantDto = (await res.json()) as Record<string, unknown>;
          }
        } catch {
          // Fall back to client-built inline DTO if backend is unreachable
        }

        if (!assistantDto) {
          const voiceMap: Record<string, string> = {
            "v-sophia": "nova",
            "v-maya": "shimmer",
            "v-marcus": "onyx",
            "v-liam": "echo",
            "v-arjun": "fable",
          };
          assistantDto = {
            name: `${businessName || "CallColleague"} (${voiceName})`.slice(0, 40),
            firstMessage: `Hi! Thank you for calling ${
              businessName || "our office"
            }. This is ${voiceName}, your AI receptionist. How can I help you today?`,
            transcriber: {
              provider: "deepgram",
              model: "nova-2",
              language: "en",
            },
            model: {
              provider: "openai",
              model: "gpt-4o-mini",
              temperature: 0.3,
              messages: [
                {
                  role: "system",
                  content: `You are ${voiceName}, the AI receptionist for ${businessName} (${timezone}). Services: ${JSON.stringify(
                    services
                  )}. FAQs: ${JSON.stringify(
                    knowledgeFaqs
                  )}. Operating hours: ${JSON.stringify(operatingHours)}.`,
                },
              ],
            },
            voice: {
              provider: "openai",
              voiceId: voiceMap[voicePersona.id] || "nova",
            },
            maxDurationSeconds: 180,
            silenceTimeoutSeconds: 30,
          };
        }

        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        vapi.on("call-start", () => {
          setIsConnecting(false);
          setIsCallActive(true);
        });

        vapi.on("call-end", () => {
          setIsCallActive(false);
          setIsConnecting(false);
          setVolumeLevel(0);
          vapiRef.current = null;
        });

        vapi.on("volume-level", (vol: number) => {
          setVolumeLevel(Math.min(1, vol + 0.12));
        });

        vapi.on("message", (msg: unknown) => {
          const payload = msg as {
            type?: string;
            transcriptType?: string;
            role?: string;
            transcript?: string;
          };
          if (
            payload?.type === "transcript" &&
            payload?.transcriptType === "final" &&
            payload?.transcript
          ) {
            setTranscript((prev) => [
              ...prev,
              {
                role: payload.role === "user" ? "user" : "agent",
                text: payload.transcript!,
              },
            ]);
          }
        });

        vapi.on("error", (err: unknown) => {
          console.warn("[Vapi WebRTC]", err);
          setIsConnecting(false);
          setIsCallActive(false);
          setVolumeLevel(0);
        });

        await vapi.start(
          assistantDto as unknown as Parameters<Vapi["start"]>[0]
        );
        return;
      } catch (err) {
        console.warn("[Vapi WebRTC start failed]", err);
        vapiRef.current = null;
        setIsConnecting(false);
        setIsCallActive(false);
        return;
      }
    }

    // Fallback browser simulation when NEXT_PUBLIC_VAPI_PUBLIC_KEY is not configured
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMicVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolumeLevel(Math.min(1, avg / 65 + 0.15));
        animFrameRef.current = requestAnimationFrame(updateMicVolume);
      };
      updateMicVolume();
    } catch {
      // Fallback simulated volume oscillation if mic permission denied
    }

    const t1 = window.setTimeout(() => {
      setIsConnecting(false);
      setIsCallActive(true);
      const greeting = `Hi! Thank you for calling ${
        businessName || "our office"
      }. This is ${voiceName}, your AI receptionist. How can I help you today?`;
      setTranscript([{ role: "agent", text: greeting }]);
      speakText(greeting);
    }, 900);

    const firstService = services[0]?.name || "an appointment";
    const firstPrice = services[0]?.price ? `$${services[0].price}` : "$85";
    const firstFaq = knowledgeFaqs[0];
    const firstDept = departments[0]?.name || "our specialist team";

    const t2 = window.setTimeout(() => {
      setTranscript((prev) => [
        ...prev,
        {
          role: "user",
          text: `Hi ${voiceName}, how much is ${firstService} and do you have slots tomorrow?`,
        },
      ]);
    }, 4800);

    const t3 = window.setTimeout(() => {
      const reply = `Our ${firstService} starts at ${firstPrice}. I have 10:30 AM and 2:00 PM open tomorrow on our Google Calendar. Would you like me to lock one in for you, or connect you to ${firstDept}?`;
      setTranscript((prev) => [...prev, { role: "agent", text: reply }]);
      speakText(reply);
    }, 7600);

    if (firstFaq) {
      const t4 = window.setTimeout(() => {
        setTranscript((prev) => [
          ...prev,
          { role: "user", text: firstFaq.question },
        ]);
      }, 13500);

      const t5 = window.setTimeout(() => {
        setTranscript((prev) => [
          ...prev,
          { role: "agent", text: firstFaq.answer },
        ]);
        speakText(firstFaq.answer);
      }, 16200);
      timersRef.current.push(t4, t5);
    }

    timersRef.current.push(t1, t2, t3);
  }, [
    businessName,
    departments,
    industry,
    knowledgeFaqs,
    operatingHours,
    services,
    speakText,
    timezone,
    voiceName,
    voicePersona,
  ]);

  const stopCall = useCallback(() => {
    clearTimers();
    if (vapiRef.current) {
      vapiRef.current.stop().catch(() => {});
      vapiRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsCallActive(false);
    setIsConnecting(false);
    setVolumeLevel(0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (vapiRef.current) {
        vapiRef.current.setMuted(next);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = !next;
        });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isCallActive || mediaStreamRef.current || vapiRef.current) return;
    const interval = window.setInterval(() => {
      setVolumeLevel(Math.random() * 0.65 + 0.15);
    }, 180);
    return () => clearInterval(interval);
  }, [isCallActive]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (vapiRef.current) {
        vapiRef.current.stop().catch(() => {});
        vapiRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isCallActive,
    isConnecting,
    isMuted,
    volumeLevel,
    transcript,
    startCall,
    stopCall,
    toggleMute,
  };
};

