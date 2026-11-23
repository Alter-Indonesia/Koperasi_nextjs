"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { StatCard } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { cx } from "@/components/ui/cx";
import { useApi } from "@/lib/api";
import { bulanTahun, rupiah, tanggal, tanggalPendek } from "@/lib/format";

type Inst = { id: number; sequence: number; due_date: string; total_amount: number; status: "belum" | "menunggu_verifikasi" | "lunas"; days_overdue: number };
type Loan = { id: number; loan_number: string; status: string; installments: Inst[] };
type Row = Inst & { loan_number: string };
type Filter = "belum" | "lunas" | "semua";

function JadwalPage() {
  const { data, error, loading, reload } = useApi<Loan[]>("/api/v1/anggota/saya/pinjaman");
  const [filter, setFilter] = useState<Filter>("belum");

  // semua angsuran dari semua pinjaman, urut tanggal jatuh tempo
  const semua: Row[] = (data ?? []).flatMap((l) => l.installments.map((i) => ({ ...i, loan_number: l.loan_number }))).sort((a, b) => a.due_date.localeCompare(b.due_date) || a.sequence - b.sequence);
  const belum = semua.filter((i) => i.status !== "lunas");
  const telat = belum.filter((i) => i.days_overdue > 0);
  const berikutnya = belum[0];
  const tampil = filter === "belum" ? belum : filter === "lunas" ? semua.filter((i) => i.status === "lunas") : semua;

  // kelompokkan per bulan jatuh tempo
  const grup: { bulan: string; rows: Row[] }[] = [];
  for (const r of tampil) {
    const bulan = bulanTahun(r.due_date);
    const last = grup[grup.length - 1];
    if (last?.bulan === bulan) last.rows.push(r);
    else grup.push({ bulan, rows: [r] });
  }

  return (
    <>
      <PageHeader title="Jadwal Angsuran" subtitle="Tanggal jatuh tempo semua pinjaman Anda" />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : data && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 lg:grid-cols-[minmax(0,1fr)] lg:gap-6">
            <StatCard
              inverse
              label="Sisa angsuran"
              value={belum.length}
              note={belum.length ? `${rupiah(belum.reduce((s, i) => s + i.total_amount, 0))} belum dibayar` : "Semua angsuran lunas"}
            />
            <StatCard
              label={telat.length ? "Angsuran telat" : "Jatuh tempo berikutnya"}
              value={telat.length ? telat.length : berikutnya ? tanggalPendek(berikutnya.due_date) : "-"}
              note={telat.length ? `${rupiah(telat.reduce((s, i) => s + i.total_amount, 0))} harus segera dibayar` : berikutnya ? rupiah(berikutnya.total_amount) : "Tidak ada tagihan"}
              noteTone={telat.length ? "warn" : undefined}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="overflow-x-auto">
              <ChipGroup<Filter>
                value={filter}
                onChange={setFilter}
                options={[{ value: "belum", label: `Belum lunas · ${belum.length}` }, { value: "lunas", label: `Lunas · ${semua.length - belum.length}` }, { value: "semua", label: "Semua" }]}
              />
            </div>
            {grup.length === 0 && <p className="rounded-card bg-card p-5 text-body text-fg-muted">{filter === "lunas" ? "Belum ada angsuran yang lunas." : "Tidak ada angsuran."}</p>}
            {grup.map((g) => (
              <section key={g.bulan} className="flex flex-col gap-2">
                <h2 className="text-body-sm font-bold uppercase tracking-[0.5px] text-fg-muted">{g.bulan}</h2>
                <ul className="flex flex-col gap-2">
                  {g.rows.map((i) => {
                    const lunas = i.status === "lunas";
                    const next = i.id === berikutnya?.id;
                    return (
                      <li key={`${i.loan_number}-${i.id}`} className={cx("flex items-center gap-4 rounded-card bg-card px-4 py-3", next && "border-2 border-fg")}>
                        <div className={cx("flex size-12 shrink-0 flex-col items-center justify-center rounded-ctl leading-tight", next ? "bg-accent text-on-accent" : "bg-canvas text-fg")} aria-label={tanggal(i.due_date)}>
                          <span className="text-title font-bold">{i.due_date.slice(8, 10).replace(/^0/, "")}</span>
                          <span className="text-caption font-bold uppercase">{tanggalPendek(i.due_date).split(" ")[1]}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cx("text-body font-bold", lunas ? "text-fg-muted" : "text-fg")}>Angsuran ke-{i.sequence}</p>
                          <p className="truncate text-body-sm text-fg-muted">{i.loan_number}</p>
                        </div>
                        <div className="text-right">
                          <p className={cx("text-body font-bold", lunas ? "text-fg-muted" : "text-fg")}>{rupiah(i.total_amount)}</p>
                          <p className={cx("text-body-sm font-bold", !lunas && (i.days_overdue > 0 || next) ? "text-warn-text" : "text-fg-muted")}>
                            {lunas ? "Lunas" : i.status === "menunggu_verifikasi" ? "Menunggu verifikasi" : i.days_overdue > 0 ? `Telat ${i.days_overdue} hari` : next ? "Berikutnya" : "Belum"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default withFreshState(JadwalPage, { module: "my_loans" });
