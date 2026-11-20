"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { SearchInput } from "@/components/ui/Form";
import { CellStack, Table } from "@/components/ui/Table";
import { cx } from "@/components/ui/cx";
import { api, ApiError, qs, useApi, useDebounced } from "@/lib/api";
import { rupiah, rupiahRingkas, tambahHari, tanggalPanjang } from "@/lib/format";
import { KartuModal, type Kartu } from "./KartuModal";
import { withFreshState } from "@/components/layout/FreshState";
import { useSession } from "@/lib/session";

type Row = { id: number; sequence: number; due_date: string; total_amount: number; status: string; tenor_duration: number; loan_number: string; member_name: string; region_name: string; collector_name: string | null; days_overdue: number; reminder_channel: string | null; reminder_status: string | null };
type Meta = {
  date: string;
  week: { date: string; count: number }[];
  summary: Record<"overdue_count" | "overdue_amount" | "today_count" | "today_amount" | "tomorrow_count" | "tomorrow_amount" | "h3_count" | "h3_amount", number>;
};
type Bucket = "overdue" | "today" | "tomorrow" | "h3";
const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const SALURAN: Record<string, string> = { whatsapp: "WA", sms: "SMS", telepon: "Telepon", surat: "Surat" };

function JatuhTempoPage() {
  const { can } = useSession();
  const [tgl, setTgl] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | "unpaid" | "overdue">("all");
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cari, setCari] = useState("");
  const [kartu, setKartu] = useState<Kartu | null>(null);
  const search = useDebounced(cari.trim());
  const { data, meta, error, loading, reload } = useApi<Row[], Meta>(`/api/v1/jatuh-tempo${qs({ date: tgl, status, q: search })}`);
  const pilih = tgl ?? meta?.date ?? null;
  const r = meta?.summary;

  /** kirim pengingat (tanpa ids = massal); true bila berhasil */
  async function ingatkan(ids?: number[]): Promise<boolean> {
    setBusy(true);
    try {
      const res = await api.post<{ sent: number }>("/api/v1/pengingat/kirim", ids ? { installment_ids: ids } : { all_due: true });
      setToast({ m: `${res.data.sent} pengingat WhatsApp dikirim`, t: "ok" });
      reload();
      return true;
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal mengirim", t: "warn" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Monitoring Jatuh Tempo"
        subtitle="Pantau jadwal angsuran anggota per hari"
        actions={
          <>
            <div className="flex h-11 items-center gap-1 rounded-ctl border border-line bg-card px-2">
              <button className="cursor-pointer p-1.5" aria-label="Minggu sebelumnya" onClick={() => pilih && setTgl(tambahHari(pilih, -7))}><ChevronLeft size={16} strokeWidth={1.5} /></button>
              <span className="min-w-[150px] text-center text-body-sm font-bold">{pilih ? new Date(pilih + "T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "…"}</span>
              <button className="cursor-pointer p-1.5" aria-label="Minggu berikutnya" onClick={() => pilih && setTgl(tambahHari(pilih, 7))}><ChevronRight size={16} strokeWidth={1.5} /></button>
            </div>
            {can("reminders", "create") && <Button variant="accent" size="lg" disabled={busy} onClick={() => ingatkan()}>Kirim Pengingat Massal</Button>}
          </>
        }
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card className="mb-6">
        <div className="grid grid-cols-[repeat(7,minmax(72px,1fr))] gap-3 overflow-x-auto">
          {(meta?.week ?? Array.from({ length: 7 }, (_, i) => ({ date: String(i), count: 0 }))).map((m, i) => {
            const on = m.date === pilih;
            return (
              <button key={m.date} onClick={() => setTgl(m.date)} className={cx("flex h-[72px] cursor-pointer flex-col justify-center rounded-ctl px-3.5 text-left", on ? "bg-inverse" : "bg-canvas hover:bg-line-subtle")}>
                <span className={cx("text-small font-medium", on ? "text-fg-inverse-muted" : "text-fg-muted")}>{HARI[i]}</span>
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cx("text-mobile font-bold", on ? "text-fg-inverse" : "text-fg")}>{m.date.length === 10 ? Number(m.date.slice(8)) : "–"}</span>
                  <span className={cx("text-small font-bold", on ? "text-accent" : "text-fg-muted")}>{m.count} tagihan</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {([
          ["Lewat jatuh tempo", r?.overdue_count, r?.overdue_amount, true, "overdue"],
          ["Jatuh tempo hari ini", r?.today_count, r?.today_amount, false, "today"],
          ["Besok (H-1)", r?.tomorrow_count, r?.tomorrow_amount, false, "tomorrow"],
          ["3 hari lagi (H-3)", r?.h3_count, r?.h3_amount, false, "h3"],
        ] as [string, number | undefined, number | undefined, boolean, Bucket][]).map(([l, n, v, dk, b]) => (
          <button
            key={b}
            type="button"
            disabled={n === undefined}
            onClick={() => setKartu({ bucket: b, label: l, count: n ?? 0, amount: v ?? 0 })}
            className={cx("cursor-pointer rounded-card px-5 py-4 text-left", dk ? "bg-inverse" : "bg-card hover:bg-line-subtle")}
          >
            <div className={cx("text-small font-medium", dk ? "text-fg-inverse-muted" : "text-fg-muted")}>{l}</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className={cx("text-mobile font-bold", dk ? "text-warn" : "text-fg")}>{n ?? "…"} angsuran</span>
              <span className={cx("text-body-sm font-bold", dk ? "text-accent" : "text-fg")}>{rupiahRingkas(v ?? 0)}</span>
            </div>
          </button>
        ))}
      </div>
      <Card
        title={pilih ? `Jatuh tempo s.d. ${tanggalPanjang(pilih)}` : "Jatuh tempo"}
        action={
          <div className="flex items-center gap-3">
            <SearchInput value={cari} onChange={setCari} placeholder="Cari nama, no. pinjaman, petugas…" className="w-[300px]" />
            <ChipGroup value={status} onChange={setStatus} options={[{ value: "all", label: "Semua" }, { value: "unpaid", label: "Belum bayar" }, { value: "overdue", label: "Telat" }]} />
          </div>
        }
      >
        {loading && !data ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <Table
            rows={data ?? []}
            rowKey={(x) => x.id}
            empty={search ? "Tidak ada angsuran yang cocok dengan pencarian" : "Tidak ada angsuran untuk filter ini"}
            columns={[
              { key: "a", header: "Anggota", render: (x) => <CellStack title={x.member_name} sub={x.region_name} /> },
              { key: "n", header: "No. Pinjaman", render: (x) => x.loan_number },
              { key: "k", header: "Ke-", render: (x) => `${x.sequence}/${x.tenor_duration}` },
              { key: "r", header: "Nominal", render: (x) => <b>{rupiah(x.total_amount)}</b> },
              { key: "p", header: "Petugas", render: (x) => x.collector_name?.split(" ")[0] ?? "—" },
              { key: "g", header: "Pengingat", render: (x) => x.reminder_channel ? <span className={x.reminder_status === "gagal" ? "text-warn-text" : "text-fg-muted"}>{SALURAN[x.reminder_channel]} · {x.reminder_status}</span> : <span className="text-fg-subtle">belum dikirim</span> },
              { key: "s", header: "Status", render: (x) => x.status !== "belum" ? <Badge tone="sudah-bayar">Sudah bayar</Badge> : x.days_overdue > 0 ? <Badge tone="telat">Telat {x.days_overdue} hari</Badge> : <Badge tone="belum-bayar">Belum bayar</Badge> },
              {
                key: "x", header: "Aksi", render: (x) => x.status !== "belum" || !can("reminders", "create") ? <span className="text-fg-subtle">—</span>
                  : x.days_overdue > 0 ? <Button variant="danger" size="sm" disabled={busy} onClick={() => ingatkan([x.id])}>Tagih Lanjut</Button>
                  : <Button variant="accent" size="sm" disabled={busy} onClick={() => ingatkan([x.id])}>Ingatkan</Button>,
              },
            ]}
          />
        )}
      </Card>
      {kartu && <KartuModal kartu={kartu} date={tgl} onClose={() => setKartu(null)} onRemind={ingatkan} busy={busy} />}
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}

export default withFreshState(JatuhTempoPage, { module: "due_dates" });
