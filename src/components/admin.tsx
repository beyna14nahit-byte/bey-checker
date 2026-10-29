import type { ReactNode } from "react";
import { STATUS_LABELS, type OrderStatus } from "@/lib/config";
import { cn } from "@/lib/utils";

export const adminInput = "input !py-2 text-sm";
export const adminBtn = "inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark";
export const adminBtnSecondary = "inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-brand";
export const adminBtnDanger = "inline-flex min-h-10 items-center justify-center rounded-lg border border-bad/40 bg-white px-3 py-2 text-sm font-semibold text-bad hover:bg-bad-soft";

export function Flash({ ok, bad }: { ok?: string; bad?: string }) {
  if (!ok && !bad) return null;
  return <div role="status" className={cn("mb-5 rounded-xl border px-4 py-3 text-sm", bad ? "border-bad/30 bg-bad-soft text-bad" : "border-ok/30 bg-ok-soft text-ok")}>{bad || ok}</div>;
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const tone =
    status === "payment_review" ? "bg-warn-soft text-warn" : status === "awaiting_payment" ? "bg-secondary text-ink-soft" : status === "cancelled" ? "bg-bad-soft text-bad" : status === "completed" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand-dark";
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}>{STATUS_LABELS[status]}</span>;
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
