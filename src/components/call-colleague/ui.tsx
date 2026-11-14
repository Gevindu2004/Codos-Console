"use client";

import React, { useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";

export function cn(
  ...inputs: (string | undefined | null | false)[]
): string {
  return inputs.filter(Boolean).join(" ");
}

export function triggerConfetti(): void {
  if (typeof document === "undefined") return;
  const colors = ["#14B8A6", "#2DD4BF", "#10B981", "#34D399", "#F59E0B"];
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "9999";
  container.style.overflow = "hidden";
  document.body.appendChild(container);

  for (let i = 0; i < 65; i++) {
    const particle = document.createElement("div");
    const size = Math.random() * 8 + 5;
    particle.style.position = "absolute";
    particle.style.width = `${size}px`;
    particle.style.height = `${size * 0.6}px`;
    particle.style.backgroundColor =
      colors[Math.floor(Math.random() * colors.length)];
    particle.style.left = `${50 + (Math.random() - 0.5) * 35}%`;
    particle.style.top = "45%";
    particle.style.borderRadius = "2px";

    const angle = Math.random() * Math.PI * 2;
    const velocity = 120 + Math.random() * 240;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity - 120;
    const rot = Math.random() * 720 - 360;

    particle.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${tx}px, ${ty + 260}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 1200 + Math.random() * 700,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      }
    );
    container.appendChild(particle);
  }

  setTimeout(() => {
    container.remove();
  }, 2100);
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800/80 bg-[#0B1221]/85 backdrop-blur-xl p-6 shadow-xl",
        className
      )}
    >
      {children}
    </div>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const variants = {
    primary:
      "bg-[#14B8A6] hover:bg-[#0D9488] text-[#0F172A] font-bold shadow-lg shadow-[#14B8A6]/25 border border-[#14B8A6]/50",
    secondary:
      "bg-[#14B8A6]/12 hover:bg-[#14B8A6]/20 text-[#14B8A6] border border-[#14B8A6]/30",
    outline:
      "bg-transparent hover:bg-slate-800/60 text-slate-300 border border-slate-700",
    danger:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 border border-rose-500/40",
    ghost: "bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2",
    lg: "px-6 py-3 text-sm rounded-xl gap-2.5",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "danger";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  className,
}) => {
  const styles = {
    default: "bg-slate-800/90 text-slate-300 border-slate-700",
    success: "bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]/35",
    warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    info: "bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]/35",
    danger: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  icon,
  className,
  ...props
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          className={cn(
            "w-full rounded-xl bg-slate-950/90 border border-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] transition",
            icon ? "pl-10" : "",
            className
          )}
          {...props}
        />
      </div>
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  className,
  ...props
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </label>
      )}
      <select
        className={cn(
          "w-full rounded-xl bg-slate-950/90 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#14B8A6] transition cursor-pointer",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-slate-900 text-white"
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={cn(
          "w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative",
          className
        )}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

interface AudioVisualizerOrbProps {
  isActive: boolean;
  isConnecting?: boolean;
  volumeLevel?: number;
}

export const AudioVisualizerOrb: React.FC<AudioVisualizerOrbProps> = ({
  isActive,
  isConnecting = false,
  volumeLevel = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const baseRadius = 38;
      const dynamicBoost = isActive ? volumeLevel * 22 : isConnecting ? 6 : 2;

      for (let ring = 3; ring >= 1; ring--) {
        ctx.beginPath();
        const r =
          baseRadius +
          ring * 12 +
          Math.sin(phase + ring) * (isActive ? 8 : 2) +
          dynamicBoost;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = isActive
          ? `rgba(20, 184, 166, ${0.22 / ring})`
          : `rgba(148, 163, 184, ${0.08 / ring})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      const grad = ctx.createRadialGradient(
        cx - 10,
        cy - 10,
        6,
        cx,
        cy,
        baseRadius + dynamicBoost * 0.6
      );
      if (isActive) {
        grad.addColorStop(0, "#2DD4BF");
        grad.addColorStop(0.6, "#14B8A6");
        grad.addColorStop(1, "#0D9488");
      } else if (isConnecting) {
        grad.addColorStop(0, "#2DD4BF");
        grad.addColorStop(1, "#0F766E");
      } else {
        grad.addColorStop(0, "#475569");
        grad.addColorStop(1, "#1e293b");
      }

      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius + dynamicBoost * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      phase += isActive ? 0.09 : 0.03;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isActive, isConnecting, volumeLevel]);

  return (
    <div className="flex flex-col items-center justify-center">
      <canvas ref={canvasRef} width={170} height={170} className="mx-auto" />
    </div>
  );
};
