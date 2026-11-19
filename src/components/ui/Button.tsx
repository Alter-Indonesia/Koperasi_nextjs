import { cx } from "./cx";

/**
 * Design system: Button/Primary · Accent · Outline · Danger · Small
 * Tinggi: sm 30 (tabel) · md 40 (default) · lg 44 (header) · xl 52 (CTA). Radius 10 (sm: 8). Teks 13 Bold.
 */
export type ButtonVariant = "primary" | "accent" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-inverse text-accent",
  accent: "bg-accent text-on-accent",
  outline: "bg-transparent text-fg border-[1.5px] border-fg",
  danger: "bg-transparent text-warn-text border-[1.5px] border-warn",
};
const SIZE: Record<ButtonSize, string> = {
  sm: "h-[30px] px-[14px] rounded-chip text-small",
  md: "h-10 px-[18px] rounded-ctl text-body-sm",
  lg: "h-11 px-[18px] rounded-ctl text-body-sm",
  xl: "h-[52px] px-6 rounded-ctl text-body",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap transition-opacity",
    "disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 cursor-pointer",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}
