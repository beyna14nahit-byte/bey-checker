import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names and resolves conflicting Tailwind classes (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Where to go after admin sign-in: only admin pages and admin file downloads on this site. */
export function safeAdminNext(next: unknown): string {
  if (typeof next !== "string" || next.length > 300) return "/admin";
  if (!/^\/(admin(\/|$|\?)|api\/admin\/files\/)/.test(next) || next.startsWith("//") || next.includes("\\")) return "/admin";
  return next.startsWith("/admin/login") ? "/admin" : next;
}
