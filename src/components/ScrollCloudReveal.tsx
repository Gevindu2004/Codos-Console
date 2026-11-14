"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScrollCloudRevealProps {
  children: React.ReactNode;
  delayMs?: number;
  direction?: "up" | "left" | "right" | "scale";
  className?: string;
  threshold?: number;
}

/**
 * Wraps landing-page sections or cards with a cloud-loading scroll reveal:
 * - Re-triggers when scrolling from EITHER top or bottom into the section
 * - Soft atmospheric cloud blur-to-clear materialization
 * - Multi-layer cloud-loading shimmer wave & mist pulse on viewport entry
 * - Staggered 3D lift & scale transition
 */
export const ScrollCloudReveal: React.FC<ScrollCloudRevealProps> = ({
  children,
  delayMs = 0,
  direction = "up",
  className = "",
  threshold = 0.12,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shimmerActive, setShimmerActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            setShimmerActive(true);
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              setShimmerActive(false);
            }, 1250 + delayMs);
          } else {
            // Reset whenever the element leaves the viewport (scrolling up OR down)
            if (timer) clearTimeout(timer);
            setIsVisible(false);
            setShimmerActive(false);
          }
        });
      },
      {
        threshold,
        rootMargin: "-4% 0px -4% 0px",
      }
    );

    observer.observe(node);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [delayMs, threshold]);

  const getInitialTransform = () => {
    if (isVisible) return "translate3d(0px, 0px, 0px) scale(1)";
    switch (direction) {
      case "left":
        return "translate3d(-56px, 32px, 0px) scale(0.94)";
      case "right":
        return "translate3d(56px, 32px, 0px) scale(0.94)";
      case "scale":
        return "translate3d(0px, 42px, 0px) scale(0.91)";
      case "up":
      default:
        return "translate3d(0px, 56px, 0px) scale(0.94)";
    }
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getInitialTransform(),
        filter: isVisible ? "blur(0px)" : "blur(18px)",
        transitionProperty: "opacity, transform, filter",
        transitionDuration: isVisible ? "920ms" : "320ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: isVisible ? `${delayMs}ms` : "0ms",
        willChange: "opacity, transform, filter",
      }}
      className={`relative ${className}`}
    >
      {/* Cloud-Loading Shimmer & Atmospheric Mist Overlay on Scroll Reveal */}
      <div
        aria-hidden="true"
        style={{
          transitionDelay: `${delayMs}ms`,
        }}
        className={`pointer-events-none absolute inset-0 z-30 rounded-3xl overflow-hidden transition-opacity duration-700 ${
          shimmerActive ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`w-full h-full ${
            shimmerActive ? "cloud-loading-sweep" : ""
          }`}
        />
      </div>

      {children}
    </div>
  );
};

/**
 * Drifting cloud-mist ambient backdrop for the landing page.
 */
export const LandingScrollProgressAndClouds: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      <div
        style={{
          transform: `translate3d(${Math.sin(scrollY * 0.0025) * 60}px, ${
            -(scrollY * 0.14) % 340
          }px, 0px)`,
        }}
        className="codos-cloud-mist codos-cloud-mist-1"
      />
      <div
        style={{
          transform: `translate3d(${Math.cos(scrollY * 0.002) * -65}px, ${
            -(scrollY * 0.1) % 300
          }px, 0px)`,
        }}
        className="codos-cloud-mist codos-cloud-mist-2"
      />
    </div>
  );
};
