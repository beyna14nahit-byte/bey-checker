"use client";

// Adapted from the animated-countdown component: uses "motion/react" (the current name of
// framer-motion, already installed), translatable labels, the server clock, and no made-up time
// before the browser takes over (it shows "--" until then).
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type CountdownUnitKey = "days" | "hours" | "minutes" | "seconds";
type CountdownVariant = "modern" | "digital" | "minimal" | "classic";
type CountdownSize = "sm" | "md" | "lg";

type TimeLeft = Record<CountdownUnitKey, number>;

export type AnimatedCountdownProps = {
  targetDate: Date | string | number;
  /** Server time when the page was rendered, so a wrong device clock does not matter. */
  serverTime?: string;
  variant?: CountdownVariant;
  showDays?: boolean;
  showHours?: boolean;
  showMinutes?: boolean;
  showSeconds?: boolean;
  unitOrder?: CountdownUnitKey[];
  labels?: Partial<Record<CountdownUnitKey, string>>;
  className?: string;
  unitClassName?: string;
  numberClassName?: string;
  labelClassName?: string;
  separator?: React.ReactNode;
  showSeparators?: boolean;
  completionMessage?: string;
  onComplete?: () => void;
  size?: CountdownSize;
  ariaLabel?: string;
};

const UNIT_LABELS: Record<CountdownUnitKey, string> = { days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds" };

const variantClasses: Record<CountdownVariant, string> = {
  modern: "border-border/70 bg-white/95 shadow-2xl shadow-primary/5",
  digital: "border-cyan-400/20 bg-zinc-950 text-white shadow-2xl shadow-cyan-500/10",
  minimal: "border-transparent bg-transparent shadow-none",
  classic: "border-border bg-card shadow-sm",
};

const unitVariantClasses: Record<CountdownVariant, string> = {
  modern: "border-border/70 bg-secondary/70 shadow-sm transition hover:border-primary/35 hover:bg-secondary hover:shadow-primary/10",
  digital: "border-cyan-400/20 bg-cyan-400/[0.055] font-mono shadow-[0_0_28px_-18px_rgba(34,211,238,0.9)] transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.09]",
  minimal: "border-transparent bg-transparent transition hover:bg-secondary",
  classic: "border-border bg-background shadow-sm transition hover:border-primary/30 hover:bg-secondary",
};

const sizeClasses: Record<CountdownSize, { container: string; unit: string; number: string; label: string }> = {
  sm: { container: "gap-2 p-2", unit: "min-w-[4.25rem] rounded-xl px-3 py-3", number: "text-2xl", label: "text-[10px]" },
  md: {
    container: "gap-2.5 p-2.5 sm:gap-3 sm:p-3",
    unit: "min-w-[4.4rem] rounded-2xl px-1.5 py-3.5 sm:min-w-[5.6rem] sm:px-4 sm:py-4",
    number: "text-3xl sm:text-4xl",
    label: "text-[10px] sm:text-[11px]",
  },
  lg: {
    container: "gap-3 p-3 sm:gap-4 sm:p-4",
    unit: "min-w-[5.2rem] rounded-2xl px-4 py-4 sm:min-w-[6.5rem] sm:px-5 sm:py-5",
    number: "text-4xl sm:text-5xl",
    label: "text-[11px] sm:text-xs",
  },
};

function toTime(value: AnimatedCountdownProps["targetDate"]) {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function timeLeft(target: number, offset: number): TimeLeft {
  const s = Math.floor(Math.max(0, target - (Date.now() + offset)) / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

const finished = (t: TimeLeft) => t.days + t.hours + t.minutes + t.seconds === 0;
const pad = (v: number) => String(Math.max(0, v)).padStart(2, "0");

function CountdownNumber({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion() === true;
  return (
    <span className={cn("relative inline-grid min-w-[2ch] place-items-center tabular-nums", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={reduce ? false : { y: 12, opacity: 0, filter: "blur(4px)" }}
          animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { y: -12, opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: reduce ? 0.05 : 0.25, ease: "easeOut" }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CountdownUnit({
  unit,
  value,
  label,
  variant,
  size,
  index,
  unitClassName,
  numberClassName,
  labelClassName,
}: {
  unit: CountdownUnitKey;
  value: number | null;
  label: string;
  variant: CountdownVariant;
  size: CountdownSize;
  index: number;
  unitClassName?: string;
  numberClassName?: string;
  labelClassName?: string;
}) {
  const reduce = useReducedMotion() === true;
  const preset = sizeClasses[size];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduce ? 0 : index * 0.055, duration: 0.35, ease: "easeOut" }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={cn("relative flex flex-col items-center justify-center overflow-hidden border text-center", unitVariantClasses[variant], preset.unit, unitClassName)}
      data-unit={unit}
    >
      {variant === "modern" && <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />}
      <CountdownNumber
        value={value === null ? "--" : pad(value)}
        className={cn(
          "font-bold leading-none tracking-tight text-foreground",
          variant === "digital" && "font-mono text-cyan-100 drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]",
          variant === "minimal" && "font-semibold",
          preset.number,
          numberClassName,
        )}
      />
      <span className={cn("mt-2 font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:tracking-[0.18em]", variant === "digital" && "text-cyan-200/55", preset.label, labelClassName)}>
        {label}
      </span>
    </motion.div>
  );
}

export function AnimatedCountdown({
  targetDate,
  serverTime,
  variant = "modern",
  showDays = true,
  showHours = true,
  showMinutes = true,
  showSeconds = true,
  unitOrder = ["days", "hours", "minutes", "seconds"],
  labels,
  className,
  unitClassName,
  numberClassName,
  labelClassName,
  separator = ":",
  showSeparators = variant === "digital",
  completionMessage,
  onComplete,
  size = "md",
  ariaLabel = "Countdown timer",
}: AnimatedCountdownProps) {
  const reduce = useReducedMotion() === true;
  const target = toTime(targetDate);
  const [left, setLeft] = React.useState<TimeLeft | null>(null);
  const completedRef = React.useRef(false);
  const enabled = { days: showDays, hours: showHours, minutes: showMinutes, seconds: showSeconds };
  const units = unitOrder.filter((u) => enabled[u]);
  const done = left !== null && finished(left);

  React.useEffect(() => {
    if (target === null) return;
    const offset = serverTime ? Date.parse(serverTime) - Date.now() : 0;
    const tick = () => setLeft(timeLeft(target, Number.isFinite(offset) ? offset : 0));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target, serverTime]);

  React.useEffect(() => {
    if (!done || completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [done, onComplete]);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      role="timer"
      aria-label={ariaLabel}
      className={cn("inline-flex max-w-full flex-col items-center rounded-[1.75rem] border", variantClasses[variant], sizeClasses[size].container, className)}
    >
      <div className={cn("grid max-w-full grid-cols-4 items-stretch gap-2 sm:flex sm:flex-wrap sm:justify-center", showSeparators && "sm:gap-0")} aria-hidden="true">
        {units.map((unit, index) => (
          <React.Fragment key={unit}>
            <CountdownUnit
              unit={unit}
              value={left ? left[unit] : null}
              label={labels?.[unit] ?? UNIT_LABELS[unit]}
              variant={variant}
              size={size}
              index={index}
              unitClassName={unitClassName}
              numberClassName={numberClassName}
              labelClassName={labelClassName}
            />
            {showSeparators && index < units.length - 1 && (
              <span className={cn("hidden items-center px-2 text-2xl font-semibold text-muted-foreground/50 sm:flex", variant === "digital" && "font-mono text-cyan-200/45")}>{separator}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <AnimatePresence>
        {done && completionMessage && (
          <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="mt-3 text-sm font-medium text-primary">
            {completionMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AnimatedCountdown;
