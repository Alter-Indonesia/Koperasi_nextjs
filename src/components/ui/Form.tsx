"use client";
import { Search } from "lucide-react";
import { cx } from "./cx";

/** Design system: Input/Search — tinggi 40, radius 10, border line/default, ikon 16 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cx("flex h-10 items-center gap-2.5 rounded-ctl border border-line bg-card px-3.5", className)}>
      <Search size={16} strokeWidth={1.5} className="shrink-0 text-fg-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-body-sm text-fg outline-none placeholder:text-fg-subtle"
      />
    </label>
  );
}

export function Field({ label, error, wajib, children }: { label: string; error?: string; wajib?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-body-sm font-bold text-fg">
        {label}
        {wajib && <span className="ml-0.5 text-warn-text" aria-label="wajib diisi">*</span>}
      </span>
      {children}
      {error && <span className="text-small font-medium text-warn-text">{error}</span>}
    </label>
  );
}

/**
 * Design system: Input/Text — tinggi 52 (size/control-xl), radius 10, border 1.5.
 * `compact`: tinggi 40 (size/control-md) untuk filter di header/toolbar. Lebar diatur oleh pembungkus.
 */
const inputBase = "w-full rounded-ctl bg-card text-fg outline-none focus:border-fg placeholder:text-fg-subtle disabled:cursor-default disabled:bg-canvas";
const inputSize = { xl: "h-[52px] border-[1.5px] border-line px-4 text-body", compact: "h-10 border border-line px-3 text-body-sm" } as const;
type Ukuran = { ukuran?: keyof typeof inputSize };

export const Input = ({ ukuran = "xl", className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & Ukuran) => (
  <input {...p} className={cx(inputBase, inputSize[ukuran], className)} />
);

export const Select = ({ ukuran = "xl", className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & Ukuran) => (
  <select {...p} className={cx(inputBase, inputSize[ukuran], "cursor-pointer", className)} />
);

export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx("min-h-20 w-full rounded-ctl border border-line bg-card px-4 py-3 text-body-sm text-fg outline-none focus:border-fg placeholder:text-fg-subtle disabled:cursor-default disabled:bg-canvas", p.className)} />
);

/** Design system: Toggle/On · Toggle/Off — 44×24, knob 20 */
export function Toggle({ on, onChange, label }: { on: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange?.(!on)}
      className={cx("relative h-6 w-11 shrink-0 cursor-pointer rounded-[12px] transition-colors", on ? "bg-accent" : "bg-line")}
    >
      <span className={cx("absolute top-0.5 size-5 rounded-pill transition-all", on ? "left-[22px] bg-inverse" : "left-0.5 bg-card")} />
    </button>
  );
}

/** Design system: Checkbox/On · Checkbox/Off — 20px, radius 4 */
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-[1.5px] text-caption font-bold",
        checked ? "border-fg bg-accent text-on-accent" : "border-fg-subtle bg-card",
      )}
    >
      {checked ? "✓" : ""}
    </button>
  );
}

/** Design system: Progress/Accent · Progress/Warn — tinggi 8 */
export function Progress({ value, tone = "accent", className, track = "canvas" }: { value: number; tone?: "accent" | "warn"; className?: string; track?: "canvas" | "card" }) {
  const pct = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-pill", track === "canvas" ? "bg-canvas" : "bg-card", className)}>
      <div className={cx("h-full rounded-pill", tone === "accent" ? "bg-accent" : "bg-warn")} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
