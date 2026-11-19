const rp = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const dec = (n: number, d = 1) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: d }).format(n);

/** Rp 1.250.000 */
export const rupiah = (n: number | null | undefined) => `Rp ${rp.format(Math.round(n ?? 0))}`;

/** Rp 4,82 M · Rp 142,6 jt · Rp 850.000 */
export function rupiahRingkas(n: number | null | undefined) {
  const v = n ?? 0;
  if (Math.abs(v) >= 1e9) return `Rp ${dec(v / 1e9, 2)} M`;
  if (Math.abs(v) >= 1e6) return `Rp ${dec(v / 1e6, 1)} jt`;
  return rupiah(v);
}

export const angka = (n: number | null | undefined) => rp.format(n ?? 0);
export const persen = (n: number | null | undefined, d = 1) => `${dec((n ?? 0) * 100, d)}%`;

const parse = (d: string | Date) => (typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00" : d) : d);

/** Kamis, 19 November 2026 */
export const tanggalPanjang = (d: string | Date) =>
  parse(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** 19 Nov 2026 */
export const tanggal = (d: string | Date) => parse(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
/** 19 Nov */
export const tanggalPendek = (d: string | Date) => parse(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
/** 10:12 */
export const jam = (d: string | Date) => parse(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
/** Nov 2026 */
export const bulanTahun = (d: string | Date) => parse(d).toLocaleDateString("id-ID", { month: "short", year: "numeric" });

export const inisial = (nama: string) =>
  nama
    .replace(/^H\.\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

export const isoHariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const tambahHari = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
