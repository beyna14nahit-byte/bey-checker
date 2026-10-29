"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades content in when it scrolls into view. Content is visible by default (server render, no
 * JavaScript, reduced motion); only blocks that start below the screen are hidden after load and
 * then revealed, so nothing can stay invisible.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"static" | "hidden" | "shown">("static");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen
    setPhase("hidden");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setPhase("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const cls = phase === "static" ? "" : phase === "hidden" ? "reveal" : "reveal is-visible";
  return (
    <div ref={ref} className={`${cls} ${className}`}>
      {children}
    </div>
  );
}
