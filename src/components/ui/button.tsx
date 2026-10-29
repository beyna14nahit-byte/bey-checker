import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const buttonClass = (variant: "primary" | "secondary" | "ghost" = "primary") =>
  cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
    variant === "primary" && "bg-brand text-white hover:bg-brand-dark",
    variant === "secondary" && "border border-line bg-white text-ink hover:border-brand hover:text-brand",
    variant === "ghost" && "text-brand hover:underline",
  );

export function ButtonLink({ href, children, variant, className, ...rest }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost"; className?: string } & Omit<ComponentProps<"a">, "href">) {
  const external = href.startsWith("http");
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(buttonClass(variant), className)} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cn(buttonClass(variant), className)}>
      {children}
    </Link>
  );
}
