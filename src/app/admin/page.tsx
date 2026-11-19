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

type Dashboard = {
  tanggal: string;
  aktif: { jumlah: number; outstanding: number; anggota: number };
  jatuhTempo: { jumlah: number; nominal: number };
  terbayar: { jumlah: number; nominal: number; dari_jatuh_tempo: number };
  tunggakan: { nominal: number; anggota: number; npl: number | null };
  alur: Record<"data_pinjaman" | "jatuh_tempo" | "pengingat" | "pembayaran" | "verifikasi" | "lunas" | "lanjutan", number>;
  menunggu: { id: number; nominal: number; metode: string; keterangan_metode: string | null; dibayar_pada: string; ke: number; tenor: number; no_pinjaman: string; anggota: string; petugas: string | null }[];
  kinerja: { id: number; nama: string; wilayah: string; tugas: number; selesai: number; terkumpul: number }[];
};

export default function DashboardPage() {
  const { data: d, error, loading, reload } = useApi<Dashboard>("/api/v1/dashboard");
  return (
    <>
      <PageHeader
        title="Dashboard Admin"
        subtitle={d ? `${tanggalPanjang(d.tanggal)}  ·  Ringkasan penagihan hari ini` : "Ringkasan penagihan hari ini"}
        actions={
          <Link href="/admin/pinjaman#baru" className={buttonClass("primary", "lg")}>
            + Pinjaman Baru
          </Link>
        }
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d && <Skeleton className="h-[540px]" />}
      {d && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-6">
            <StatCard label="Total Pinjaman Aktif" value={rupiahRingkas(d.aktif.outstanding)} note={`${angka(d.aktif.jumlah)} pinjaman · ${angka(d.aktif.anggota)} anggota`} />
            <StatCard label="Jatuh Tempo Hari Ini" value={`${d.jatuhTempo.jumlah} angsuran`} note={`Nilai tagihan ${rupiahRingkas(d.jatuhTempo.nominal)}`} />
            <StatCard label="Terbayar Hari Ini" value={rupiahRingkas(d.terbayar.nominal)} note={`${d.terbayar.dari_jatuh_tempo} dari ${d.jatuhTempo.jumlah} angsuran jatuh tempo`}>
              <Progress value={d.jatuhTempo.jumlah ? d.terbayar.dari_jatuh_tempo / d.jatuhTempo.jumlah : 0} />
            </StatCard>
            <StatCard inverse label="Total Tunggakan" value={rupiahRingkas(d.tunggakan.nominal)} note={`NPL ${persen(d.tunggakan.npl ?? 0)} · ${d.tunggakan.anggota} anggota menunggak`} />
          </div>

          <Card title="Alur Penagihan Hari Ini" action={<CardLink href="/admin/jatuh-tempo">Lihat detail</CardLink>}>
            <div className="grid grid-cols-7 gap-3">
              {[
                ["01", "Data Pinjaman", `${d.alur.data_pinjaman} aktif`, "", "/admin/pinjaman"],
                ["02", "Jatuh Tempo", `${d.alur.jatuh_tempo} angsuran`, "", "/admin/jatuh-tempo"],
                ["03", "Pengingat", `${d.alur.pengingat} terkirim`, "", "/admin/pengingat"],
                ["04", "Pembayaran", `${d.alur.pembayaran} sudah bayar`, "accent", "/admin/verifikasi"],
                ["05", "Verifikasi", `${d.alur.verifikasi} menunggu`, "warn", "/admin/verifikasi"],
                ["06", "Saldo / Lanjutan", `${d.alur.lunas} lunas · ${d.alur.lanjutan} tagih`, "", "/admin/jatuh-tempo"],
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
                rows={d.menunggu}
                rowKey={(r) => r.id}
                empty="Tidak ada pembayaran yang menunggu verifikasi"
                rowHeight="h-[62px]"
                columns={[
                  { key: "a", header: "Anggota", render: (r, i) => <CellStack avatar={<Avatar name={r.anggota} size={32} tone={avatarTone(i)} />} title={r.anggota} sub={`${r.petugas ? `via ${r.petugas.split(" ")[0]}` : r.keterangan_metode ?? r.metode} · ${jam(r.dibayar_pada)}`} /> },
                  { key: "n", header: "No. Pinjaman", render: (r) => <span className="font-medium">{r.no_pinjaman}</span> },
                  { key: "k", header: "Angsuran", render: (r) => `${r.ke} / ${r.tenor}` },
                  { key: "r", header: "Nominal", render: (r) => <b>{rupiah(r.nominal)}</b> },
                  { key: "m", header: "Metode", render: (r) => (r.metode === "tunai" ? <Badge tone="sudah-bayar">Tunai</Badge> : <Badge tone="belum-bayar">{r.metode === "qris" ? "QRIS" : "Transfer"}</Badge>) },
                  { key: "x", header: "Aksi", render: (r) => <Link href={`/admin/verifikasi#${r.id}`} className={buttonClass("accent", "sm")}>Verifikasi</Link> },
                ]}
              />
            </Card>

            <Card title="Kinerja Petugas Lapangan">
              <div className="flex flex-col gap-6">
                {d.kinerja.map((p, i) => {
                  const rate = p.tugas ? p.selesai / p.tugas : 0;
                  const low = p.tugas > 0 && rate < 0.65;
                  return (
                    <div key={p.id}>
                      <div className="flex items-start gap-3">
                        <Avatar name={p.nama} tone={avatarTone(i)} />
                        <div className="flex-1">
                          <div className="text-body font-bold">{p.nama}</div>
                          <div className="text-small text-fg-subtle">Wil. {p.wilayah}</div>
                        </div>
                        <b className="text-body-sm">{rupiahRingkas(p.terkumpul)}</b>
                      </div>
                      <Progress value={rate} tone={low ? "warn" : "accent"} className="mt-3" />
                      <div className={cx("mt-2 text-small", low ? "font-medium text-warn-text" : "text-fg-muted")}>
                        {p.selesai} / {p.tugas} tagihan selesai · {persen(rate, 0)}{low ? " · perlu perhatian" : ""}
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
