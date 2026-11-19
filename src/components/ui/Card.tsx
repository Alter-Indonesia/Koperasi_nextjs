import Link from "next/link";
import { cx } from "./cx";

/** Kartu/panel: bg/card, radius 14 (radius/lg), padding 20. Judul 16 Bold. */
export function Card({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cx("rounded-card bg-card p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-title font-bold text-fg">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-small text-fg-subtle">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Tautan aksi di pojok kartu: 13 Bold warn/text */
export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-body-sm font-bold text-warn-text whitespace-nowrap hover:underline">
      {children} →
    </Link>
  );
}

/** Design system: Card/Stat · Card/Stat Inverse. Judul 13 Medium, nilai 28 Bold, keterangan 12. */
export function StatCard({
  label,
  value,
  note,
  inverse,
  noteTone,
  children,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  inverse?: boolean;
  noteTone?: "warn";
  children?: React.ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-2 rounded-card p-5", inverse ? "bg-inverse" : "border border-line-subtle bg-card")}>
      <span className={cx("text-body-sm font-medium", inverse ? "text-fg-inverse-muted" : "text-fg-muted")}>{label}</span>
      <span className={cx("text-kpi font-bold", inverse ? "text-accent" : "text-fg")}>{value}</span>
      {children}
      {note && (
        <span className={cx("text-small", noteTone === "warn" ? "font-medium text-warn-text" : inverse ? "text-fg-inverse-muted" : "text-fg-muted")}>
          {note}
        </span>
      )}
    </div>
  );
}
