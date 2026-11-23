"use client";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BackLink } from "@/components/crud/EntityPages";
import { ErrorBox, Modal, Skeleton } from "@/components/ui/Feedback";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { CellStack, Table } from "@/components/ui/Table";
import { api, ApiError, useApi } from "@/lib/api";
import { angka, jam, rupiah, tanggal, tanggalPanjang } from "@/lib/format";
import { useSession } from "@/lib/session";
import { withFreshState } from "@/components/layout/FreshState";
import { DEPOSIT_LABEL, DEPOSIT_TONE, type DepositStatus } from "@/lib/deposit";

type Detail = {
  id: number; deposited_on: string; amount: number; payment_count: number; status: DepositStatus; received_amount: number | null; returned_amount: number; carried_amount: number;
  notes: string | null; decided_at: string | null; collector_name: string; received_by_name: string | null;
  payments: { id: number; amount: number; paid_at: string; member_name: string; loan_number: string; installment_sequence: number }[];
};

function SetoranDetailPage({ params }: PageProps<"/admin/setoran/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useSession();
  const { data: d, error, loading, reload } = useApi<Detail>(`/api/v1/setoran/${id}`);
  const [diterima, setDiterima] = useState<string | null>(null); // null = belum diubah (mengikuti nilai setoran)
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pending = d?.status === "menunggu";
  const nilai = diterima === null ? d?.amount ?? 0 : Number(diterima) || 0;
  const selisih = d ? d.amount - nilai : 0;
  const salahJumlah = d && (nilai < 1 ? "Jumlah diterima minimal Rp 1 (gunakan Tolak bila tidak ada yang diterima)" : nilai > d.amount ? "Jumlah diterima tidak boleh melebihi nilai setoran" : null);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/api/v1/setoran/${id}`, { action, received_amount: action === "approve" ? nilai : undefined, notes: notes.trim() || undefined });
      router.push("/admin/setoran#diputuskan");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan keputusan");
      setConfirm(null);
      setBusy(false);
      reload();
    }
  }

  function buka(aksi: "approve" | "reject") {
    setErr(null);
    if (aksi === "approve" && salahJumlah) return setErr(salahJumlah);
    if ((aksi === "reject" || selisih > 0) && !notes.trim()) return setErr(aksi === "reject" ? "Alasan penolakan wajib diisi" : "Catatan wajib diisi bila ada selisih");
    setConfirm(aksi);
  }

  return (
    <>
      <BackLink href="/admin/setoran">Setoran Petugas</BackLink>
      <PageHeader
        title={d ? `Setoran ${d.collector_name}` : "Detail Setoran"}
        subtitle={d ? tanggalPanjang(d.deposited_on) : "Memuat…"}
        actions={d && <Badge tone={DEPOSIT_TONE[d.status]}>{DEPOSIT_LABEL[d.status]}</Badge>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d && <Skeleton className="h-[420px]" />}
      {d && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-6">
            <Card title="Pembayaran Tunai yang Disetor" subtitle={d.carried_amount > 0 ? `Termasuk ${rupiah(d.carried_amount)} uang kembalian dari setoran sebelumnya` : undefined}>
              <Table
                rows={d.payments}
                rowKey={(p) => p.id}
                empty="Tidak ada pembayaran baru (setoran ini hanya membawa uang kembalian)"
                columns={[
                  { key: "a", header: "Anggota", render: (p) => <CellStack title={p.member_name} sub={`${p.loan_number} · angsuran ke-${p.installment_sequence}`} /> },
                  { key: "w", header: "Waktu", render: (p) => `${tanggal(p.paid_at)}, ${jam(p.paid_at)}` },
                  { key: "j", header: "Jumlah", render: (p) => <b>{rupiah(p.amount)}</b> },
                ]}
              />
            </Card>
            {pending && can("deposit_receipts", "update") ? (
              <Card title="Keputusan" subtitle="Terima sesuai uang yang benar-benar Anda terima. Selisih (bila ada) dan seluruh nilai setoran yang ditolak dikembalikan ke petugas.">
                <div className="flex flex-col gap-4">
                  <Field label="Jumlah diterima" wajib error={salahJumlah && diterima !== null ? salahJumlah : undefined}>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body font-medium text-fg-muted">Rp</span>
                      <Input className="pl-12" inputMode="numeric" value={nilai ? angka(nilai) : ""} onChange={(e) => setDiterima(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="0" />
                    </div>
                  </Field>
                  {selisih > 0 && !salahJumlah && <p className="rounded-ctl bg-canvas px-4 py-3 text-body-sm text-warn-text">Selisih {rupiah(selisih)} akan dikembalikan ke {d.collector_name}.</p>}
                  <Field label="Catatan (wajib bila ada selisih atau menolak)">
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mis. uang kurang Rp 50.000, kembali ke petugas" />
                  </Field>
                </div>
                {err && <span className="mt-2 block text-small font-medium text-warn-text">{err}</span>}
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="danger" size="lg" disabled={busy} onClick={() => buka("reject")}>Tolak Setoran</Button>
                  <Button size="lg" disabled={busy} onClick={() => buka("approve")}>{selisih > 0 ? "Terima dengan Selisih" : "Terima Setoran"}</Button>
                </div>
              </Card>
            ) : (
              !pending && (
                <Card title="Keputusan">
                  <p className="text-body-sm text-fg-muted">
                    {d.status === "ditolak" ? "Ditolak" : "Diterima"} oleh <b className="text-fg">{d.received_by_name ?? "—"}</b>{d.decided_at ? ` pada ${tanggal(d.decided_at)}, ${jam(d.decided_at)}` : ""}.
                  </p>
                  {d.notes && <p className="mt-2 text-body-sm">Catatan: {d.notes}</p>}
                </Card>
              )
            )}
          </div>
          <Card title="Ringkasan">
            <dl className="flex flex-col gap-3 text-body-sm">
              <div><dt className="text-fg-muted">Petugas</dt><dd className="font-medium">{d.collector_name}</dd></div>
              <div><dt className="text-fg-muted">Nilai setoran</dt><dd className="text-title font-bold">{rupiah(d.amount)}</dd></div>
              <div><dt className="text-fg-muted">Jumlah pembayaran</dt><dd className="font-medium">{d.payment_count}</dd></div>
              {!pending && <div><dt className="text-fg-muted">Diterima</dt><dd className="font-medium">{rupiah(d.received_amount)}</dd></div>}
              {d.returned_amount > 0 && <div><dt className="text-fg-muted">Dikembalikan ke petugas</dt><dd className="font-bold text-warn-text">{rupiah(d.returned_amount)}</dd></div>}
            </dl>
          </Card>
        </div>
      )}
      <Modal
        open={!!confirm}
        title={confirm === "approve" ? "Terima setoran?" : "Tolak setoran?"}
        onClose={() => !busy && setConfirm(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>Batal</Button>
            <Button variant={confirm === "reject" ? "danger" : "primary"} onClick={() => confirm && decide(confirm)} disabled={busy}>{busy ? "Menyimpan…" : confirm === "approve" ? "Ya, terima" : "Ya, tolak"}</Button>
          </>
        }
      >
        <p className="text-body-sm text-fg-muted">
          {confirm === "approve"
            ? `Diterima ${rupiah(nilai)}${selisih > 0 ? `, ${rupiah(selisih)} dikembalikan ke ${d?.collector_name}` : ""}. Keputusan tidak bisa dibatalkan dari sini.`
            : `Seluruh ${rupiah(d?.amount)} dikembalikan ke ${d?.collector_name} dan harus disetor ulang. Keputusan tidak bisa dibatalkan dari sini.`}
        </p>
      </Modal>
    </>
  );
}

export default withFreshState(SetoranDetailPage, { module: "deposit_receipts" });
