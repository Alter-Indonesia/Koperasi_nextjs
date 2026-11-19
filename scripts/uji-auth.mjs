// Uji cepat autentikasi terhadap dev server:  node --env-file=.env.local scripts/uji-auth.mjs
// Memakai akun data contoh (password dari SEED_PASSWORD). Akun owner sengaja dikunci lalu dibuka lagi.
import pg from 'pg';

const BASE = process.env.UJI_BASE ?? 'http://localhost:3100';
const PW = process.env.SEED_PASSWORD;
let lulus = 0, gagal = 0;
const cek = (nama, kondisi, info = '') => { if (kondisi) lulus++; else gagal++; console.log(`${kondisi ? 'LULUS' : 'GAGAL'}  ${nama}${info ? '  — ' + info : ''}`); };

async function req(path, { method = 'GET', body, cookie, origin, redirect = 'manual' } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect });
  const set = r.headers.get('set-cookie');
  const json = await r.json().catch(() => null);
  return { status: r.status, json, cookie: set?.split(';')[0], setCookie: set, location: r.headers.get('location') };
}
const login = (email, password, extra = {}) => req('/api/v1/auth/login', { method: 'POST', body: { email, password, ...extra } });

cek('API tanpa login ditolak (401)', (await req('/api/v1/dashboard')).status === 401);
cek('Halaman admin tanpa login dialihkan ke /login', (await req('/admin/verifikasi')).location?.includes('/login?next=%2Fadmin%2Fverifikasi'));
cek('Email tidak terdaftar -> 401 pesan umum', (await login('tidakada@koperasiku.id', 'x12345678')).json?.error?.message === 'Email atau password salah');
cek('Password salah -> 401', (await login('rina@koperasiku.id', 'salah-banget')).status === 401);
cek('Body tidak valid -> 400', (await login('bukan-email', '')).status === 400);

const a = await login('RINA@koperasiku.id', PW);
cek('Admin login berhasil (email tidak peka huruf besar)', a.status === 200 && a.json?.data?.beranda === '/admin');
cek('Cookie sesi HttpOnly + SameSite=Lax', /HttpOnly/i.test(a.setCookie ?? '') && /SameSite=Lax/i.test(a.setCookie ?? ''));
cek('GET /auth/me mengembalikan admin', (await req('/api/v1/auth/me', { cookie: a.cookie })).json?.data?.user?.role === 'admin');
cek('Admin boleh akses dashboard', (await req('/api/v1/dashboard', { cookie: a.cookie })).status === 200);
cek('POST dari origin lain ditolak (403)', (await req('/api/v1/pengingat/kirim', { method: 'POST', cookie: a.cookie, origin: 'https://situs-jahat.example', body: { semua_jatuh_tempo: true } })).status === 403);

const p = await login('dedi@koperasiku.id', PW);
cek('Petugas login -> beranda', p.status === 200 && p.json?.data?.beranda === '/beranda');
cek('Petugas tidak boleh akses API admin (403)', (await req('/api/v1/dashboard', { cookie: p.cookie })).status === 403);

await req('/api/v1/auth/logout', { method: 'POST', cookie: a.cookie });
cek('Setelah logout sesi tidak berlaku (401)', (await req('/api/v1/auth/me', { cookie: a.cookie })).status === 401);

let terakhir;
for (let i = 0; i < 5; i++) terakhir = await login('owner@koperasiku.id', 'tebakan-salah-' + i);
cek('5x salah -> akun dikunci (429)', terakhir.status === 429, terakhir.json?.error?.message);
cek('Saat terkunci, password benar pun ditolak', (await login('owner@koperasiku.id', PW)).status === 429);

// buka kunci owner kembali & hapus sesi uji
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query("UPDATE pengguna SET gagal_login = 0, terkunci_sampai = NULL WHERE email = 'owner@koperasiku.id'");
await c.query("DELETE FROM sesi WHERE user_agent IS NULL OR user_agent LIKE 'node%'");
await c.end();
cek('Setelah kunci dibuka, owner bisa login', (await login('owner@koperasiku.id', PW)).status === 200);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
