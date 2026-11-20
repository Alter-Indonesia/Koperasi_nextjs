import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "koperasi_sesi"; // sama dengan src/lib/auth.ts (proxy tidak boleh mengimpor modul server/DB)

/**
 * Cek cepat (optimistic): halaman yang butuh login langsung dialihkan ke /login bila cookie sesi tidak ada.
 * Validasi sesi & role yang sebenarnya tetap dilakukan di setiap endpoint API (lihat `handle` di src/lib/http.ts).
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/owner/:path*", "/petugas/:path*", "/anggota/:path*"],
};
