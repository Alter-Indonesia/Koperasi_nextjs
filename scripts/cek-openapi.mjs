// Memastikan dokumentasi API (src/lib/openapi.ts) sinkron dengan route handler yang ada.
//   npm run test:docs     (dev server harus berjalan; alamat dapat diubah lewat UJI_BASE)
//
// Diperiksa: (1) setiap route.ts + method-nya terdokumentasi, (2) tidak ada dokumentasi untuk route yang tidak ada,
// (3) semua $ref valid, (4) parameter path ({id}, {kode}) dideklarasikan, (5) tiap operasi punya tag, ringkasan, dan respons sukses.
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.UJI_BASE ?? 'http://localhost:3100';
const ROOT = path.resolve('src/app/api/v1');
const DIKECUALIKAN = new Set(['/api/v1/openapi.json']); // dokumen spec itu sendiri
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
let masalah = 0;
const gagal = (m) => { masalah++; console.log('GAGAL  ' + m); };

// ---- route yang ada di kode ----
const kode = new Map(); // "METHOD /path" -> file
(function jelajah(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { jelajah(p); continue; }
    if (f.name !== 'route.ts') continue;
    const url = '/api/v1/' + path.relative(ROOT, path.dirname(p)).split(path.sep).join('/').replace(/\[(\w+)\]/g, '{$1}');
    const url2 = url.replace(/\/$/, '');
    if (DIKECUALIKAN.has(url2)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of METHODS) if (new RegExp(`export const ${m}\\s*=`).test(src)) kode.set(`${m} ${url2}`, path.relative(process.cwd(), p));
  }
})(ROOT);

// ---- spec yang disajikan server ----
// spec wajib login: masuk dulu dengan akun contoh (SEED_PASSWORD dari .env.local)
const masuk = await fetch(BASE + '/api/v1/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'rina@koperasiku.id', password: process.env.SEED_PASSWORD ?? '' }),
}).catch(() => null);
if (!masuk) { console.error('Dev server tidak terjangkau di ' + BASE); process.exit(2); }
const cookie = masuk.headers.get('set-cookie')?.split(';')[0];
if (!masuk.ok || !cookie) { console.error('Login gagal — jalankan dengan: npm run test:docs (butuh SEED_PASSWORD di .env.local)'); process.exit(2); }
const res = await fetch(BASE + '/api/v1/openapi.json', { headers: { cookie } }).catch(() => null);
if (!res?.ok) { console.error('Tidak bisa mengambil /api/v1/openapi.json — pastikan dev server berjalan di ' + BASE); process.exit(2); }
const spec = await res.json();

const doc = new Map();
for (const [url, item] of Object.entries(spec.paths)) for (const m of Object.keys(item)) doc.set(`${m.toUpperCase()} ${url}`, item[m]);

for (const [k, f] of kode) if (!doc.has(k)) gagal(`${k} ada di ${f} tetapi belum didokumentasikan di src/lib/openapi.ts`);
for (const k of doc.keys()) if (!kode.has(k)) gagal(`${k} didokumentasikan tetapi tidak ada route-nya`);

// ---- $ref valid ----
const ada = (r) => r.startsWith('#/') && r.slice(2).split('/').reduce((o, s) => o?.[s], spec) !== undefined;
(function cek(o, jejak) {
  if (Array.isArray(o)) return o.forEach((v, i) => cek(v, `${jejak}[${i}]`));
  if (o && typeof o === 'object') {
    if (typeof o.$ref === 'string' && !ada(o.$ref)) gagal(`$ref tidak ditemukan: ${o.$ref} (${jejak})`);
    for (const [k, v] of Object.entries(o)) cek(v, `${jejak}.${k}`);
  }
})(spec, 'spec');

// ---- kelengkapan operasi ----
for (const [k, op] of doc) {
  const url = k.split(' ')[1];
  for (const [, nama] of url.matchAll(/\{(\w+)\}/g)) if (!op.parameters?.some((p) => p.in === 'path' && p.name === nama)) gagal(`${k}: parameter path {${nama}} belum dideklarasikan`);
  if (!op.tags?.length) gagal(`${k}: tags kosong`);
  if (!op.summary) gagal(`${k}: summary kosong`);
  if (!Object.keys(op.responses ?? {}).some((c) => c.startsWith('2'))) gagal(`${k}: tidak ada respons 2xx`);
  const tertutup = op.security === undefined || op.security.length > 0;
  if (tertutup && !op.responses['401']) gagal(`${k}: endpoint wajib login tetapi respons 401 belum didokumentasikan`);
}

console.log(`${kode.size} route di kode · ${doc.size} operasi di dokumentasi · ${Object.keys(spec.components.schemas).length} schema`);
console.log(masalah ? `\n${masalah} masalah` : 'Dokumentasi sinkron dengan route.');
process.exit(masalah ? 1 : 0);
