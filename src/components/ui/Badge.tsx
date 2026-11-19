import { cx } from "./cx";

/**
 * Design system: Badge/Lancar · DPK · Kurang Lancar · Diragukan · Macet, Status/Sudah bayar · Belum bayar · Telat
 * Pill penuh, padding 4×12, teks 11 Bold.
 */
export type BadgeTone = "lancar" | "dpk" | "kurang-lancar" | "diragukan" | "macet" | "sudah-bayar" | "belum-bayar" | "telat" | "warn-outline";

const TONE: Record<BadgeTone, string> = {
  lancar: "bg-kol-lancar text-accent",
  dpk: "bg-kol-dpk text-on-accent",
  "kurang-lancar": "bg-kol-kurang-lancar text-on-warn",
  diragukan: "bg-kol-diragukan text-on-warn",
  macet: "bg-kol-macet text-on-warn",
  "sudah-bayar": "bg-inverse text-accent",
  "belum-bayar": "border border-fg text-fg",
  telat: "bg-warn text-on-warn",
  "warn-outline": "border border-warn text-warn-text",
};

export function Badge({ tone, children, className }: { tone: BadgeTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-pill px-3 py-1 text-caption font-bold whitespace-nowrap", TONE[tone], className)}>
      {children}
    </span>
  );
}

export type Kolektibilitas = "Lancar" | "DPK" | "Kurang Lancar" | "Diragukan" | "Macet";
const KOL_TONE: Record<Kolektibilitas, BadgeTone> = {
  Lancar: "lancar",
  DPK: "dpk",
  "Kurang Lancar": "kurang-lancar",
  Diragukan: "diragukan",
  Macet: "macet",
};

export const KolBadge = ({ value }: { value: Kolektibilitas }) => <Badge tone={KOL_TONE[value]}>{value}</Badge>;
