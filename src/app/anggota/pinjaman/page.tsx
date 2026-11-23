"use client";
import { Check } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Badge, KolBadge, type Kolektibilitas } from "@/components/ui/Badge";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { cx } from "@/components/ui/cx";
import { useApi } from "@/lib/api";
import { PayoffCard, type Payoff } from "./PayoffCard";
import { jam, persen, rupiah, tanggal, tenorLabel, type TenorUnit } from "@/lib/format";

type Inst = { id: number; sequence: number; due_date: string; total_amount: number; status: "belum" | "menunggu_verifikasi" | "lunas"; days_overdue: number };
type Pay = { id: number; sequence: number; amount: number; penalty_amount: number; method: string; paid_at: string; status: "menunggu" | "terverifikasi" | "ditolak" };
type Loan = {
  id: number; loan_number: string; purpose: string | null; status: "pengajuan" | "aktif" | "lunas" | "ditolak"; loan_amount: number; tenor_duration: number; tenor_unit: TenorUnit;
  interest_rate_percent: number; installment_amount: number; disbursed_on: string | null; remaining_balance: number; collectibility: Kolektibilitas; installments: Inst[]; payments: Pay[];
  payoff: Payoff | null;
};
const METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS" };
const STATUS_BAYAR: Record<Pay["status"], string> = { menunggu: "Menunggu verifikasi", terverifikasi: "Terverifikasi", ditolak: "Ditolak" };

function PinjamanPage() {
  const { data, error, loading, reload } = useApi<Loan[]>("/api/v1/anggota/saya/pinjaman");
  const [pilih, setPilih] = useState<number | null>(null);
  const [tab, setTab] = useState<"jadwal" | "riwayat">("jadwal");
  const loan = data?.find((l) => l.id === pilih) ?? data?.[0];
  const berikutnya = loan?.installments.find((i) => i.status !== "lunas");
  const sisa = loan ? loan.installments.filter((i) => i.status !== "lunas").length : 0;
  return (
    <>
      <PageHeader title="Pinjaman Saya" subtitle="Jadwal angsuran dan riwayat pembayaran" />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : data && !loan ? (
        <p className="rounded-card bg-card p-5 text-body text-fg-muted">Anda belum memiliki pinjaman.</p>
      ) : loan && data && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
          <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
            {data.length > 1 && (
              <div className="overflow-x-auto">
                <ChipGroup<number> value={loan.id} onChange={setPilih} options={data.map((l) => ({ value: l.id, label: l.loan_number }))} />
              </div>
            )}
            <section className="flex flex-col gap-4 rounded-card bg-inverse p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-body-sm text-fg-inverse-muted">{loan.loan_number}{loan.purpose ? ` · ${loan.purpose}` : ""}</p>
                {loan.status === "aktif" ? <KolBadge value={loan.collectibility} />
                  : loan.status === "pengajuan" ? <Badge tone="warn-outline">Menunggu persetujuan</Badge>
                  : loan.status === "lunas" ? <Badge tone="sudah-bayar">Lunas</Badge>
                  : <Badge tone="telat">Ditolak</Badge>}
              </div>
              <p className="text-kpi font-bold text-fg-inverse">{rupiah(loan.loan_amount)}</p>
              <dl className="grid grid-cols-3 gap-3">
                <div><dt className="text-body-sm text-fg-inverse-muted">Tenor</dt><dd className="text-body font-bold text-fg-inverse">{tenorLabel(loan.tenor_duration, loan.tenor_unit)}</dd></div>
                <div><dt className="text-body-sm text-fg-inverse-muted">Jasa</dt><dd className="text-body font-bold text-fg-inverse">{persen(loan.interest_rate_percent / 100)}/{loan.tenor_unit === "hari" ? "hr" : "bln"}</dd></div>
                <div><dt className="text-body-sm text-fg-inverse-muted">Angsuran</dt><dd className="text-body font-bold text-accent">{rupiah(loan.installment_amount)}</dd></div>
              </dl>
              {loan.disbursed_on && <p className="text-body-sm text-fg-inverse-muted">Dicairkan {tanggal(loan.disbursed_on)}</p>}
            </section>
            {loan.payoff && <PayoffCard key={loan.id} loanId={loan.id} payoff={loan.payoff} onChanged={reload} />}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex gap-1 rounded-card bg-card p-1" role="tablist">
              {([["jadwal", "Jadwal Angsuran"], ["riwayat", "Riwayat Bayar"]] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={cx("h-11 flex-1 cursor-pointer rounded-ctl text-body font-bold", tab === k ? "bg-inverse text-accent" : "text-fg-muted")}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "jadwal" ? (
              <>
                {loan.installments.length === 0 && <p className="rounded-card bg-card p-5 text-body text-fg-muted">Jadwal angsuran belum tersedia{loan.status === "pengajuan" ? " (menunggu persetujuan)" : ""}.</p>}
                <ul className="flex flex-col gap-2">
                  {loan.installments.map((i) => {
                    const next = i.id === berikutnya?.id;
                    const lunas = i.status === "lunas";
                    return (
                      <li key={i.id} className={cx("flex items-center gap-4 rounded-card bg-card px-4 py-3", next && "border-2 border-fg")}>
                        <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-pill text-body font-bold", lunas ? "bg-inverse text-accent" : next ? "bg-accent text-on-accent" : "bg-canvas text-fg-muted")}>
                          {lunas ? <Check size={16} strokeWidth={2} /> : i.sequence}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cx("text-body font-bold", lunas ? "text-fg-muted" : "text-fg")}>Angsuran ke-{i.sequence}</p>
                          <p className="text-body-sm text-fg-muted">{tanggal(i.due_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className={cx("text-body font-bold", lunas ? "text-fg-muted" : "text-fg")}>{rupiah(i.total_amount)}</p>
                          <p className={cx("text-body-sm font-bold", i.days_overdue > 0 || (next && !lunas) ? "text-warn-text" : "text-fg-muted")}>
                            {lunas ? "Lunas" : i.status === "menunggu_verifikasi" ? "Menunggu verifikasi" : i.days_overdue > 0 ? `Telat ${i.days_overdue} hari` : next ? "Berikutnya" : "Belum"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {loan.status === "aktif" && <p className="text-body font-bold text-fg">Sisa {sisa} angsuran · {rupiah(loan.remaining_balance)}</p>}
              </>
            ) : (
              <>
                {loan.payments.length === 0 && <p className="rounded-card bg-card p-5 text-body text-fg-muted">Belum ada pembayaran.</p>}
                <ul className="flex flex-col gap-2">
                  {loan.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-4 rounded-card bg-card px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-bold text-fg">Angsuran ke-{p.sequence}</p>
                        <p className="text-body-sm text-fg-muted">{tanggal(p.paid_at)} · {jam(p.paid_at)} · {METODE[p.method] ?? p.method}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-body font-bold text-fg">{rupiah(p.amount + p.penalty_amount)}</p>
                        <p className={cx("text-body-sm font-bold", p.status === "terverifikasi" ? "text-fg-muted" : "text-warn-text")}>{STATUS_BAYAR[p.status]}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default withFreshState(PinjamanPage, { module: "my_loans" });
