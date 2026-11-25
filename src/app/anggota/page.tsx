"use client";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Badge } from "@/components/ui/Badge";
import { Card, CardLink, StatCard } from "@/components/ui/Card";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { cx } from "@/components/ui/cx";
import { useApi } from "@/lib/api";
import { rupiah, rupiahRingkas, tanggal, tanggalPanjang, tenorLabel, type TenorUnit } from "@/lib/format";

type Next = { id: number; sequence: number; due_date: string; total_amount: number; status: string; loan_number: string; tenor_duration: number; tenor_unit: TenorUnit; days_overdue: number };
type Saya = {
  name: string; member_number: string; principal_savings: number; mandatory_savings: number; voluntary_savings: number; total_savings: number;
  active_loans: number; remaining_balance: number; arrears_amount: number; next_installment: Next | null;
};

function BerandaPage() {
  const { data: d, meta, error, loading, reload } = useApi<Saya, { today: string }>("/api/v1/anggota/saya");
  const n = d?.next_installment;
  return (
    <>
      <PageHeader title={d ? `Halo, ${d.name.split(" ")[0]}` : "Beranda"} subtitle={meta ? `${tanggalPanjang(meta.today)}${d ? ` · No. anggota ${d.member_number}` : ""}` : "Ringkasan pinjaman Anda"} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d ? (
        <Skeleton className="h-64" />
      ) : d && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-6">
          <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
            <section className="flex flex-col gap-2 rounded-card bg-inverse p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-medium text-fg-inverse-muted">Angsuran berikutnya</span>
                {n && n.days_overdue > 0 && <Badge tone="telat">Telat {n.days_overdue} hari</Badge>}
              </div>
              {n ? (
                <>
                  <span className="text-kpi font-bold text-accent">{rupiah(n.total_amount)}</span>
                  <span className="text-body-sm text-fg-inverse-muted">Angsuran ke-{n.sequence} · jatuh tempo {tanggal(n.due_date)}</span>
                  <span className="text-body-sm text-fg-inverse-muted">{n.loan_number} · {tenorLabel(n.tenor_duration, n.tenor_unit)}</span>
                </>
              ) : (
                <span className="text-body text-fg-inverse">Tidak ada angsuran yang berjalan.</span>
              )}
            </section>
            <Card title="Tunggakan" action={<CardLink href="/anggota/pinjaman">Lihat pinjaman</CardLink>} className="flex-1">
              <p className={cx("text-body font-bold", d.arrears_amount > 0 ? "text-warn-text" : "text-fg")}>{d.arrears_amount > 0 ? rupiah(d.arrears_amount) : "Tidak ada tunggakan"}</p>
              <p className="text-body-sm text-fg-muted">{d.arrears_amount > 0 ? "Segera bayar ke petugas atau transfer ke rekening koperasi." : "Terima kasih, angsuran Anda lancar."}</p>
            </Card>
          </div>
          <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
            <StatCard label="Pinjaman aktif" value={d.active_loans} note={d.active_loans ? "sedang berjalan" : "tidak ada"} />
            <StatCard label="Sisa pinjaman" value={rupiahRingkas(d.remaining_balance)} note={rupiah(d.remaining_balance)} />
          </div>
        </div>
      )}
    </>
  );
}

export default withFreshState(BerandaPage, { module: "my_loans" });
