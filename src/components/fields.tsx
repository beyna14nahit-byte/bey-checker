import type { ReactNode } from "react";

export function Field({ id, label, required, error, help, children }: { id: string; label: string; required?: boolean; error?: string; help?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-bad" aria-hidden="true"> *</span>}
      </label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-muted">{help}</p>}
      {error && (
        <p className="mt-1 text-sm text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full bg-brand transition-[width] duration-200" style={{ width: `${value}%` }} />
    </div>
  );
}
