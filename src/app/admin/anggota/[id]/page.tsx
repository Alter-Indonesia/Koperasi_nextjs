"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KolBadge, type Kolektibilitas } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Modal, Skeleton, Toast } from "@/components/ui/Feedback";
import { Table } from "@/components/ui/Table";
import { api, ApiError, useApi, useHash } from "@/lib/api";
import { jam, rupiah, tanggal } from "@/lib/format";
import { FormAnggota, type Initial, type Payload, type Region } from "../FormAnggota";
import { withFreshState } from "@/components/layout/FreshState";
import { useSession } from "@/lib/session";

type Detail = Initial & {
  id: number; member_number: string; region_name: string; joined_on: string;
  created_at: string; updated_at: string; created_by_name: string | null; updated_by_name: string | null;
  loans: { id: number; loan_number: string; loan_amount: number; tenor_duration: number; status: string; remaining_balance: number; collectibility: Kolektibilitas }[];
};

const time = (t: string) => `${tanggal(t)}, ${jam(t)}`;

function DetailAnggotaPage({ params }: PageProps<"/admin/anggota/[id]">) {
  const { can } = useSession();
  const { id } = use(params);
  const router = useRouter();
  const { data: d, error, loading, reload } = useApi<Detail>(`/api/v1/anggota/${id}`);
  const { data: regions } = useApi<Region[]>("/api/v1/wilayah");
  const [edit, setEdit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // setelah membuat anggota baru, halaman ini dibuka dengan #dibuat
  const hash = useHash();
  const [hashClosed, setHashClosed] = useState(false);
  const hashMessage = hashClosed ? null : hash === "dibuat" ? "Anggota berhasil disimpan" : hash === "dibuat-foto-gagal" ? "Anggota disimpan, tetapi foto KTP gagal diunggah. Unggah ulang lewat Edit." : null;

  async function save(p: Payload, photo: File | null) {
    await api.patch(`/api/v1/anggota/${id}`, p);
    let message = "Perubahan disimpan";
    if (photo) {
      try {
        await api.upload(`/api/v1/anggota/${id}/ktp`, "foto", photo);
      } catch {
        message = "Perubahan disimpan, tetapi foto KTP gagal diunggah";
      }
    }
    setEdit(false);
    setToast(message);
    reload();
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/v1/anggota/${id}`);
      router.push("/admin/anggota#dihapus");
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Gagal menghapus");
      setDeleting(false);
    }
  }

  return (
    <>
      <Link href="/admin/anggota" className="mb-3 inline-block text-body-sm font-medium text-fg-muted hover:text-fg">← Data Anggota</Link>
      <PageHeader
        title={d ? d.name : "Detail Anggota"}
        subtitle={d ? `${d.member_number}  ·  ${d.region_name}  ·  bergabung ${tanggal(d.joined_on)}${edit ? "  ·  mode ubah" : ""}` : "Memuat…"}
        actions={
          d && !edit ? (
            <>
              {can("members", "update") && <Button variant="outline" size="lg" onClick={() => setEdit(true)}>Edit</Button>}
              {can("members", "delete") && <Button variant="danger" size="lg" onClick={() => { setDeleteError(null); setConfirming(true); }}>Hapus</Button>}
            </>
          ) : undefined
        }
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {(loading && !d) || (d && !regions) ? <Skeleton className="h-[480px]" /> : null}
      {d && regions && (
        <FormAnggota
          key={`${edit ? "edit" : "lihat"}-${d.updated_at}`}
          mode={edit ? "edit" : "lihat"}
          regions={regions}
          initial={d}
          memberId={d.id}
          onSubmit={save}
          onCancel={() => setEdit(false)}
        >
          <Card title="Riwayat Data">
            <dl className="flex flex-col gap-3 text-body-sm">
              <div><dt className="text-fg-muted">Dibuat</dt><dd className="font-medium">{time(d.created_at)}{d.created_by_name ? ` · ${d.created_by_name}` : ""}</dd></div>
              <div><dt className="text-fg-muted">Terakhir diubah</dt><dd className="font-medium">{time(d.updated_at)}{d.updated_by_name ? ` · ${d.updated_by_name}` : ""}</dd></div>
            </dl>
          </Card>
          <Card title="Pinjaman">
            <Table
              rows={d.loans}
              rowKey={(r) => r.id}
              rowHeight="h-12"
              empty="Belum ada pinjaman"
              columns={[
                { key: "no", header: "No.", render: (r) => <Link href={`/admin/pinjaman/${r.id}`} className="font-medium hover:underline">{r.loan_number}</Link> },
                { key: "pl", header: "Pinjaman", render: (r) => rupiah(r.loan_amount) },
                { key: "kl", header: "Status", render: (r) => (r.status === "aktif" ? <KolBadge value={r.collectibility} /> : <span className="capitalize text-fg-muted">{r.status}</span>) },
              ]}
            />
          </Card>
        </FormAnggota>
      )}
      <Modal
        open={confirming}
        title="Hapus anggota?"
        onClose={() => !deleting && setConfirming(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>Batal</Button>
            <Button variant="danger" onClick={remove} disabled={deleting}>{deleting ? "Menghapus…" : "Ya, hapus"}</Button>
          </>
        }
      >
        <p className="text-body-sm text-fg-muted">
          <b className="text-fg">{d?.name}</b> ({d?.member_number}) akan dihapus dari daftar anggota. Data tetap tersimpan di basis data (soft delete) dan tidak muncul lagi di aplikasi.
        </p>
        {deleteError && <span className="text-small font-medium text-warn-text">{deleteError}</span>}
      </Modal>
      <Toast message={toast ?? hashMessage} onClose={() => (toast ? setToast(null) : setHashClosed(true))} />
    </>
  );
}

export default withFreshState(DetailAnggotaPage, { module: "members" });
