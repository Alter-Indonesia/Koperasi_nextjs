"use client";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Card, CardLink, StatCard } from "@/components/ui/Card";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { Progress } from "@/components/ui/Form";
import { CellStack, Table } from "@/components/ui/Table";
import { useApi } from "@/lib/api";
import { angka, persen, rupiah, rupiahRingkas, tanggalPanjang } from "@/lib/format";
import { useSession } from "@/lib/session";

type Dashboard = {
  date: string;
  active: { count: number; outstanding: number; members: number };
  paid_today: { count: number; amount: number };
  arrears: { amount: number; members: number; npl: number | null };
  collectors: { id: number; name: string; region_name: string; tasks: number; completed: number; collected: number }[];
};
type Approval = { id: number; loan_number: string; member_name: string; region_name: string; principal_amount: number; tenor_months: number; purpose: string | null };
type ApprovalMeta = { summary: { pending: number; pending_amount: number } };

export default function OwnerDashboard() {
  const { can } = useSession();
  const dash = useApi<Dashboard>(can("dashboard") ? "/api/v1/dashboard" : null);
  const appr = useApi<Approval[], ApprovalMeta>(can("loan_approvals") ? "/api/v1/persetujuan" : null);
  const d = dash.data;
  const s = appr.meta?.summary;
  return (
    <>
      <PageHeader title="Dashboard Owner" subtitle={d ? `${tanggalPanjang(d.date)}  ·  Ringkasan portofolio koperasi` : "Ringkasan portofolio koperasi"} />
      {dash.error && <ErrorBox message={dash.error} onRetry={dash.reload} />}
      {dash.loading && !d && <Skeleton className="h-[480px]" />}
      {d && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-6">
            <StatCard tone="accent" label="Total Pinjaman Aktif" value={rupiahRingkas(d.active.outstanding)} note={`${angka(d.active.count)} pinjaman · ${angka(d.active.members)} anggota`} />
            <StatCard inverse label="Menunggu Persetujuan" value={s ? angka(s.pending) : "…"} note={s ? `Nilai ${rupiahRingkas(s.pending_amount)}` : undefined} />
            <StatCard tone="warn" label="Total Tunggakan" value={rupiahRingkas(d.arrears.amount)} note={`NPL ${persen(d.arrears.npl ?? 0)} · ${d.arrears.members} anggota menunggak`} />
            <StatCard label="Terbayar Hari Ini" value={rupiahRingkas(d.paid_today.amount)} note={`${d.paid_today.count} pembayaran`} />
          </div>
          <div className="grid grid-cols-[1fr_368px] gap-6">
            <Card title="Pengajuan Menunggu Persetujuan" action={<CardLink href="/owner/persetujuan">Lihat semua</CardLink>}>
              <Table
                rows={(appr.data ?? []).slice(0, 5)}
                rowKey={(r) => r.id}
                empty="Tidak ada pengajuan yang menunggu"
                rowHeight="h-[62px]"
                columns={[
                  { key: "a", header: "Anggota", render: (r, i) => <CellStack avatar={<Avatar name={r.member_name} size={32} tone={avatarTone(i)} />} title={r.member_name} sub={`${r.loan_number} · ${r.region_name}`} /> },
                  { key: "p", header: "Plafon", render: (r) => <b>{rupiah(r.principal_amount)}</b> },
                  { key: "t", header: "Tenor", render: (r) => `${r.tenor_months} bln` },
                  { key: "x", header: "", render: (r) => <Link href={`/owner/persetujuan/${r.id}`} className="font-bold text-warn-text hover:underline">Tinjau →</Link> },
                ]}
              />
            </Card>
            <Card title="Kinerja Petugas Lapangan">
              <div className="flex flex-col gap-6">
                {d.collectors.map((p, i) => {
                  const rate = p.tasks ? p.completed / p.tasks : 0;
                  return (
                    <div key={p.id}>
                      <div className="flex items-start gap-3">
                        <Avatar name={p.name} tone={avatarTone(i)} />
                        <div className="flex-1">
                          <div className="text-body font-bold">{p.name}</div>
                          <div className="text-small text-fg-subtle">Wil. {p.region_name}</div>
                        </div>
                        <b className="text-body-sm">{rupiahRingkas(p.collected)}</b>
                      </div>
                      <Progress value={rate} tone={p.tasks > 0 && rate < 0.65 ? "warn" : "accent"} className="mt-3" />
                      <div className="mt-2 text-small text-fg-muted">{p.completed} / {p.tasks} tagihan selesai · {persen(rate, 0)}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
