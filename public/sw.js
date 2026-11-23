// Service worker KoperasiKu — sengaja minimal.
// Hanya menyimpan aset statis (JS/CSS/font/ikon berhash) dan halaman offline.
// HALAMAN dan API TIDAK PERNAH disimpan: isinya data pribadi anggota/pinjaman dan bergantung pada sesi login.
const VERSION = "v1";
const STATIC = `koperasi-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("koperasi-") && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Navigasi: selalu ke jaringan; bila offline tampilkan halaman offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Aset statis berhash: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});
