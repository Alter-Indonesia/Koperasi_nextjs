"use client";
import { Mail, MessageCircle, MessageSquare, Phone, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { Textarea, Toggle } from "@/components/ui/Form";
import { cx } from "@/components/ui/cx";
import { api, ApiError, useApi } from "@/lib/api";
import { jam } from "@/lib/format";

type Data = {
  channels: { code: string; name: string; description: string; is_active: boolean }[];
  rules: { id: number; day_offset: number; title: string; description: string }[];
  templates: { code: string; channel: string; body: string }[];
  stats: { sent: number; read: number; failed: number };
  logs: { id: number; channel: string; status: string; sent_at: string; notes: string | null; member_name: string }[];
};
const IKON: Record<string, [LucideIcon, string]> = {
  whatsapp: [MessageCircle, "bg-accent text-on-accent"],
  sms: [MessageSquare, "bg-inverse text-fg-inverse"],
  telepon: [Phone, "bg-warn text-on-warn"],
  surat: [Mail, "bg-fg-muted text-fg-inverse"],
};
const LABEL: Record<string, string> = { "H-3": "H-3", "H-1": "H-1", HARI_H: "Hari H", TELAT: "Telat" };
const hari = (o: number) => (o === 0 ? "Hari H" : o < 0 ? `H${o}` : `H+${o}`);
const contoh: Record<string, string> = { "{nama}": "Siti Aminah", "{angsuran_ke}": "9", "{no_pinjaman}": "PJ-24-0187", "{nominal}": "Rp 1.250.000", "{jatuh_tempo}": "25 Nov 2026" };

export default function PengingatPage() {
  const { data, error, loading, reload } = useApi<Data>("/api/v1/pengingat");
  const [tpl, setTpl] = useState("H-3");
  const [draft, setDraft] = useState<string | null>(null); // null = tidak sedang mengubah
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const cur = data?.templates.find((t) => t.code === tpl);
  const edit = draft !== null;
  const isi = draft ?? cur?.body ?? "";

  async function ubahSaluran(kode: string, isActive: boolean) {
    try {
      await api.patch(`/api/v1/pengingat/saluran/${kode}`, { is_active: isActive });
      reload();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal menyimpan", t: "warn" });
    }
  }
  async function simpanTemplate() {
    try {
      await api.put(`/api/v1/pengingat/template/${tpl}`, { body: isi });
      setDraft(null);
      setToast({ m: `Template ${LABEL[tpl]} disimpan`, t: "ok" });
      reload();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal menyimpan", t: "warn" });
    }
  }
  const pratinjau = Object.entries(contoh).reduce((s, [k, v]) => s.replaceAll(k, v), isi);

  return (
    <>
      <PageHeader title="Pengingat Tagihan" subtitle="Notifikasi otomatis lewat WhatsApp, SMS, telepon, dan surat" />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-[800px]" />}
      {data && (
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <Card title="Saluran Notifikasi">
              <ul>
                {data.channels.map((s, i) => {
                  const [Icon, tone] = IKON[s.code];
                  return (
                    <li key={s.code} className={cx("flex items-center gap-4 py-4", i < data.channels.length - 1 && "border-b border-line-subtle")}>
                      <span className={cx("flex size-10 items-center justify-center rounded-ctl", tone)}><Icon size={16} strokeWidth={1.5} /></span>
                      <div className="flex-1">
                        <div className="text-body font-bold">{s.name}</div>
                        <div className="text-small text-fg-muted">{s.description}</div>
                      </div>
                      <Toggle on={s.is_active} label={`Aktifkan ${s.name}`} onChange={(v) => ubahSaluran(s.code, v)} />
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Aturan Jadwal Otomatis">
              <ul className="flex flex-col gap-4">
                {data.rules.map((a) => (
                  <li key={a.id} className="flex items-center gap-4">
                    <span className={cx("w-16 rounded-pill py-1.5 text-center text-small font-bold", a.day_offset > 0 ? "bg-warn text-on-warn" : "bg-inverse text-accent")}>{hari(a.day_offset)}</span>
                    <div>
                      <div className="text-body font-bold">{a.title}</div>
                      <div className="text-small text-fg-muted">{a.description}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="flex flex-col gap-6">
            <Card title="Template Pesan WhatsApp">
              <ChipGroup value={tpl} onChange={(v) => { setTpl(v); setDraft(null); }} options={data.templates.map((t) => ({ value: t.code, label: LABEL[t.code] ?? t.code }))} />
              <div className="mt-4 rounded-[12px] bg-canvas p-5">
                {edit ? (
                  <Textarea className="min-h-[200px]" value={isi} onChange={(e) => setDraft(e.target.value)} />
                ) : (
                  <div className="max-w-[420px] rounded-[12px] bg-card p-4">
                    <p className="whitespace-pre-line text-body-sm leading-[19px]">{pratinjau}</p>
                    <p className="mt-2 text-right text-caption text-fg-subtle">08.00 ✓✓</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-small font-bold text-fg-muted">Variabel:</span>
                  {Object.keys(contoh).map((v) => <span key={v} className="rounded-pill border border-line bg-card px-3 py-1 text-caption">{v}</span>)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-small text-fg-muted">{edit ? "Gunakan variabel di atas; nilainya diisi otomatis saat dikirim." : "Pratinjau untuk: Siti Aminah · PJ-24-0187"}</span>
                {edit ? (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDraft(null)}>Batal</Button>
                    <Button onClick={simpanTemplate}>Simpan Template</Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setDraft(cur?.body ?? "")}>Ubah Template</Button>
                )}
              </div>
            </Card>
            <Card title="Log Pengiriman Hari Ini">
              <div className="grid grid-cols-3 gap-3">
                {[["Terkirim", data.stats.sent], ["Dibaca", data.stats.read], ["Gagal", data.stats.failed]].map(([l, v], i) => (
                  <div key={l} className="rounded-ctl bg-canvas px-4 py-3">
                    <div className="text-small text-fg-muted">{l}</div>
                    <div className={cx("text-mobile font-bold", i === 2 && "text-warn-text")}>{v}</div>
                  </div>
                ))}
              </div>
              <ul className="mt-4">
                {data.logs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-body-sm font-bold">{l.member_name}</div>
                      <div className="text-caption text-fg-subtle">{l.channel === "sms" ? "SMS" : "WhatsApp"} · {jam(l.sent_at)}</div>
                    </div>
                    {l.status === "gagal" ? <Badge tone="warn-outline">Gagal{l.notes ? ` — ${l.notes.toLowerCase()}` : ""}</Badge> : <span className="text-small font-bold text-fg-muted">{l.status === "dibaca" ? "Dibaca" : "Terkirim"}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}
