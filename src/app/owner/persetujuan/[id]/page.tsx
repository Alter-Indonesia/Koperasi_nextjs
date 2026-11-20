"use client";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BackLink } from "@/components/crud/EntityPages";
import { ErrorBox, Modal, Skeleton } from "@/components/ui/Feedback";
import { Textarea } from "@/components/ui/Form";
import { api, ApiError, useApi } from "@/lib/api";
import { type AdminFeeMode, loanAmounts } from "@/lib/loan-calc";
import { jam, rupiah, tanggal, tenorLabel, type TenorUnit } from "@/lib/format";
import { useSession } from "@/lib/session";
import { withFreshState } from "@/components/layout/FreshState";

type Detail = {
  id: number; loan_number: string; member_id: number; member_name: string; member_number: string; member_phone: string | null; region_name: string;
  principal_amount: number; tenor_duration: number; tenor_unit: TenorUnit; admin_fee: number; admin_fee_mode: AdminFeeMode; interest_rate_percent: number; installment_amount: number; purpose: string | null; collateral: string | null;
  disbursed_on: string | null; status: "pengajuan" | "aktif" | "ditolak" | "lunas"; created_at: string; submitted_by_name: string | null;
  decided_by_name: string | null; decided_at: string | null; decision_notes: string | null; member_active_loans: number; member_outstanding: number;
};

function PersetujuanDetailPage({ params }: PageProps<"/owner/persetujuan/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useSession();
  const { data: d, error, loading, reload } = useApi<Detail>(`/api/v1/persetujuan/${id}`);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/api/v1/persetujuan/${id}`, { action, notes: notes.trim() || undefined });
      router.push("/owner/persetujuan#diputuskan");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan keputusan");
      setConfirm(null);
      setBusy(false);
      reload();
    }
  }

  const pending = d?.status === "pengajuan";
  const totalBack = d ? d.installment_amount * d.tenor_duration : 0;
  return (
    <>
      <BackLink href="/owner/persetujuan">Persetujuan Pinjaman</BackLink>
      <PageHeader
        title={d ? d.loan_number : "Detail Pengajuan"}
        subtitle={d ? `${d.member_name} · ${d.member_number} · ${d.region_name}` : "Memuat…"}
        actions={d && (pending ? <Badge tone="warn-outline">Menunggu keputusan</Badge> : <Badge tone={d.status === "ditolak" ? "telat" : "sudah-bayar"}>{d.status === "ditolak" ? "Ditolak" : "Disetujui"}</Badge>)}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d && <Skeleton className="h-[420px]" />}
      {d && (
        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
          <div className="flex flex-col gap-6">
            <Card title="Rincian Pinjaman">
              <div className="grid grid-cols-3 gap-6">
                {([
                  ["Plafon", rupiah(d.principal_amount)], ["Tenor", tenorLabel(d.tenor_duration, d.tenor_unit)], ["Jasa", `${d.interest_rate_percent}% / ${d.tenor_unit === "hari" ? "hari" : "bln"} flat`],
                  [`Angsuran / ${d.tenor_unit}`, rupiah(d.installment_amount)], ["Biaya admin", `${rupiah(d.admin_fee)} (${d.admin_fee_mode === "tambah" ? "penambah" : "pengurang"})`], ["Pokok ditagih", rupiah(loanAmounts(d.principal_amount, d.admin_fee, d.admin_fee_mode).financed)], ["Dana diterima", rupiah(loanAmounts(d.principal_amount, d.admin_fee, d.admin_fee_mode).received)], ["Total kembali", rupiah(totalBack)], ["Rencana cair", d.disbursed_on ? tanggal(d.disbursed_on) : "—"],
                  ["Tujuan", d.purpose ?? "—"], ["Jaminan", d.collateral ?? "—"], ["Diajukan oleh", d.submitted_by_name ?? "—"],
                ] as const).map(([l, v]) => (
                  <div key={l}>
                    <div className="text-small text-fg-muted">{l}</div>
                    <div className="mt-1 text-body font-bold">{v}</div>
                  </div>
                ))}
              </div>
            </Card>
            {pending && can("loan_approvals", "update") ? (
              <Card title="Keputusan" subtitle="Setuju → status aktif dan jadwal angsuran dibuat otomatis. Tolak → alasan wajib diisi.">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan keputusan (wajib bila menolak)" />
                {err && <span className="mt-2 block text-small font-medium text-warn-text">{err}</span>}
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="danger" size="lg" disabled={busy || !notes.trim()} title={!notes.trim() ? "Isi alasan penolakan dulu" : undefined} onClick={() => setConfirm("reject")}>Tolak Pengajuan</Button>
                  <Button size="lg" disabled={busy} onClick={() => setConfirm("approve")}>Setujui Pinjaman</Button>
                </div>
              </Card>
            ) : (
              !pending && (
                <Card title="Keputusan">
                  <p className="text-body-sm text-fg-muted">
                    {d.status === "ditolak" ? "Ditolak" : "Disetujui"} oleh <b className="text-fg">{d.decided_by_name ?? "—"}</b>{d.decided_at ? ` pada ${tanggal(d.decided_at)}, ${jam(d.decided_at)}` : ""}.
                  </p>
                  {d.decision_notes && <p className="mt-2 text-body-sm">Catatan: {d.decision_notes}</p>}
                </Card>
              )
            )}
          </div>
          <Card title="Profil Peminjam">
            <dl className="flex flex-col gap-3 text-body-sm">
              <div><dt className="text-fg-muted">Anggota</dt><dd className="font-medium">{d.member_name} ({d.member_number})</dd></div>
              <div><dt className="text-fg-muted">No. HP</dt><dd className="font-medium">{d.member_phone ?? "—"}</dd></div>
              <div><dt className="text-fg-muted">Pinjaman aktif lainnya</dt><dd className="font-medium">{d.member_active_loans} pinjaman · sisa {rupiah(d.member_outstanding)}</dd></div>
            </dl>
          </Card>
        </div>
      )}
      <Modal
        open={!!confirm}
        title={confirm === "approve" ? "Setujui pinjaman?" : "Tolak pengajuan?"}
        onClose={() => !busy && setConfirm(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>Batal</Button>
            <Button variant={confirm === "reject" ? "danger" : "primary"} onClick={() => confirm && decide(confirm)} disabled={busy}>{busy ? "Menyimpan…" : confirm === "approve" ? "Ya, setujui" : "Ya, tolak"}</Button>
          </>
        }
      >
        <p className="text-body-sm text-fg-muted">
          {confirm === "approve" ? "Pinjaman menjadi aktif dan jadwal angsuran dibuat. Keputusan tidak bisa dibatalkan dari sini." : "Pengajuan ditolak dan tidak bisa diproses lagi."}
        </p>
      </Modal>
    </>
  );
}

export default withFreshState(PersetujuanDetailPage, { module: "loan_approvals" });
