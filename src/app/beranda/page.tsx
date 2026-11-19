"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { ROLE_LABEL, SessionProvider, useSession } from "@/lib/session";

/** Beranda sementara untuk role yang aplikasinya belum dibuat (Owner, Petugas, Anggota). */
function Isi() {
  const { user, logout } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (user?.role === "admin") router.replace("/admin");
  }, [user, router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[420px] rounded-card-xl bg-card p-8">
        <span className="flex size-11 items-center justify-center rounded-[12px] bg-accent text-[22px] font-bold text-on-accent">K</span>
        {!user ? (
          <Skeleton className="mt-6 h-24" />
        ) : (
          <>
            <h1 className="mt-6 text-mobile font-bold text-fg">Halo, {user.nama}</h1>
            <p className="mt-2 text-body text-fg-muted">
              Anda masuk sebagai <b className="text-fg">{ROLE_LABEL[user.role]}</b>. Halaman untuk role ini sedang disiapkan.
            </p>
            <Button variant="outline" size="xl" className="mt-8 w-full" onClick={logout}>Keluar</Button>
          </>
        )}
      </div>
    </main>
  );
}

export default function BerandaPage() {
  return (
    <SessionProvider>
      <Isi />
    </SessionProvider>
  );
}
