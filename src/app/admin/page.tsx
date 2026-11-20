"use client";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Card, CardLink, StatCard } from "@/components/ui/Card";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { Progress } from "@/components/ui/Form";
import { CellStack, Table } from "@/components/ui/Table";
import { cx } from "@/components/ui/cx";
import { useApi } from "@/lib/api";
import { angka, jam, persen, rupiah, rupiahRingkas, tanggalPanjang } from "@/lib/format";
import { withFreshState } from "@/components/layout/FreshState";
import { useSession } from "@/lib/session";

type Dashboard = {
  date: string;
  active: { count: number; outstanding: number; members: number };
  due_today: { count: number; amount: number };
  paid_today: { count: number; amount: number; from_due: number };
  arrears: { amount: number; members: number; npl: number | null };
  flow: Record<"active_loans" | "due" | "reminders" | "payments" | "verifications" | "paid_off" | "follow_up", number>;
  pending: { id: number; amount: number; method: string; method_note: string | null; paid_at: string; installment_sequence: number; tenor_duration: number; loan_number: string; member_name: string; collector_name: string | null }[];
  collectors: { id: number; name: string; region_name: string; tasks: number; completed: number; collected: number }[];
};

function DashboardPage() {
  const { can } = useSession();
  const { data: d, error, loading, reload } = useApi<Dashboard>("/api/v1/dashboard");
  return (
    <>
      <PageHeader
        title="Dashboard Admin"
        subtitle={d ? `${tanggalPanjang(d.date)}  ·  Ringkasan penagihan hari ini` : "Ringkasan penagihan hari ini"}
        actions={
          can("loans", "create") && (
            <Link href="/admin/pinjaman/baru" className={buttonClass("primary", "lg")}>
              + Pinjaman Baru
            </Link>
          )
        }
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d && <Skeleton className="h-[540px]" />}
      {d && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-6">
            <StatCard label="Total Pinjaman Aktif" value={rupiahRingkas(d.active.outstanding)} note={`${angka(d.active.count)} pinjaman · ${angka(d.active.members)} anggota`} />
            <StatCard label="Jatuh Tempo Hari Ini" value={`${d.due_today.count} angsuran`} note={`Nilai tagihan ${rupiahRingkas(d.due_today.amount)}`} />
            <StatCard label="Terbayar Hari Ini" value={rupiahRingkas(d.paid_today.amount)} note={`${d.paid_today.from_due} dari ${d.due_today.count} angsuran jatuh tempo`}>
              <Progress value={d.due_today.count ? d.paid_today.from_due / d.due_today.count : 0} />
            </StatCard>
            <StatCard inverse label="Total Tunggakan" value={rupiahRingkas(d.arrears.amount)} note={`NPL ${persen(d.arrears.npl ?? 0)} · ${d.arrears.members} anggota menunggak`} />
          </div>

          <Card title="Alur Penagihan Hari Ini" action={<CardLink href="/admin/jatuh-tempo">Lihat detail</CardLink>}>
            <div className="grid grid-cols-7 gap-3">
              {[
                ["01", "Data Pinjaman", `${d.flow.active_loans} aktif`, "", "/admin/pinjaman"],
                ["02", "Jatuh Tempo", `${d.flow.due} angsuran`, "", "/admin/jatuh-tempo"],
                ["03", "Pengingat", `${d.flow.reminders} terkirim`, "", "/admin/pengingat"],
                ["04", "Pembayaran", `${d.flow.payments} sudah bayar`, "accent", "/admin/verifikasi"],
                ["05", "Verifikasi", `${d.flow.verifications} menunggu`, "warn", "/admin/verifikasi"],
                ["06", "Saldo / Lanjutan", `${d.flow.paid_off} lunas · ${d.flow.follow_up} tagih`, "", "/admin/jatuh-tempo"],
                ["07", "Laporan", "Rekap penagihan", "inverse", "/admin/laporan"],
              ].map(([n, t, s, tone, href]) => (
                <Link
                  key={n}
                  href={href}
                  className={cx(
                    "flex h-[84px] flex-col justify-center gap-1 rounded-ctl px-3.5",
                    tone === "accent" ? "bg-accent" : tone === "warn" ? "border-[1.5px] border-warn bg-card" : tone === "inverse" ? "bg-inverse" : "bg-canvas",
                  )}
                >
                  <span className={cx("text-caption font-bold", tone === "accent" ? "text-on-accent" : tone === "warn" ? "text-warn-text" : tone === "inverse" ? "text-accent" : "text-fg-subtle")}>{n}</span>
                  <span className={cx("text-body-sm font-bold", tone === "inverse" ? "text-fg-inverse" : "text-fg")}>{t}</span>
                  <span className={cx("text-small", tone === "warn" ? "font-bold text-warn-text" : tone === "inverse" ? "text-fg-inverse-muted" : tone === "accent" ? "text-on-accent" : "text-fg-muted")}>{s}</span>
                </Link>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-[1fr_368px] gap-6">
            <Card title="Pembayaran Menunggu Verifikasi" action={<CardLink href="/admin/verifikasi">Lihat semua</CardLink>}>
              <Table
                rows={d.pending}
                rowKey={(r) => r.id}
                empty="Tidak ada pembayaran yang menunggu verifikasi"
                rowHeight="h-[62px]"
                columns={[
                  { key: "a", header: "Anggota", render: (r, i) => <CellStack avatar={<Avatar name={r.member_name} size={32} tone={avatarTone(i)} />} title={r.member_name} sub={`${r.collector_name ? `via ${r.collector_name.split(" ")[0]}` : r.method_note ?? r.method} · ${jam(r.paid_at)}`} /> },
                  { key: "n", header: "No. Pinjaman", render: (r) => <span className="font-medium">{r.loan_number}</span> },
                  { key: "k", header: "Angsuran", render: (r) => `${r.installment_sequence} / ${r.tenor_duration}` },
                  { key: "r", header: "Nominal", render: (r) => <b>{rupiah(r.amount)}</b> },
                  { key: "m", header: "Metode", render: (r) => (r.method === "tunai" ? <Badge tone="sudah-bayar">Tunai</Badge> : <Badge tone="belum-bayar">{r.method === "qris" ? "QRIS" : "Transfer"}</Badge>) },
                  { key: "x", header: "Aksi", render: (r) => can("payments", "update") ? <Link href={`/admin/verifikasi#${r.id}`} className={buttonClass("accent", "sm")}>Verifikasi</Link> : <span className="text-fg-subtle">—</span> },
                ]}
              />
            </Card>

            <Card title="Kinerja Petugas Lapangan">
              <div className="flex flex-col gap-6">
                {d.collectors.map((p, i) => {
                  const rate = p.tasks ? p.completed / p.tasks : 0;
                  const low = p.tasks > 0 && rate < 0.65;
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
                      <Progress value={rate} tone={low ? "warn" : "accent"} className="mt-3" />
                      <div className={cx("mt-2 text-small", low ? "font-medium text-warn-text" : "text-fg-muted")}>
                        {p.completed} / {p.tasks} tagihan selesai · {persen(rate, 0)}{low ? " · perlu perhatian" : ""}
                      </div>
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

export default withFreshState(DashboardPage, { module: "dashboard" });
