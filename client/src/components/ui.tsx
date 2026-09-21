import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex ${compact ? "items-baseline gap-3" : "flex-col items-start gap-1"}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">Coach Kind</span>
      <span className={`font-serif leading-none text-brand ${compact ? "text-2xl" : "text-5xl"}`}>4S</span>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-base font-semibold hover:bg-brand-soft disabled:bg-surface-3 disabled:text-dim",
  secondary: "bg-surface-3 text-ink hover:bg-[#444] disabled:bg-surface-2 disabled:text-dim",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface-2 disabled:text-dim",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10 disabled:text-dim",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-surface-3 bg-surface-1 ${className}`}>{children}</div>;
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-sm font-semibold text-ink">{children}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-surface-3 bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-dim focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/30";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted/40 border-t-brand ${className}`} aria-hidden />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      {children}
    </div>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "brand" }) {
  const cls = tone === "brand" ? "bg-brand/15 text-brand border-brand/30" : "bg-surface-2 text-muted border-surface-3";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide ${cls}`}>
      {children}
    </span>
  );
}
