import { inisial } from "@/lib/format";
import { cx } from "./cx";

/** Design system: Avatar/Accent · Avatar/Inverse. Ukuran 32 (tabel) · 40 (daftar) · 56 (detail). */
const SIZE = { 32: "size-8 text-caption", 36: "size-9 text-small", 40: "size-10 text-body-sm", 56: "size-14 text-title" } as const;

export function Avatar({
  name,
  size = 40,
  tone = "accent",
  className,
}: {
  name: string;
  size?: keyof typeof SIZE;
  tone?: "accent" | "inverse" | "warn";
  className?: string;
}) {
  const t = tone === "accent" ? "bg-accent text-on-accent" : tone === "inverse" ? "bg-inverse text-accent" : "bg-warn text-on-warn";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-pill font-bold", SIZE[size], t, className)}>
      {inisial(name)}
    </span>
  );
}

/** Selang-seling Accent / Inverse seperti di desain */
export const avatarTone = (i: number) => (i % 2 === 0 ? "accent" : "inverse") as "accent" | "inverse";
