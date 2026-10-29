import Link from "next/link";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Price list cards, adapted from the supplied shadcn "Pricing" block for one-off, per-document
// prices in RM: no monthly/annual switch, confetti or animated counter (there is no subscription),
// and no framer-motion. The entrance motion uses the site's CSS `rise` classes, which are switched
// off for reduced motion. Prices arrive pre-formatted from the server, which owns all pricing.

export interface PricingPlan {
  id: string;
  name: string;
  /** Price charged now, e.g. "RM7". */
  price: string;
  /** Normal price, shown crossed out only while a promotion applies. */
  normalPrice?: string | null;
  /** e.g. "per document" */
  unit: string;
  features: string[];
  description?: string;
  buttonText: string;
  href: string;
  /** Short factual badge such as "Best value". Leave empty for none. */
  highlight?: string | null;
}

interface PricingProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  /** Small line under the cards, e.g. the promotion deadline. */
  note?: string;
  testId?: string;
  className?: string;
}

export function Pricing({ plans, title, description, note, testId = "pricing", className }: PricingProps) {
  const three = plans.length === 3;
  return (
    <div className={cn("w-full", className)} data-testid={testId}>
      {(title || description) && (
        <div className="mb-10 space-y-3 text-center">
          {title && <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>}
          {description && <p className="mx-auto max-w-2xl whitespace-pre-line text-muted-foreground sm:text-lg">{description}</p>}
        </div>
      )}

      <div className={cn("grid gap-4", three ? "md:grid-cols-3 md:items-center" : plans.length === 2 ? "md:grid-cols-2" : "mx-auto max-w-md")}>
        {plans.map((plan, index) => {
          const featured = Boolean(plan.highlight);
          const side = three && !featured;
          return (
            <div
              key={plan.id}
              className={cn(
                "rise relative flex flex-col rounded-2xl border bg-card p-6 text-center transition-transform duration-300",
                index === 0 ? "rise-1" : index === 1 ? "rise-2" : "rise-3",
                featured ? "z-10 border-2 border-primary pt-10 shadow-lg shadow-primary/10" : "border-border",
                featured && three && "md:-translate-y-3",
                side && "md:scale-[0.96]",
                side && index === 0 && "md:origin-right",
                side && index === plans.length - 1 && "md:origin-left",
              )}
              data-testid={`${testId}-card-${plan.id}`}
            >
              {featured && (
                <div className="absolute right-0 top-0 flex items-center rounded-bl-xl rounded-tr-xl bg-primary px-2 py-0.5">
                  <Star className="h-4 w-4 fill-current text-primary-foreground" aria-hidden="true" />
                  <span className="ml-1 text-sm font-semibold text-primary-foreground">{plan.highlight}</span>
                </div>
              )}
              <p className="text-base font-semibold text-muted-foreground">{plan.name}</p>
              <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-foreground tabular-nums" data-testid={`${testId}-price-${plan.id}`}>
                  {plan.price}
                </span>
                {plan.normalPrice && (
                  <span className="text-lg text-muted-foreground line-through" data-testid={`${testId}-normal-${plan.id}`}>
                    {plan.normalPrice}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{plan.unit}</p>

              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-left">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <hr className="my-5 w-full border-border" />

              <Link
                href={plan.href}
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-base font-semibold transition-colors duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  featured ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border bg-background text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {plan.buttonText}
              </Link>
              {plan.description && <p className="mt-4 text-xs leading-5 text-muted-foreground">{plan.description}</p>}
            </div>
          );
        })}
      </div>
      {note && <p className="mt-6 text-center text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
