import { cx } from "./cx";

/** Design system: Chip/Active (inverse + accent, Bold) · Chip/Default (card + line, Medium). Teks 12, padding 8×12. */
export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-small whitespace-nowrap cursor-pointer",
        active ? "bg-inverse text-accent font-bold" : "bg-card text-fg font-medium border border-line hover:border-fg-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function ChipGroup<T extends string | number | null>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <Chip key={String(o.value)} active={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
