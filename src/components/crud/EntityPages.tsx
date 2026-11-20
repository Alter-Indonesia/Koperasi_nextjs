"use client";
import { Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Modal, Skeleton, Toast } from "@/components/ui/Feedback";
import { api, ApiError, useApi, useHash } from "@/lib/api";
import { jam, tanggal } from "@/lib/format";
import type { Module } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import { EntityForm, type FieldDef, type Values } from "./EntityForm";

type Audit = { created_at?: string; updated_at?: string; created_by_name?: string | null; updated_by_name?: string | null };
const time = (t: string) => `${tanggal(t)}, ${jam(t)}`;

/** Tautan ikon mata di kolom "Detail" pada tabel daftar. */
export function DetailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={`Lihat detail ${label}`} title="Lihat detail" className="inline-flex size-8 items-center justify-center rounded-chip border border-line text-fg-muted hover:border-fg hover:text-fg">
      <Eye size={16} strokeWidth={1.5} />
    </Link>
  );
}

export const BackLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="mb-3 inline-block text-body-sm font-medium text-fg-muted hover:text-fg">← {children}</Link>
);

/** Kartu riwayat dibuat/diubah (jejak audit). */
export function AuditCard({ d }: { d: Audit }) {
  if (!d.created_at) return null;
  return (
    <Card title="Riwayat Data">
      <dl className="flex flex-col gap-3 text-body-sm">
        <div><dt className="text-fg-muted">Dibuat</dt><dd className="font-medium">{time(d.created_at)}{d.created_by_name ? ` · ${d.created_by_name}` : ""}</dd></div>
        {d.updated_at && <div><dt className="text-fg-muted">Terakhir diubah</dt><dd className="font-medium">{time(d.updated_at)}{d.updated_by_name ? ` · ${d.updated_by_name}` : ""}</dd></div>}
      </dl>
    </Card>
  );
}

/** Halaman "Tambah …": form penuh (bukan modal). Setelah simpan → halaman detail dengan toast. */
export function EntityNewPage({
  heading, subtitle, listHref, listLabel, apiPath, fields, initial, toPayload, loading = false, formTitle,
}: {
  heading: string; subtitle?: string; listHref: string; listLabel: string; apiPath: string; fields: FieldDef[]; initial: Values;
  toPayload: (v: Values) => Record<string, unknown>; loading?: boolean; formTitle: string;
}) {
  const router = useRouter();
  async function save(v: Values) {
    const r = await api.post<{ id: number }>(apiPath, toPayload(v));
    router.push(`${listHref}/${r.data.id}#dibuat`);
  }
  return (
    <>
      <BackLink href={listHref}>{listLabel}</BackLink>
      <PageHeader title={heading} subtitle={subtitle} />
      {loading ? <Skeleton className="h-[320px]" /> : <EntityForm title={formTitle} mode="baru" fields={fields} initial={initial} onSubmit={save} onCancel={() => router.push(listHref)} />}
    </>
  );
}

/**
 * Halaman detail: mode lihat dengan tombol Edit & Hapus; mode edit membuka kolom + tombol Simpan di bawah.
 * `extra` = kartu tambahan di kolom kanan (mis. matriks hak akses).
 */
export function EntityDetailPage<T extends Audit & { id: number }>({
  params, module, heading, subtitle, listHref, listLabel, apiPath, fields, toValues, toPayload, formTitle, deleteWarning, canDelete = () => true, canEdit = () => true, extra, loadingExtra = false, readOnly = false, hideAudit = false, afterSave,
}: {
  params: Promise<{ id: string }>;
  module?: Module; // modul hak akses: tombol Edit/Hapus hanya tampil bila role punya hak ubah/hapus modul ini
  heading: (r: T) => string;
  subtitle?: (r: T) => string;
  listHref: string; listLabel: string; apiPath: string; fields: FieldDef[]; formTitle: string;
  toValues: (r: T) => Values;
  toPayload: (v: Values) => Record<string, unknown>;
  deleteWarning?: (r: T) => string;
  canDelete?: (r: T) => boolean;
  canEdit?: (r: T) => boolean;
  extra?: (r: T, edit: boolean) => React.ReactNode;
  loadingExtra?: boolean;
  readOnly?: boolean; // halaman hanya baca (mis. log aktivitas): tanpa tombol Edit/Hapus
  hideAudit?: boolean;
  afterSave?: (v: Values) => Promise<void>; // dipanggil setelah PATCH berhasil (mis. menyimpan matriks hak akses)
}) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useSession();
  const { data: d, error, loading, reload } = useApi<T>(`${apiPath}/${id}`);
  const [edit, setEdit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hash = useHash();
  const [hashClosed, setHashClosed] = useState(false);
  const hashMessage = hashClosed || hash !== "dibuat" ? null : "Data berhasil disimpan";

  async function save(v: Values) {
    await api.patch(`${apiPath}/${id}`, toPayload(v));
    await afterSave?.(v);
    setEdit(false);
    setToast("Perubahan disimpan");
    reload();
  }
  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`${apiPath}/${id}`);
      router.push(`${listHref}#dihapus`);
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Gagal menghapus");
      setDeleting(false);
    }
  }

  return (
    <>
      <BackLink href={listHref}>{listLabel}</BackLink>
      <PageHeader
        title={d ? heading(d) : "Memuat…"}
        subtitle={d ? `${subtitle?.(d) ?? ""}${edit ? `${subtitle ? "  ·  " : ""}mode ubah` : ""}` : undefined}
        actions={
          d && !edit && !readOnly ? (
            <>
              {(!module || can(module, "update")) && canEdit(d) && <Button variant="outline" size="lg" onClick={() => setEdit(true)}>Edit</Button>}
              {(!module || can(module, "delete")) && canDelete(d) && <Button variant="danger" size="lg" onClick={() => { setDeleteError(null); setConfirming(true); }}>Hapus</Button>}
            </>
          ) : undefined
        }
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {(loading && !d) || loadingExtra ? <Skeleton className="h-[320px]" /> : null}
      {d && !loadingExtra && (
        <EntityForm key={`${edit ? "edit" : "lihat"}-${d.updated_at}`} title={formTitle} mode={edit ? "edit" : "lihat"} fields={fields} initial={toValues(d)} onSubmit={save} onCancel={() => setEdit(false)}>
          {!hideAudit && <AuditCard d={d} />}
          {extra?.(d, edit)}
        </EntityForm>
      )}
      <Modal
        open={confirming}
        title="Hapus data?"
        onClose={() => !deleting && setConfirming(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>Batal</Button>
            <Button variant="danger" onClick={remove} disabled={deleting}>{deleting ? "Menghapus…" : "Ya, hapus"}</Button>
          </>
        }
      >
        <p className="text-body-sm text-fg-muted">{d && deleteWarning ? deleteWarning(d) : "Data akan dihapus dari aplikasi (soft delete: tetap tersimpan di basis data)."}</p>
        {deleteError && <span className="text-small font-medium text-warn-text">{deleteError}</span>}
      </Modal>
      <Toast message={toast ?? hashMessage} onClose={() => (toast ? setToast(null) : setHashClosed(true))} />
    </>
  );
}
