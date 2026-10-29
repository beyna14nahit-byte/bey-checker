"use client";

// Adapted from testimonial-section-2: rows of capsules drifting in opposite directions with edge fades
// and a hatched band. Logos only (no quotes or modal). Pauses on hover/focus and is static for reduced motion.
import { useRef } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export type MarqueeLogo = { id: string; short: string; name: string; logo: string | null };

const COPIES = 4; // each row repeats its items; moving by one copy (25%) loops seamlessly

function Tile({ item }: { item: MarqueeLogo }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      title={item.name}
      className="flex h-20 w-44 shrink-0 max-sm:motion-reduce:h-16 max-sm:motion-reduce:w-36 items-center justify-center rounded-full border border-line bg-white px-6 shadow-sm transition-colors hover:border-dashed hover:border-(--marquee-accent) sm:h-24 sm:w-52"
    >
      {item.logo ? (
        // Plain img so SVG and raster logos both work without image optimisation config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.logo} alt="" className="max-h-14 w-auto max-w-full object-contain sm:max-h-16" loading="lazy" decoding="async" />
      ) : (
        <span className="text-xl font-extrabold tracking-tight text-ink-soft sm:text-2xl">{item.short}</span>
      )}
    </motion.div>
  );
}

function Row({ items, reverse, seconds }: { items: MarqueeLogo[]; reverse: boolean; seconds: number }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(reverse ? -100 / COPIES : 0);
  const paused = useRef(false);
  useAnimationFrame((_, delta) => {
    if (paused.current || reduce) return;
    const period = 100 / COPIES;
    let v = x.get() + ((reverse ? 1 : -1) * period * Math.min(delta, 100)) / (seconds * 1000);
    if (v <= -period) v += period;
    if (v > 0) v -= period;
    x.set(v);
  });
  const translate = useTransform(x, (v) => `${v}%`);
  // Reduced motion is handled in CSS (motion-reduce:) so the server render already has the final layout.
  return (
    <motion.div
      style={{ x: translate }}
      data-marquee-row
      className="flex w-max items-center motion-reduce:mx-auto motion-reduce:w-full motion-reduce:max-w-6xl motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-x-4 motion-reduce:gap-y-5 sm:motion-reduce:gap-x-5 motion-reduce:px-4 motion-reduce:transform-none!"
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
    >
      {Array.from({ length: COPIES }, (_, c) =>
        items.map((item) => (
          <div key={`${c}-${item.id}`} className={c > 0 ? "pr-5 motion-reduce:hidden sm:pr-6" : "pr-5 motion-reduce:p-0! sm:pr-6"}>
            <Tile item={item} />
          </div>
        )),
      )}
    </motion.div>
  );
}

export function TrustedByMarquee({
  title,
  items,
  note,
  accent,
  className,
  testId,
}: {
  title: string;
  items: MarqueeLogo[];
  note?: string;
  /** CSS colour for hover borders, e.g. "var(--color-accent)". */
  accent: string;
  className?: string;
  testId?: string;
}) {
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)].filter((r) => r.length > 0);

  return (
    <section
      aria-labelledby="trusted-title"
      data-testid={testId}
      className={cn("relative w-full overflow-hidden py-14", className)}
      style={{ ["--marquee-accent" as string]: accent }}
    >
      <h2 id="trusted-title" className="mx-auto mb-8 max-w-4xl px-4 text-center text-2xl font-bold tracking-tight text-balance sm:text-3xl">
        {title}
      </h2>
      {/* The moving copies are decorative; this list is what screen readers get. */}
      <ul className="sr-only">
        {items.map((u) => (
          <li key={u.id} data-testid="trusted-item">{u.name} ({u.short})</li>
        ))}
      </ul>

      <div className="relative w-full" aria-hidden="true">
        <div className="pointer-events-none absolute inset-0 border-y border-line bg-[repeating-linear-gradient(315deg,var(--color-line)_0,var(--color-line)_1px,transparent_0,transparent_50%)] bg-[length:10px_10px] opacity-60" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-white to-transparent motion-reduce:hidden sm:w-40" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-white to-transparent motion-reduce:hidden sm:w-40" />

        <div className="relative z-10 flex flex-col gap-6 overflow-hidden py-10">
          {rows.map((row, i) => (
            <Row key={i} items={row} reverse={i % 2 === 1} seconds={30 + i * 6} />
          ))}
        </div>
      </div>

      {note && <p className="mx-auto mt-4 max-w-3xl px-4 text-center text-xs text-muted">{note}</p>}
    </section>
  );
}
