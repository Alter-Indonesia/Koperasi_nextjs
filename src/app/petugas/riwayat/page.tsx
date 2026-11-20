"use client";
import { Check } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Modal, Skeleton, Toast } from "@/components/ui/Feedback";
import { api, ApiError, useApi } from "@/lib/api";
import { jam, rupiah, tanggalPanjang, tanggalPendek } from "@/lib/format";
import { useSession } from "@/lib/session";

type Pay = { id: number; amount: number; method: string; paid_at: string; deposit_id: number | null; member_name: string };
type Deposit = { id: number; deposited_on: string; amount: number; payment_count: number; status: "menunggu" | "cocok" | "selisih"; received_by_name: string | null };
type Data = { cash_on_hand: { amount: number; count: number }; non_cash: { amount: number; count: number }; today: Pay[]; deposits: Deposit[] };
const METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS" };
const STATUS: Record<Deposit["status"], string> = { menunggu: "Menunggu kasir", cocok: "Cocok", selisih: "Selisih" };

function SetoranPage() {
  const { can } = useSession();
  const { data, meta, error, loading, reload } = useApi<Data, { date: string; deadline: string }>("/api/v1/petugas/setoran");
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const tangan = data?.cash_on_hand;

  async function setor() {
    setBusy(true);
    try {
      const r = await api.post<{ amount: number }>("/api/v1/petugas/setoran", {});
      setToast({ m: `Setoran ${rupiah(r.data.amount)} tercatat · menunggu dicocokkan kasir`, t: "ok" });
      setKonfirmasi(false);
      reload();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal menyetor", t: "warn" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Setoran Kas" subtitle={meta ? tanggalPanjang(meta.date) : "Uang tunai yang Anda pegang dan riwayat setoran"} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : data && (
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2 rounded-card bg-inverse p-5">
              <span className="text-body-sm font-medium text-fg-inverse-muted">Uang tunai yang Anda pegang</span>
              <span className="text-kpi font-bold text-accent">{rupiah(tangan?.amount)}</span>
              <span className="text-small text-fg-inverse-muted">dari {tangan?.count ?? 0} pembayaran tunai</span>
              <div className="mt-2 flex items-center gap-4">
                {can("my_deposits", "create") && <Button variant="accent" size="lg" disabled={!tangan?.count} onClick={() => setKonfirmasi(true)}>Setor ke Kasir</Button>}
                <span className="text-body-sm font-bold text-fg-inverse">Batas setor {meta?.deadline}</span>
              </div>
            </section>
            <Card>
              <p className="text-body-sm text-fg-muted">Transfer & QRIS (langsung ke rekening)</p>
              <p className="mt-1 text-title font-bold text-fg">{rupiah(data.non_cash.amount)} · {data.non_cash.count} transaksi</p>
            </Card>
            <Card title="Rincian Hari Ini">
              {data.today.length === 0 ? (
                <p className="py-6 text-center text-body-sm text-fg-muted">Belum ada pembayaran hari ini</p>
              ) : (
                <ul>
                  {data.today.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-4 border-b border-line-subtle py-3 last:border-b-0">
                      <div>
                        <p className="text-body font-bold text-fg">{p.member_name}</p>
                        <p className="text-body-sm text-fg-subtle">{jam(p.paid_at)} · {METODE[p.method] ?? p.method}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-body font-bold text-fg">{rupiah(p.amount)}</p>
                        <p className="text-small text-fg-muted">{p.method !== "tunai" ? "masuk rekening" : p.deposit_id ? "sudah disetor" : <span className="text-warn-text">di tangan</span>}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card title="Riwayat Setoran">
            {data.deposits.length === 0 ? (
              <p className="py-6 text-center text-body-sm text-fg-muted">Belum ada riwayat setoran</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.deposits.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-4 rounded-ctl bg-canvas px-4 py-3">
                    <div>
                      <p className="text-body font-bold text-fg">{tanggalPendek(d.deposited_on)}</p>
                      <p className="text-body-sm text-fg-muted">{d.received_by_name ? `Diterima kasir · ${d.received_by_name}` : `${d.payment_count} pembayaran`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-body font-bold text-fg">{rupiah(d.amount)}</p>
                      <p className={d.status === "selisih" ? "text-small font-bold text-warn-text" : "text-small font-bold text-fg-muted"}>
                        {d.status === "cocok" && <Check size={12} strokeWidth={2} className="mr-1 inline" />}{STATUS[d.status]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      <Modal
        open={konfirmasi}
        title="Setor ke kasir?"
        onClose={() => setKonfirmasi(false)}
        footer={<><Button variant="outline" onClick={() => setKonfirmasi(false)}>Batal</Button><Button variant="accent" disabled={busy} onClick={setor}>Ya, setor</Button></>}
      >
        <p className="text-body-sm text-fg-muted">Seluruh uang tunai {rupiah(tangan?.amount)} dari {tangan?.count} pembayaran dicatat sebagai setoran dan menunggu dicocokkan kasir.</p>
      </Modal>
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}

export default withFreshState(SetoranPage, { module: "my_deposits" });
