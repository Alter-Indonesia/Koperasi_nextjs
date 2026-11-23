"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Modal, Skeleton, Toast } from "@/components/ui/Feedback";
import { SearchInput } from "@/components/ui/Form";
import { api, ApiError, qs, useApi, useDebounced } from "@/lib/api";
import { rupiah, tanggal } from "@/lib/format";
import { useSession } from "@/lib/session";

type Approved = { id: number; loan_id: number; amount: number; installments_count: number; approved_at: string; loan_number: string; member_name: string; member_number: string; member_phone: string | null; member_address: string | null };
type LoanRow = { loan_id: number; loan_number: string; member_name: string; member_number: string; member_phone: string | null; amount: number; installments_count: number; blocked: string | null };
type Mine = { id: number; amount: number; installments_count: number; status: string; source: string; receipt_code: string; received_at: string; loan_number: string; member_name: string; deposit_state: string | null };
type Data = { approved: Approved[]; loans: LoanRow[]; mine: Mine[] };
type Konfirmasi = { kind: "approved"; row: Approved } | { kind: "langsung"; row: LoanRow };

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  belum_disetor: { label: "Belum disetor", tone: "warn-outline" },
  setoran_menunggu: { label: "Setoran menunggu kasir", tone: "warn-outline" },
  setoran_ditolak: { label: "Setoran ditolak", tone: "telat" },
  setoran_diterima: { label: "Menunggu verifikasi", tone: "belum-bayar" },
  terverifikasi: { label: "Terverifikasi", tone: "sudah-bayar" },
  ditolak: { label: "Ditolak", tone: "telat" },
};

function PelunasanPage() {
  const router = useRouter();
  const { can } = useSession();
  const [cari, setCari] = useState("");
  const q = useDebounced(cari);
  const { data, error, loading, reload } = useApi<Data>(`/api/v1/petugas/pelunasan${qs({ q })}`);
  const [k, setK] = useState<Konfirmasi | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const bisa = can("my_tasks", "create");

  async function terima() {
    if (!k) return;
    setBusy(true);
    try {
      const r = k.kind === "approved"
        ? await api.post<{ id: number }>(`/api/v1/petugas/pelunasan/${k.row.id}/terima`, {})
        : await api.post<{ id: number }>("/api/v1/petugas/pelunasan", { loan_id: k.row.loan_id });
      router.push(`/petugas/pelunasan/${r.data.id}`);
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal mencatat pelunasan", t: "warn" });
      setBusy(false);
      setK(null);
      reload();
    }
  }
  const nama = k?.row.member_name;

  return (
    <>
      <PageHeader title="Pelunasan" subtitle="Terima pelunasan tunai dari anggota yang Anda pegang" />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : data && (
        <div className="flex flex-col gap-4 lg:gap-6">
          {data.approved.length > 0 && (
            <Card title={`Pengajuan Disetujui · ${data.approved.length}`} subtitle="Anggota sudah disetujui Admin untuk melunasi secara tunai">
              <ul className="flex flex-col">
                {data.approved.map((a, i) => (
                  <li key={a.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${i > 0 ? "border-t border-line-subtle" : ""}`}>
                    <div className="min-w-0">
                      <p className="truncate text-body font-bold text-fg">{a.member_name}</p>
                      <p className="truncate text-body-sm text-fg-muted">{a.member_number} · {a.loan_number}{a.member_phone ? ` · ${a.member_phone}` : ""}</p>
                      <p className="text-body font-bold text-fg">{rupiah(a.amount)} <span className="text-body-sm font-normal text-fg-muted">· {a.installments_count} angsuran</span></p>
                    </div>
                    {bisa && <Button variant="accent" onClick={() => setK({ kind: "approved", row: a })}>Terima Tunai</Button>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Pelunasan Langsung" subtitle="Anggota membayar lunas seluruh sisa pinjaman langsung kepada Anda">
            <SearchInput value={cari} onChange={setCari} placeholder="Cari anggota / no. pinjaman" className="mb-3 w-full" />
            {data.loans.length === 0 && <p className="py-4 text-body-sm text-fg-muted">Tidak ada pinjaman aktif pada anggota yang Anda pegang.</p>}
            <ul className="flex flex-col">
              {data.loans.map((l, i) => (
                <li key={l.loan_id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${i > 0 ? "border-t border-line-subtle" : ""}`}>
                  <div className="min-w-0">
                    <p className="truncate text-body font-bold text-fg">{l.member_name}</p>
                    <p className="truncate text-body-sm text-fg-muted">{l.member_number} · {l.loan_number}</p>
                    <p className="text-body font-bold text-fg">{rupiah(l.amount)} <span className="text-body-sm font-normal text-fg-muted">· {l.installments_count} angsuran</span></p>
                    {l.blocked && <p className="text-body-sm font-bold text-warn-text">{l.blocked}</p>}
                  </div>
                  {bisa && <Button variant="outline" disabled={!!l.blocked} onClick={() => setK({ kind: "langsung", row: l })}>Terima Pelunasan</Button>}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Kwitansi Saya" subtitle="Pelunasan tunai yang sudah Anda terima. Setor uangnya lewat menu Setoran Kas.">
            {data.mine.length === 0 && <p className="py-4 text-body-sm text-fg-muted">Belum ada pelunasan tunai yang Anda terima.</p>}
            <ul className="flex flex-col">
              {data.mine.map((m, i) => {
                const st = STATUS[m.status === "menunggu_verifikasi" ? (m.deposit_state ?? "belum_disetor") : m.status] ?? { label: m.status, tone: "belum-bayar" as BadgeTone };
                return (
                  <li key={m.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${i > 0 ? "border-t border-line-subtle" : ""}`}>
                    <div className="min-w-0">
                      <p className="truncate text-body font-bold text-fg">{m.member_name}</p>
                      <p className="truncate text-body-sm text-fg-muted">{m.receipt_code} · {tanggal(m.received_at)}</p>
                      <p className="text-body font-bold text-fg">{rupiah(m.amount)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <Button variant="outline" size="sm" onClick={() => router.push(`/petugas/pelunasan/${m.id}`)}>Cetak Bukti</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
      <Modal
        open={!!k}
        title="Terima uang pelunasan?"
        onClose={() => setK(null)}
        footer={<><Button variant="outline" onClick={() => setK(null)}>Batal</Button><Button variant="accent" disabled={busy} onClick={terima}>Ya, uang sudah saya terima</Button></>}
      >
        {k && (
          <>
            <p className="text-body text-fg-muted">{nama} · {k.row.loan_number} · <b className="text-fg">{rupiah(k.row.amount)}</b> ({k.row.installments_count} angsuran).</p>
            <p className="text-body text-fg-muted">Pastikan Anda sudah memegang uang tunai sebesar nominal ini. Setelah dicatat, kwitansi ber-QR dibuat dan uang masuk ke &quot;uang tunai yang Anda pegang&quot; untuk disetor ke kasir.</p>
          </>
        )}
      </Modal>
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}

export default withFreshState(PelunasanPage, { module: "my_tasks" });
