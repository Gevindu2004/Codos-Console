"use client";

import React, { useEffect, useRef, useState } from "react";

interface ViaCodosLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "dark-bg" | "light-badge";
}

export const ViaCodosLogo: React.FC<ViaCodosLogoProps> = ({
  className = "",
  size = "md",
  variant = "dark-bg",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [processedReady, setProcessedReady] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);

  const dimensions = {
    sm: { width: 155, height: 42 },
    md: { width: 195, height: 52 },
    lg: { width: 240, height: 64 },
  }[size];

  useEffect(() => {
    const checkTheme = () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      setIsLightTheme(currentTheme === "light");
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (variant !== "dark-bg") return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = "/assets/via-codos-logo.jpg";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const srcX = Math.floor(img.width * 0.055);
      const srcY = Math.floor(img.height * 0.34);
      const srcW = Math.floor(img.width * 0.89);
      const srcH = Math.floor(img.height * 0.33);

      canvas.width = srcW;
      canvas.height = srcH;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      const imageData = ctx.getImageData(0, 0, srcW, srcH);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        // 1. Strip near-white background pixels cleanly
        if (r > 232 && g > 232 && b > 232) {
          data[i + 3] = 0;
          continue;
        }

        const whiteness = Math.min(r, g, b) / 255;
        const alpha = Math.min(1, Math.max(0, (0.94 - whiteness) / 0.28));

        const blueSaturation = b - r;
        if (blueSaturation > 65 && b > 140) {
          // Vibrant Electric Blue (#1876EA) for the logo emblem only
          data[i] = 24;
          data[i + 1] = 118;
          data[i + 2] = 234;
          data[i + 3] = Math.round(alpha * 255);
        } else if (luminance < 0.55) {
          if (isLightTheme) {
            // In Light Theme (Cream #F4EDE0 primary): render text in Midnight Black #0B0B0C (11, 11, 12)
            data[i] = 11;
            data[i + 1] = 11;
            data[i + 2] = 12;
          } else {
            // In Dark Theme (#0F172A primary): render text in crisp #F1F5F9 (241, 245, 249)
            data[i] = 241;
            data[i + 1] = 245;
            data[i + 2] = 249;
          }
          data[i + 3] = Math.round(alpha * 255);
        } else {
          data[i] = isLightTheme ? 11 : 203;
          data[i + 1] = isLightTheme ? 11 : 213;
          data[i + 2] = isLightTheme ? 12 : 225;
          data[i + 3] = Math.round(alpha * 220);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setProcessedReady(true);
    };
  }, [variant, isLightTheme]);

  const textFill = isLightTheme ? "#0B0B0C" : "#F1F5F9";

  return (
    <div
      className={`relative inline-flex items-center select-none group ${className}`}
      style={{ height: dimensions.height }}
    >
      <canvas
        ref={canvasRef}
        style={{
          height: dimensions.height,
          width: "auto",
          display: processedReady ? "block" : "none",
        }}
        className="object-contain transition-transform duration-300 group-hover:scale-[1.03] drop-shadow-[0_2px_10px_rgba(24,118,234,0.22)]"
        aria-label="Via Codos (PVT) LTD Official Logo"
      />

      {!processedReady && (
        <svg
          viewBox="0 0 460 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ height: dimensions.height, width: "auto" }}
          className="transition-transform duration-300 group-hover:scale-[1.03]"
          role="img"
          aria-label="Via Codos (PVT) LTD"
        >
          <path
            d="M12 18 H48 C54 18 58 21 61 27 L76 56 L68 56 L54 29 C52 25 49 24 44 24 H18 L12 18 Z"
            fill="#1876EA"
          />
          <path
            d="M19 30 H44 C48 30 51 32 53 36 L83 96 L83 108 L76 96 L46 38 C45 35 43 34 39 34 H22 L19 30 Z"
            fill="#0D58B8"
          />
          <path
            d="M164 18 H128 C122 18 118 21 115 27 L100 56 L108 56 L122 29 C124 25 127 24 132 24 H158 L164 18 Z"
            fill="#1876EA"
          />
          <path
            d="M157 30 H132 C128 30 125 32 123 36 L93 96 L93 108 L100 96 L130 38 C131 35 133 34 137 34 H154 L157 30 Z"
            fill="#0D58B8"
          />
          <rect x="78" y="42" width="20" height="20" rx="4" fill="#1876EA" />
          <line x1="65" y1="52" x2="78" y2="52" stroke="#1876EA" strokeWidth="3" />
          <circle cx="62" cy="52" r="3" stroke="#1876EA" strokeWidth="2.5" fill="none" />
          <line x1="98" y1="52" x2="111" y2="52" stroke="#1876EA" strokeWidth="3" />
          <circle cx="114" cy="52" r="3" stroke="#1876EA" strokeWidth="2.5" fill="none" />
          <line x1="88" y1="62" x2="88" y2="108" stroke="#1876EA" strokeWidth="3.2" />

          <line x1="190" y1="16" x2="190" y2="108" stroke={textFill} strokeWidth="2.2" strokeOpacity="0.85" />

          <text
            x="215"
            y="68"
            fill={textFill}
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="46"
            fontWeight="600"
            letterSpacing="1.5"
          >
            Via Codos
          </text>

          <line x1="216" y1="95" x2="258" y2="95" stroke={textFill} strokeWidth="1.5" strokeOpacity="0.65" />
          <text
            x="270"
            y="100"
            fill={textFill}
            fillOpacity="0.85"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="15"
            fontWeight="500"
            letterSpacing="5.5"
          >
            (PVT) LTD
          </text>
          <line x1="398" y1="95" x2="442" y2="95" stroke={textFill} strokeWidth="1.5" strokeOpacity="0.65" />
        </svg>
      )}
    </div>
  );
};
