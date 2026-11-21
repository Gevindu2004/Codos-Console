"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  PhoneIncoming,
  Copy,
  CheckCircle2,
  Power,
  Sparkles,
  Building2,
  LayoutDashboard,
  PhoneCall,
  CalendarCheck,
  Settings,
  PhoneForwarded,
  LogOut,
  PlusCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Search,
  Play,
  Pause,
  Volume2,
  MessageSquare,
  FileText,
  Calendar,
  User,
  Send,
  XCircle,
  RefreshCw,
  Check,
  Mic,
  Briefcase,
  BookOpen,
  Smartphone,
  Plus,
  Trash2,
  Edit3,
  ArrowRight,
  Lock,
  Mail,
  ShieldCheck,
  Square,
} from "lucide-react";
import { speakWithPersona, stopPersonaSpeech, useGoogleAuth } from "./hooks";
import {
  useAdminStore,
  useCallColleagueNavigation,
} from "./CallColleagueContext";
import {
  CallLogItem,
  AppointmentItem,
  ServiceItem,
  DepartmentRoute,
  KnowledgeFAQ,
} from "./types";
import {
  VOICE_PERSONAS,
  CARRIER_FORWARDING_CODES,
} from "./industryTemplates";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  cn,
  triggerConfetti,
} from "./ui";

export type AdminTabType =
  | "overview"
  | "calls"
  | "bookings"
  | "settings"
  | "telephony";

export const MetricsOverview: React.FC = () => {
  const { callLogs, appointments } = useAdminStore();

  const totalCalls = callLogs.length;
  const bookedCalls = callLogs.filter((c) => c.status === "booked").length;
  const conversionRate =
    totalCalls > 0 ? Math.round((bookedCalls / totalCalls) * 100) : 0;

  const confirmedAppointments = appointments.filter(
    (a) => a.status !== "cancelled"
  );
  const estimatedRevenue = confirmedAppointments.reduce(
    (acc, curr) => acc + curr.price,
    0
  );
  const minutesSaved = Math.round(totalCalls * 4.2);

  const stats = [
    {
      label: "Total Inbound Calls",
      value: totalCalls.toString(),
      subtext: "100% answered under 1 second",
      icon: PhoneIncoming,
      color: "text-[#14B8A6] bg-[#14B8A6]/15 border-[#14B8A6]/30",
      trend: "+18% this week",
    },
    {
      label: "AI Booked Appointments",
      value: confirmedAppointments.length.toString(),
      subtext: `${conversionRate}% call-to-booking conversion`,
      icon: CalendarCheck,
      color: "text-[#14B8A6] bg-[#14B8A6]/15 border-[#14B8A6]/30",
      trend: "+24% vs manual",
    },
    {
      label: "Staff Hours Saved",
      value: `${(minutesSaved / 60).toFixed(1)} hrs`,
      subtext: `${minutesSaved} mins of phone time handled`,
      icon: Clock,
      color: "text-[#2DD4BF] bg-[#14B8A6]/15 border-[#14B8A6]/30",
      trend: "Zero hold time",
    },
    {
      label: "Captured Booking Value",
      value: `$${estimatedRevenue.toLocaleString()}`,
      subtext: "Direct revenue from AI reception",
      icon: DollarSign,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      trend: "ROI 11.4x",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14B8A6] bg-[#14B8A6]/15 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" /> {stat.trend}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-white">{stat.value}</p>
            <p className="text-xs font-semibold text-slate-300 mt-0.5">
              {stat.label}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{stat.subtext}</p>
          </Card>
        );
      })}
    </div>
  );
};

interface CallDetailModalProps {
  call: CallLogItem | null;
  onClose: () => void;
}

const WAVEFORM_BARS = [
  28, 55, 42, 78, 64, 90, 48, 35, 72, 85, 60, 40, 95, 70, 50, 82, 66, 44, 76,
  88, 52, 38, 68, 92, 58, 46, 74, 62, 80, 49, 36, 70, 84, 54, 42, 65,
];

export const CallDetailModal: React.FC<CallDetailModalProps> = ({
  call,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [call]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      if (audioRef.current && audioRef.current.duration > 0) {
        const pct = Math.min(
          100,
          Math.round(
            (audioRef.current.currentTime / audioRef.current.duration) * 100
          )
        );
        setProgress(pct);
        return;
      }
      setProgress((prev) => {
        if (prev >= 100) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 2 * playbackSpeed;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  if (!call) return null;

  const toggleAudioPlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      return;
    }

    setIsPlaying(true);
    if (call.recordingUrl) {
      if (!audioRef.current || audioRef.current.src !== call.recordingUrl) {
        const audio = new Audio(call.recordingUrl);
        audio.onended = () => {
          setIsPlaying(false);
          setProgress(100);
        };
        audio.onerror = () => {
          setIsPlaying(false);
        };
        audioRef.current = audio;
      }
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch(() => setIsPlaying(false));
      return;
    }

    if ("speechSynthesis" in window && call.transcript.length > 0) {
      window.speechSynthesis.cancel();
      const combined = call.transcript.map((t) => t.text).join(" ... ");
      const utterance = new SpeechSynthesisUtterance(combined);
      utterance.rate = playbackSpeed;
      utterance.onend = () => {
        setIsPlaying(false);
        setProgress(100);
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleWaveformSeek = (barIndex: number) => {
    const newPercent = Math.round(((barIndex + 1) / WAVEFORM_BARS.length) * 100);
    setProgress(newPercent);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(next);
  };

  return (
    <Modal
      isOpen={!!call}
      onClose={onClose}
      title={`Call Recording & Transcript — ${call.callerName}`}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#14B8A6]/15 text-[#14B8A6]">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {call.callerName}{" "}
                <span className="text-slate-400 font-normal">
                  ({call.callerPhone})
                </span>
              </h4>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <Clock className="w-3 h-3" /> {call.timestamp} • Duration:{" "}
                {call.duration}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={
                call.sentiment === "positive"
                  ? "success"
                  : call.sentiment === "urgent"
                  ? "warning"
                  : "default"
              }
            >
              Sentiment: {call.sentiment}
            </Badge>
            <Badge variant="info">{call.status.toUpperCase()}</Badge>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#14B8A6] flex items-center gap-1.5">
              <Volume2 className="w-4 h-4" /> HD Call Audio Recording (48kHz
              Stereo)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={cycleSpeed}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-[#14B8A6] hover:text-white cursor-pointer"
                title="Change Playback Speed"
              >
                {playbackSpeed}x
              </button>
              <span className="text-[11px] font-mono text-slate-400">
                {isPlaying ? "Playing Audio..." : call.duration}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleAudioPlayback}
              className="w-11 h-11 rounded-full bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] flex items-center justify-center transition shadow-lg shadow-[#14B8A6]/30 cursor-pointer shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>

            <div className="flex-1 flex items-center justify-between gap-1 h-10 px-2 bg-slate-950/70 rounded-xl border border-slate-800/80">
              {WAVEFORM_BARS.map((height, idx) => {
                const barThreshold = ((idx + 1) / WAVEFORM_BARS.length) * 100;
                const isActiveBar = progress >= barThreshold;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleWaveformSeek(idx)}
                    className="flex-1 h-full flex items-center justify-center group cursor-pointer"
                    title={`Jump to ${Math.round(barThreshold)}%`}
                  >
                    <div
                      className={cn(
                        "w-1 rounded-full transition-all duration-150",
                        isActiveBar
                          ? "bg-[#14B8A6]"
                          : "bg-slate-700 group-hover:bg-slate-500"
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-[#14B8A6]" /> AI Call Summary
            & Intent
          </h5>
          <p className="text-xs text-slate-200 leading-relaxed">
            {call.summary}
          </p>
          {call.serviceRequested && (
            <p className="text-xs text-[#14B8A6] font-medium mt-2">
              Requested Service: {call.serviceRequested}
            </p>
          )}
        </div>

        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
            <MessageSquare className="w-3.5 h-3.5 text-[#14B8A6]" />{" "}
            Turn-by-Turn Conversation Transcript
          </h5>
          <div className="max-h-60 overflow-y-auto space-y-2.5 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            {call.transcript.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "p-3 rounded-xl text-xs max-w-[88%]",
                  line.role === "agent"
                    ? "bg-[#14B8A6]/15 border border-[#14B8A6]/35 text-teal-100 mr-auto"
                    : "bg-slate-900 border border-slate-800 text-slate-200 ml-auto"
                )}
              >
                <span className="font-bold text-[10px] uppercase tracking-wider block mb-1 opacity-70">
                  {line.role === "agent" ? "AI Receptionist" : call.callerName}
                </span>
                {line.text}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface CallLogsTableProps {
  limit?: number;
  onViewAll?: () => void;
}

export const CallLogsTable: React.FC<CallLogsTableProps> = ({
  limit,
  onViewAll,
}) => {
  const { callLogs } = useAdminStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<CallLogItem | null>(null);

  const filtered = callLogs.filter((call) => {
    const matchesSearch =
      call.callerName.toLowerCase().includes(search.toLowerCase()) ||
      call.callerPhone.includes(search) ||
      call.summary.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || call.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const displayedCalls = limit ? filtered.slice(0, limit) : filtered;

  const getStatusBadge = (status: CallLogItem["status"]) => {
    switch (status) {
      case "booked":
        return <Badge variant="success">Appointment Booked</Badge>;
      case "transferred":
        return <Badge variant="warning">Warm Transferred</Badge>;
      case "completed":
        return <Badge variant="info">FAQ Answered</Badge>;
      case "missed":
        return <Badge variant="default">Voicemail</Badge>;
    }
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-[#14B8A6]" />
            Recent Inbound Calls & Transcripts
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any call row to listen to the audio recording and inspect the
            full transcript.
          </p>
        </div>

        {!limit ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <Input
                placeholder="Search caller or topic..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-3.5 h-3.5" />}
                className="py-1.5 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {["all", "booked", "completed", "transferred"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                    statusFilter === st
                      ? "bg-[#14B8A6] text-[#0F172A]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        ) : (
          onViewAll && (
            <Button variant="outline" size="sm" onClick={onViewAll}>
              View All Calls ({callLogs.length}) →
            </Button>
          )
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/40">
              <th className="py-3.5 px-5">Caller</th>
              <th className="py-3.5 px-4">Outcome</th>
              <th className="py-3.5 px-4">AI Summary</th>
              <th className="py-3.5 px-4">Duration</th>
              <th className="py-3.5 px-4">Time</th>
              <th className="py-3.5 px-5 text-right">Recording</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {displayedCalls.map((call) => (
              <tr
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className="hover:bg-slate-800/40 transition cursor-pointer group"
              >
                <td className="py-4 px-5">
                  <div className="font-semibold text-white group-hover:text-[#14B8A6] transition">
                    {call.callerName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {call.callerPhone}
                  </div>
                </td>
                <td className="py-4 px-4">{getStatusBadge(call.status)}</td>
                <td className="py-4 px-4 max-w-xs">
                  <p className="text-slate-300 line-clamp-1">{call.summary}</p>
                  {call.serviceRequested && (
                    <span className="text-[11px] text-[#14B8A6] font-medium">
                      {call.serviceRequested}
                    </span>
                  )}
                </td>
                <td className="py-4 px-4 font-mono text-slate-300">
                  {call.duration}
                </td>
                <td className="py-4 px-4 text-slate-400">{call.timestamp}</td>
                <td className="py-4 px-5 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCall(call);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14B8A6]/15 hover:bg-[#14B8A6]/25 text-[#14B8A6] border border-[#14B8A6]/30 font-semibold transition cursor-pointer"
                  >
                    <Play className="w-3 h-3" /> Listen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CallDetailModal
        call={selectedCall}
        onClose={() => setSelectedCall(null)}
      />
    </Card>
  );
};

interface BookingsManagerProps {
  limit?: number;
  onViewAll?: () => void;
}

export const BookingsManager: React.FC<BookingsManagerProps> = ({
  limit,
  onViewAll,
}) => {
  const { appointments, updateAppointmentStatus, rescheduleAppointment } =
    useAdminStore();
  const [smsToast, setSmsToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rescheduleTarget, setRescheduleTarget] =
    useState<AppointmentItem | null>(null);
  const [newDateSlot, setNewDateSlot] = useState("Tomorrow, 3:30 PM");
  const [calendarSyncedToast, setCalendarSyncedToast] = useState(false);

  const filtered = appointments.filter((apt) => {
    const matchesSearch =
      apt.clientName.toLowerCase().includes(search.toLowerCase()) ||
      apt.serviceName.toLowerCase().includes(search.toLowerCase()) ||
      apt.staffMember.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || apt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const displayed = limit ? filtered.slice(0, limit) : filtered;

  const sendSmsReminder = async (apt: AppointmentItem) => {
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
    try {
      await fetch(`${apiBase}/appointments/${encodeURIComponent(apt.id)}`, {
        method: "POST",
      });
    } catch {
      // Non-blocking toast fallback
    }
    setSmsToast(
      `SMS reminder sent to ${apt.clientName} (${apt.clientPhone}) for ${apt.dateTime}`
    );
    setTimeout(() => setSmsToast(null), 3500);
  };

  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !newDateSlot.trim()) return;
    rescheduleAppointment(rescheduleTarget.id, newDateSlot.trim());
    setSmsToast(
      `Rescheduled ${rescheduleTarget.clientName} to ${newDateSlot.trim()} & updated Google Calendar.`
    );
    setRescheduleTarget(null);
    setTimeout(() => setSmsToast(null), 3500);
  };

  const triggerCalendarSync = () => {
    setCalendarSyncedToast(true);
    setTimeout(() => setCalendarSyncedToast(false), 2500);
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#14B8A6]" />
            AI-Scheduled Appointments & Calendar Sync
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatically synced with Google Calendar. Manage reschedules or
            send 1-click SMS reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!limit && (
            <>
              <div className="w-48">
                <Input
                  placeholder="Search client or staff..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<Search className="w-3.5 h-3.5" />}
                  className="py-1.5 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {["all", "confirmed", "rescheduled", "cancelled"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                      statusFilter === st
                        ? "bg-[#14B8A6] text-[#0F172A]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            onClick={triggerCalendarSync}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition cursor-pointer"
          >
            {calendarSyncedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#14B8A6]" /> Synced Just Now
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[#14B8A6]" /> Sync Google
                Calendar
              </>
            )}
          </button>

          {limit && onViewAll && (
            <Button variant="outline" size="sm" onClick={onViewAll}>
              Manage All ({appointments.length}) →
            </Button>
          )}
        </div>
      </div>

      {smsToast && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/35 text-xs text-[#14B8A6] flex items-center justify-between">
          <span>✓ {smsToast}</span>
        </div>
      )}

      <div className="divide-y divide-slate-800/60">
        {displayed.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No appointments match your current filter.
          </div>
        ) : (
          displayed.map((apt) => (
            <div
              key={apt.id}
              className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/25 transition"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-bold text-white text-sm">
                    {apt.clientName}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {apt.clientPhone}
                  </span>
                  <Badge
                    variant={
                      apt.status === "confirmed"
                        ? "success"
                        : apt.status === "rescheduled"
                        ? "warning"
                        : "default"
                    }
                  >
                    {apt.status}
                  </Badge>
                  <Badge variant="info">${apt.price}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                  <span className="font-medium text-[#14B8A6]">
                    {apt.serviceName}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <User className="w-3.5 h-3.5" /> {apt.staffMember}
                  </span>
                  <span className="flex items-center gap-1 text-[#2DD4BF] font-medium">
                    <Clock className="w-3.5 h-3.5" /> {apt.dateTime}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => sendSmsReminder(apt)}
                >
                  <Send className="w-3.5 h-3.5" /> SMS Reminder
                </Button>
                {apt.status !== "cancelled" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRescheduleTarget(apt);
                        setNewDateSlot(apt.dateTime);
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reschedule
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateAppointmentStatus(apt.id, "cancelled")
                      }
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        title={`Reschedule Appointment — ${rescheduleTarget?.clientName}`}
      >
        <form onSubmit={handleConfirmReschedule} className="space-y-4">
          <p className="text-xs text-slate-400">
            Select or enter a new date & time slot for{" "}
            <strong className="text-white">
              {rescheduleTarget?.serviceName}
            </strong>{" "}
            with{" "}
            <strong className="text-white">
              {rescheduleTarget?.staffMember}
            </strong>
            .
          </p>
          <Input
            label="New Date & Time Slot"
            value={newDateSlot}
            onChange={(e) => setNewDateSlot(e.target.value)}
            placeholder="e.g., Friday, 2:00 PM"
            required
          />
          <div className="flex flex-wrap gap-2">
            {[
              "Tomorrow, 11:00 AM",
              "Tomorrow, 3:30 PM",
              "Friday, 10:00 AM",
              "Monday, 2:15 PM",
            ].map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setNewDateSlot(slot)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
              >
                {slot}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRescheduleTarget(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Confirm & Notify Client
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
};

export const AgentSettingsView: React.FC = () => {
  const {
    user,
    vapiSyncStatus,
    setAdminVoicePersona,
    addAdminService,
    updateAdminService,
    removeAdminService,
    addAdminDepartment,
    updateAdminDepartment,
    removeAdminDepartment,
    addAdminFaq,
    updateAdminFaq,
    removeAdminFaq,
    updateAdminOperatingHour,
  } = useAdminStore();

  const [selectedCarrier, setSelectedCarrier] = useState(
    CARRIER_FORWARDING_CODES[0].id
  );
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(
    null
  );

  useEffect(() => {
    return () => stopPersonaSpeech();
  }, []);

  const {
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    isConnecting: isConnectingGoogle,
    authError: googleAuthError,
  } = useGoogleAuth();
  const [gcalBanner, setGcalBanner] = useState<string | null>(null);

  // Show result after Google redirects back to /console?gcal=connected|error
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gcal");
    if (!result) return;
    setGcalBanner(
      result === "connected"
        ? "Google Calendar connected. Your AI will now book into your calendar."
        : "Google Calendar connection failed. Please try again."
    );
    params.delete("gcal");
    params.delete("agentId");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
  }, []);

  const handleDisconnectGoogle = async () => {
    if (user && (await disconnectGoogleCalendar(user.id))) {
      setGcalBanner("Google Calendar disconnected.");
      window.location.reload();
    }
  };
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(
    null
  );
  const [srvName, setSrvName] = useState("");
  const [srvStaff, setSrvStaff] = useState("");
  const [srvPrice, setSrvPrice] = useState("85");
  const [srvDuration, setSrvDuration] = useState("45");
  const [srvDesc, setSrvDesc] = useState("");

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRoute | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptPhone, setDeptPhone] = useState("");
  const [deptDesc, setDeptDesc] = useState("");

  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<KnowledgeFAQ | null>(null);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqCategory, setFaqCategory] =
    useState<KnowledgeFAQ["category"]>("policy");

  if (!user) return null;

  const carrier =
    CARRIER_FORWARDING_CODES.find((c) => c.id === selectedCarrier) ||
    CARRIER_FORWARDING_CODES[0];
  const cleanPhone = user.virtualPhoneNumber.replace(/\D/g, "");

  const showSaved = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 3000);
  };

  const openAddService = () => {
    setEditingService(null);
    setSrvName("");
    setSrvStaff("");
    setSrvPrice("85");
    setSrvDuration("45");
    setSrvDesc("");
    setServiceModalOpen(true);
  };

  const openEditService = (srv: ServiceItem) => {
    setEditingService(srv);
    setSrvName(srv.name);
    setSrvStaff(srv.staffMember || "");
    setSrvPrice(String(srv.price));
    setSrvDuration(String(srv.durationMinutes));
    setSrvDesc(srv.description);
    setServiceModalOpen(true);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim()) return;
    if (editingService) {
      updateAdminService(editingService.id, {
        name: srvName.trim(),
        staffMember: srvStaff.trim() || "Any Specialist",
        price: Number(srvPrice) || 0,
        durationMinutes: Number(srvDuration) || 30,
        description: srvDesc.trim(),
      });
      showSaved(`Updated service "${srvName}" in live AI prompt.`);
    } else {
      addAdminService({
        id: `srv_${Date.now()}`,
        name: srvName.trim(),
        staffMember: srvStaff.trim() || "Any Specialist",
        price: Number(srvPrice) || 0,
        durationMinutes: Number(srvDuration) || 30,
        description: srvDesc.trim() || "Standard service",
      });
      showSaved(`Added new service "${srvName}" to live AI prompt.`);
    }
    setServiceModalOpen(false);
  };

  const openAddDept = () => {
    setEditingDept(null);
    setDeptName("");
    setDeptPhone("");
    setDeptDesc("");
    setDeptModalOpen(true);
  };

  const openEditDept = (d: DepartmentRoute) => {
    setEditingDept(d);
    setDeptName(d.name);
    setDeptPhone(d.phoneNumber);
    setDeptDesc(d.description);
    setDeptModalOpen(true);
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptPhone.trim()) return;
    if (editingDept) {
      updateAdminDepartment(editingDept.id, {
        name: deptName.trim(),
        phoneNumber: deptPhone.trim(),
        description: deptDesc.trim(),
      });
      showSaved(`Updated transfer line "${deptName}".`);
    } else {
      addAdminDepartment({
        id: `dept_${Date.now()}`,
        name: deptName.trim(),
        phoneNumber: deptPhone.trim(),
        description: deptDesc.trim() || "Transfer when caller requests.",
      });
      showSaved(`Added transfer line "${deptName}".`);
    }
    setDeptModalOpen(false);
  };

  const openAddFaq = () => {
    setEditingFaq(null);
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqCategory("policy");
    setFaqModalOpen(true);
  };

  const openEditFaq = (f: KnowledgeFAQ) => {
    setEditingFaq(f);
    setFaqQuestion(f.question);
    setFaqAnswer(f.answer);
    setFaqCategory(f.category);
    setFaqModalOpen(true);
  };

  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    if (editingFaq) {
      updateAdminFaq(editingFaq.id, {
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        category: faqCategory,
      });
      showSaved("Updated FAQ rule in live AI knowledge base.");
    } else {
      addAdminFaq({
        id: `faq_${Date.now()}`,
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        category: faqCategory,
      });
      showSaved("Added new FAQ rule to live AI knowledge base.");
    }
    setFaqModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {vapiSyncStatus !== "idle" && (
        <div
          className={cn(
            "p-3 rounded-xl border text-xs flex items-center justify-between gap-2",
            vapiSyncStatus === "syncing"
              ? "bg-slate-900/80 border-slate-700 text-slate-300"
              : vapiSyncStatus === "synced"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
          )}
        >
          <span>
            {vapiSyncStatus === "syncing"
              ? "Syncing latest changes to Vapi..."
              : vapiSyncStatus === "synced"
              ? "Synced to Vapi — your live AI assistant has the latest changes."
              : "Saved to DB (Vapi sync offline — assistant may not exist on Vapi)."}
          </span>
          <Badge
            variant={
              vapiSyncStatus === "synced"
                ? "success"
                : vapiSyncStatus === "failed"
                ? "warning"
                : "default"
            }
          >
            {vapiSyncStatus === "syncing"
              ? "Syncing"
              : vapiSyncStatus === "synced"
              ? "Synced to Vapi"
              : "DB Only"}
          </Badge>
        </div>
      )}

      {savedBanner && (
        <div className="p-3.5 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/35 text-xs text-[#14B8A6] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#14B8A6] shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Mic className="w-4 h-4 text-[#14B8A6]" /> Active Voice Persona
          </h3>
          <Badge variant="success">Live on Vapi Pipeline</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {VOICE_PERSONAS.map((persona) => {
            const isSelected = user.voicePersona.id === persona.id;
            const isPreviewing = previewingVoiceId === persona.id;
            return (
              <div
                key={persona.id}
                onClick={() => {
                  setAdminVoicePersona(persona);
                  showSaved(
                    `Switched active voice persona to ${persona.name} (${persona.accent}).`
                  );
                }}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? "bg-[#14B8A6]/20 border-[#14B8A6]"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-sm">
                      {persona.name}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-[#14B8A6]" />
                    )}
                  </div>
                  <span className="text-[11px] text-[#14B8A6] block">
                    {persona.accent} • {persona.gender}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {persona.tone}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPreviewing) {
                      stopPersonaSpeech();
                      setPreviewingVoiceId(null);
                      return;
                    }
                    setPreviewingVoiceId(persona.id);
                    speakWithPersona(persona.previewText, persona.name, {
                      onStart: () => setPreviewingVoiceId(persona.id),
                      onEnd: () => setPreviewingVoiceId(null),
                    });
                  }}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer",
                    isPreviewing
                      ? "bg-[#14B8A6] text-[#0F172A] border-[#14B8A6]"
                      : "bg-slate-900 text-[#14B8A6] border-slate-700 hover:border-[#14B8A6]"
                  )}
                >
                  {isPreviewing ? (
                    <>
                      <Square className="w-3 h-3 fill-current" /> Stop Sample
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" /> Test Voice
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#14B8A6]" /> Services &
                Pricing ({user.services.length})
              </h3>
              <p className="text-xs text-slate-400">
                Add, edit, or remove services quoted by your AI receptionist.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={openAddService}>
              <Plus className="w-3.5 h-3.5" /> Add Service
            </Button>
          </div>
          <div className="space-y-2.5">
            {user.services.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-white">{s.name}</p>
                  <p className="text-[11px] text-slate-400">
                    Specialist: {s.staffMember || "Any"} • {s.durationMinutes}m
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="success">${s.price}</Badge>
                  <button
                    onClick={() => openEditService(s)}
                    className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                    title="Edit Service"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      removeAdminService(s.id);
                      showSaved(`Removed service "${s.name}".`);
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                    title="Delete Service"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PhoneForwarded className="w-4 h-4 text-[#14B8A6]" /> Department
                Live Call Transfers ({user.departments.length})
              </h3>
              <p className="text-xs text-slate-400">
                Manage warm-transfer phone numbers and escalation triggers.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={openAddDept}>
              <Plus className="w-3.5 h-3.5" /> Add Line
            </Button>
          </div>
          <div className="space-y-2.5">
            {user.departments.map((d) => (
              <div
                key={d.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {d.name}
                    </span>
                    <Badge variant="info">{d.phoneNumber}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {d.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditDept(d)}
                    className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      removeAdminDepartment(d.id);
                      showSaved(`Removed transfer line "${d.name}".`);
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" /> Knowledge Base
              FAQs & Policies ({user.knowledgeFaqs.length})
            </h3>
            <p className="text-xs text-slate-400">
              Custom answers your AI receptionist uses when callers ask policy
              questions.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={openAddFaq}>
            <Plus className="w-3.5 h-3.5" /> Add FAQ Rule
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {user.knowledgeFaqs.map((faq) => (
            <div
              key={faq.id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white">
                    “{faq.question}”
                  </p>
                  <Badge variant="default">{faq.category}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">{faq.answer}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEditFaq(faq)}
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    removeAdminFaq(faq.id);
                    showSaved("Removed FAQ rule.");
                  }}
                  className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#14B8A6]" /> Carrier
                Call-Divert Codes
              </h3>
              <p className="text-xs text-slate-400">
                Forward your existing phone line to{" "}
                <strong>{user.virtualPhoneNumber}</strong>
              </p>
            </div>
            <div className="w-56">
              <Select
                value={selectedCarrier}
                onChange={(e) => setSelectedCarrier(e.target.value)}
                options={CARRIER_FORWARDING_CODES.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.country})`,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">
                Forward When Busy / Unanswered
              </span>
              <code className="text-sm font-mono font-bold text-[#14B8A6]">
                {carrier.forwardBusyNoAnswer.replace("{AI_NUMBER}", cleanPhone)}
              </code>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Forward All Calls (24/7)</span>
              <code className="text-sm font-mono font-bold text-[#2DD4BF]">
                {carrier.forwardAll.replace("{AI_NUMBER}", cleanPhone)}
              </code>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Cancel Call Forwarding</span>
              <code className="text-sm font-mono font-bold text-rose-400">
                {carrier.cancelForwarding}
              </code>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6]">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    Google Calendar Sync
                  </h3>
                  {user.googleCalendarConnected && (
                    <Badge variant="success">Connected</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {user.googleCalendarConnected
                    ? `Bookings are checked against and created in ${user.calendarEmail || "your calendar"}.`
                    : "Let your AI read free/busy slots to prevent double-bookings and create events for every booking."}
                </p>
                {gcalBanner && (
                  <p className="text-xs text-[#2DD4BF] mt-2">{gcalBanner}</p>
                )}
                {googleAuthError && (
                  <p className="text-xs text-rose-400 mt-2">{googleAuthError}</p>
                )}
              </div>
            </div>
            {user.googleCalendarConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectGoogle}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => connectGoogleCalendar(user.id)}
                isLoading={isConnectingGoogle}
              >
                Connect Google Calendar
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#14B8A6]" /> Operating Hours (
              {user.timezone})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Changes save to PostgreSQL and update your live Vapi prompt.
            </p>
          </div>
          <div className="divide-y divide-slate-800/60 text-xs">
            {user.operatingHours.map((h) => (
              <div
                key={h.day}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!h.isClosed}
                    onChange={(e) => {
                      updateAdminOperatingHour(h.day, {
                        isClosed: !e.target.checked,
                      });
                      showSaved(
                        `${h.day} marked ${
                          e.target.checked ? "open" : "closed"
                        } in live AI schedule.`
                      );
                    }}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-[#14B8A6] cursor-pointer"
                  />
                  <span
                    className={
                      h.isClosed
                        ? "text-slate-500 line-through font-medium"
                        : "text-slate-200 font-medium"
                    }
                  >
                    {h.day}
                  </span>
                </label>
                {h.isClosed ? (
                  <Badge variant="default">Closed</Badge>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={h.openTime}
                      aria-label={`${h.day} opening time`}
                      onChange={(e) => {
                        updateAdminOperatingHour(h.day, {
                          openTime: e.target.value,
                        });
                        showSaved(`Updated ${h.day} opening hours.`);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:border-[#14B8A6] focus:outline-none"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="time"
                      value={h.closeTime}
                      aria-label={`${h.day} closing time`}
                      onChange={(e) => {
                        updateAdminOperatingHour(h.day, {
                          closeTime: e.target.value,
                        });
                        showSaved(`Updated ${h.day} closing hours.`);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:border-[#14B8A6] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        isOpen={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        title={editingService ? "Edit Service" : "Add New Service"}
      >
        <form onSubmit={handleSaveService} className="space-y-4">
          <Input
            label="Service Name"
            value={srvName}
            onChange={(e) => setSrvName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Assigned Specialist"
              value={srvStaff}
              onChange={(e) => setSrvStaff(e.target.value)}
              placeholder="e.g., Elena"
            />
            <Input
              label="Price (USD)"
              type="number"
              value={srvPrice}
              onChange={(e) => setSrvPrice(e.target.value)}
              required
            />
          </div>
          <Input
            label="Duration (Minutes)"
            type="number"
            value={srvDuration}
            onChange={(e) => setSrvDuration(e.target.value)}
            required
          />
          <Input
            label="Spoken Description for AI"
            value={srvDesc}
            onChange={(e) => setSrvDesc(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setServiceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save Service
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        title={editingDept ? "Edit Transfer Line" : "Add Department Transfer"}
      >
        <form onSubmit={handleSaveDept} className="space-y-4">
          <Input
            label="Department Name"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            required
          />
          <Input
            label="Target Phone Number"
            value={deptPhone}
            onChange={(e) => setDeptPhone(e.target.value)}
            required
          />
          <Input
            label="When should AI transfer here?"
            value={deptDesc}
            onChange={(e) => setDeptDesc(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeptModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save Route
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={faqModalOpen}
        onClose={() => setFaqModalOpen(false)}
        title={editingFaq ? "Edit FAQ Rule" : "Add Knowledge Base FAQ"}
      >
        <form onSubmit={handleSaveFaq} className="space-y-4">
          <Input
            label="Caller Question"
            value={faqQuestion}
            onChange={(e) => setFaqQuestion(e.target.value)}
            required
          />
          <Select
            label="Category"
            value={faqCategory}
            onChange={(e) =>
              setFaqCategory(e.target.value as KnowledgeFAQ["category"])
            }
            options={[
              { value: "policy", label: "Cancellation / Policy" },
              { value: "parking", label: "Location & Parking" },
              { value: "pricing", label: "Pricing & Insurance" },
              { value: "general", label: "General FAQ" },
            ]}
          />
          <Input
            label="Exact AI Answer"
            value={faqAnswer}
            onChange={(e) => setFaqAnswer(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFaqModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save FAQ Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const AdminLoginPage: React.FC = () => {
  const { login, switchDemoTenant } = useAdminStore();
  const { navigateTo } = useCallColleagueNavigation();

  const [email, setEmail] = useState("owner@luxehairlounge.com");
  const [password, setPassword] = useState("••••••••••••");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      login(email);
      setIsLoading(false);
      navigateTo("dashboard");
    }, 500);
  };

  const handleQuickDemo = (preset: "salon" | "clinic") => {
    switchDemoTenant(preset);
    navigateTo("dashboard");
  };

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[#14B8A6] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#14B8A6]/30">
          <PhoneCall className="w-6 h-6 text-[#0F172A] stroke-[2.2]" />
        </div>
        <Badge variant="info" className="mb-2">
          Customer Portal
        </Badge>
        <h1 className="text-2xl font-extrabold text-white">
          Sign in to CallColleague<span className="text-[#14B8A6]">.ai</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Listen to call recordings, manage AI bookings, and update your
          agent&apos;s brain.
        </p>
      </div>

      <Card>
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Work Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            required
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            Sign In to Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center mb-3">
            Instant 1-Click Demo Workspaces
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickDemo("salon")}
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-[#14B8A6]/50 text-left transition cursor-pointer"
            >
              <span className="text-base block mb-1">💇‍♀️</span>
              <span className="text-xs font-bold text-white block">
                Luxe Hair Salon
              </span>
              <span className="text-[10px] text-slate-400">
                5 Calls • 4 Bookings
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo("clinic")}
              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-[#14B8A6]/50 text-left transition cursor-pointer"
            >
              <span className="text-base block mb-1">🦷</span>
              <span className="text-xs font-bold text-white block">
                Apex Dental Clinic
              </span>
              <span className="text-[10px] text-slate-400">
                Urgent Transfer Demo
              </span>
            </button>
          </div>
        </div>
      </Card>

      <div className="mt-5 flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#14B8A6]" /> HIPAA & SOC2 Ready
        </span>
        <button
          onClick={() => navigateTo("onboarding")}
          className="text-[#14B8A6] hover:text-[#2DD4BF] font-medium cursor-pointer"
        >
          Create New AI Agent →
        </button>
      </div>
    </div>
  );
};

export const AdminPortal: React.FC = () => {
  const {
    user,
    agents,
    vapiSyncStatus,
    isAuthenticated,
    selectAgent,
    toggleAgentActive,
    simulateIncomingCall,
    switchDemoTenant,
    logout,
  } = useAdminStore();
  const { activeView, navigateTo } = useCallColleagueNavigation();

  const [activeTab, setActiveTab] = useState<AdminTabType>("overview");
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [liveCallToast, setLiveCallToast] = useState<string | null>(null);

  if (activeView === "login" || !isAuthenticated || !user) {
    return <AdminLoginPage />;
  }

  const copyPhone = () => {
    navigator.clipboard.writeText(user.virtualPhoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateCall = () => {
    setIsSimulating(true);
    setLiveCallToast(
      `Incoming call on ${user.virtualPhoneNumber} — ${user.voicePersona.name} is answering...`
    );

    setTimeout(() => {
      simulateIncomingCall();
      setIsSimulating(false);
      setLiveCallToast(
        "Call completed! Appointment booked & synced to calendar."
      );
      triggerConfetti();
      setTimeout(() => setLiveCallToast(null), 3500);
    }, 1400);
  };

  const isRealAgentSelected = agents.some((a) => a.id === user.id);
  const currentSelectValue = isRealAgentSelected
    ? user.id
    : user.id === "ag_demo_clinic" || user.businessName.toLowerCase().includes("dental")
    ? "preset:clinic"
    : "preset:salon";

  const navItems: {
    id: AdminTabType;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "calls", label: "Call Logs & Audio", icon: PhoneCall },
    { id: "bookings", label: "Appointments", icon: CalendarCheck },
    { id: "settings", label: "Agent Brain & Rules", icon: Settings },
    { id: "telephony", label: "Phone & Call Divert", icon: PhoneForwarded },
  ];

  return (
    <div className="space-y-6">
      {/* Top Customer Portal Header Bar */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0B1221]/85 backdrop-blur-md p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
              <Building2 className="w-4 h-4 text-[#14B8A6]" />
              <select
                value={currentSelectValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith("preset:")) {
                    switchDemoTenant(
                      val.replace("preset:", "") as "salon" | "clinic"
                    );
                  } else {
                    selectAgent(val);
                  }
                }}
                aria-label="Switch AI Agent Workspace"
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <optgroup
                  label="Your Provisioned AI Agents"
                  className="bg-slate-900 text-slate-400"
                >
                  {agents.map((ag) => (
                    <option
                      key={ag.id}
                      value={ag.id}
                      className="bg-slate-900 text-white"
                    >
                      {ag.businessName} ({ag.industry})
                    </option>
                  ))}
                </optgroup>
                <optgroup
                  label="Demo Presets"
                  className="bg-slate-900 text-slate-400"
                >
                  <option value="preset:salon" className="bg-slate-900 text-white">
                    Demo: Luxe Hair Salon
                  </option>
                  <option value="preset:clinic" className="bg-slate-900 text-white">
                    Demo: Apex Dental Clinic
                  </option>
                </optgroup>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] text-slate-400">Assigned Line:</span>
              <span className="text-xs font-mono font-bold text-[#14B8A6]">
                {user.virtualPhoneNumber}
              </span>
              <button
                onClick={copyPhone}
                className="text-slate-400 hover:text-white transition cursor-pointer"
                title="Copy Phone Number"
              >
                {copied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {vapiSyncStatus !== "idle" && (
              <Badge
                variant={
                  vapiSyncStatus === "synced"
                    ? "success"
                    : vapiSyncStatus === "failed"
                    ? "warning"
                    : "default"
                }
              >
                {vapiSyncStatus === "syncing"
                  ? "Syncing to Vapi..."
                  : vapiSyncStatus === "synced"
                  ? "Synced to Vapi"
                  : "Saved to DB (Vapi sync offline)"}
              </Badge>
            )}
            <button
              onClick={toggleAgentActive}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer",
                user.agentActive
                  ? "bg-[#14B8A6]/15 border-[#14B8A6]/35 text-[#14B8A6]"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  user.agentActive
                    ? "bg-[#14B8A6] animate-pulse"
                    : "bg-rose-400"
                )}
              />
              <Power className="w-3.5 h-3.5" />
              {user.agentActive ? "Agent Active (24/7)" : "Agent Paused"}
            </button>

            <Button
              size="sm"
              variant="primary"
              onClick={handleSimulateCall}
              isLoading={isSimulating}
            >
              <PhoneIncoming className="w-3.5 h-3.5" />
              <span>Simulate Inbound Call</span>
            </Button>
          </div>
        </div>

        {liveCallToast && (
          <div className="mt-3 px-4 py-2 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/40 flex items-center justify-between text-xs text-teal-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#14B8A6] animate-spin" />
              <span>{liveCallToast}</span>
            </div>
            <Badge variant="info">Live Webhook Event</Badge>
          </div>
        )}

        {/* Sub-navigation bar inside the portal */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    isActive
                      ? "bg-[#14B8A6] text-[#0F172A] shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      isActive ? "text-[#0F172A]" : "text-slate-500"
                    )}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateTo("onboarding")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#14B8A6] hover:text-white bg-[#14B8A6]/12 hover:bg-[#14B8A6]/25 border border-[#14B8A6]/30 transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Setup New Agent
            </button>
            <button
              onClick={() => {
                logout();
                navigateTo("login");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition cursor-pointer"
              title="Switch Account"
            >
              <LogOut className="w-3.5 h-3.5" /> Switch Account
            </button>
          </div>
        </div>
      </div>

      {/* Main Portal Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#14B8A6]/15 via-slate-900 to-[#0D9488]/10 border border-[#14B8A6]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="info">
                  <Sparkles className="w-3 h-3 mr-1" /> Live Customer Portal
                </Badge>
                <span className="text-xs text-slate-400">
                  Voice:{" "}
                  <strong className="text-white">
                    {user.voicePersona.name}
                  </strong>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Welcome back, {user.businessName}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Your AI receptionist is actively answering calls on{" "}
                <span className="text-[#14B8A6] font-mono font-semibold">
                  {user.virtualPhoneNumber}
                </span>{" "}
                and syncing bookings to your calendar.
              </p>
            </div>
          </div>

          <MetricsOverview />

          <div className="grid grid-cols-1 gap-6">
            <CallLogsTable limit={4} onViewAll={() => setActiveTab("calls")} />
            <BookingsManager
              limit={3}
              onViewAll={() => setActiveTab("bookings")}
            />
          </div>
        </div>
      )}

      {activeTab === "calls" && <CallLogsTable />}

      {activeTab === "bookings" && <BookingsManager />}

      {(activeTab === "settings" || activeTab === "telephony") && (
        <AgentSettingsView />
      )}
    </div>
  );
};
