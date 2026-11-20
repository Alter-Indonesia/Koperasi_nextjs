"use client";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, type ComponentType } from "react";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import type { Action, Module } from "@/lib/permissions";
import { MODULES } from "@/lib/permissions";
import { useSession } from "@/lib/session";

/** Pesan pengganti halaman bila role tidak punya hak (penjagaan sebenarnya tetap di API). */
export function NoAccess({ module, action = "view" }: { module: Module; action?: Action }) {
  const { area } = useSession();
  const label = MODULES.find((m) => m.code === module)?.label ?? module;
  return (
    <Card>
      <div className="mx-auto flex max-w-[460px] flex-col items-center gap-3 py-12 text-center">
        <Lock size={32} strokeWidth={1.5} className="text-fg-subtle" />
        <h2 className="text-title font-bold text-fg">Anda tidak punya akses ke halaman ini</h2>
        <p className="text-body-sm text-fg-muted">
          Halaman ini memerlukan hak {action === "view" ? "lihat" : action === "create" ? "tambah" : "ubah"} pada modul {label}. Hubungi Owner bila Anda membutuhkannya.
        </p>
        <Link href={area ? `/${area}` : "/"} className={buttonClass("outline", "md")}>Kembali ke beranda</Link>
      </div>
    </Card>
  );
}

/**
 * Pembungkus setiap page.tsx client:
 * - Next 16 (Cache Components) tidak membongkar halaman yang ditinggalkan, melainkan menyembunyikannya dengan React Activity
 *   sehingga state-nya (modal terbuka, filter, isian form) muncul lagi saat kembali. `router.bfcacheId` dipakai sebagai key:
 *   pindah halaman lewat menu/tautan/router.push → halaman mulai bersih; tombol Back/Forward browser tetap memulihkannya.
 * - `access`: halaman hanya dirender bila role punya hak itu (default aksi `view`); selain itu tampil <NoAccess> dan tidak ada
 *   permintaan API yang dikirim. Gunakan `create` untuk halaman form tambah.
 *
 * Pakai: `export default withFreshState(NamaHalaman, { module: "members" });`
 */
export function withFreshState<P extends object>(Page: ComponentType<P>, access?: { module: Module; action?: Action }) {
  function FreshState(props: P) {
    const { bfcacheId } = useRouter();
    const { can, loading } = useSession();
    if (access && !loading && !can(access.module, access.action ?? "view")) return <NoAccess module={access.module} action={access.action} />;
    if (access && loading) return null; // hak belum diketahui: jangan memuat halaman dulu
    return (
      <Fragment key={bfcacheId}>
        <Page {...props} />
      </Fragment>
    );
  }
  FreshState.displayName = `FreshState(${Page.displayName ?? Page.name ?? "Page"})`;
  return FreshState;
}
