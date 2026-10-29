import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-card p-5 sm:p-6", className)} {...rest}>
      {children}
    </div>
  );
}

export function Notice({ children, tone = "info", className, ...rest }: { children: ReactNode; tone?: "info" | "ok" | "warn" | "bad"; className?: string } & HTMLAttributes<HTMLDivElement>) {
  const cls = {
    info: "border-brand/30 bg-brand-soft text-brand-dark",
    ok: "border-ok/30 bg-ok-soft text-ok",
    warn: "border-warn/30 bg-warn-soft text-warn",
    bad: "border-bad/30 bg-bad-soft text-bad",
  }[tone];
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", cls, className)} {...rest}>
      {children}
    </div>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 sm:px-6", className)}>{children}</div>;
}
