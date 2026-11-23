/** Samakan no. HP: digit saja, awalan 62 -> 0 (sama dengan fungsi SQL normalize_phone). Kosong -> null. */
export function normalizePhone(p: string | null | undefined): string | null {
  const d = (p ?? "").replace(/\D/g, "");
  if (!d) return null;
  return d.startsWith("62") ? `0${d.slice(2)}` : d;
}
