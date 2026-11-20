/** Perhitungan jumlah pinjaman (aman untuk klien & server). */
export type AdminFeeMode = "potong" | "tambah";

/**
 * - potong (pengurang): angsuran dihitung dari plafon; dana yang diterima = plafon − biaya admin.
 * - tambah (penambah): dana yang diterima = plafon; pokok yang ditagih (dasar angsuran) = plafon + biaya admin.
 */
export function loanAmounts(principal: number, adminFee: number, mode: AdminFeeMode) {
  return {
    financed: mode === "tambah" ? principal + adminFee : principal, // pokok yang harus dibayar anggota
    received: mode === "potong" ? principal - adminFee : principal, // dana yang diterima anggota
  };
}
