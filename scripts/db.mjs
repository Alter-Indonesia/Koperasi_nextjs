// Kelola database db_koperasi.
//   node --env-file=.env.local scripts/db.mjs setup   -> buat database (bila belum ada), jalankan skema, isi data contoh
//   node --env-file=.env.local scripts/db.mjs migrate -> jalankan file sql/*.sql
//   node --env-file=.env.local scripts/db.mjs seed    -> kosongkan & isi ulang data contoh
//   node --env-file=.env.local scripts/db.mjs set-password -> atur password SEMUA pengguna ke SEED_PASSWORD (bcrypt)
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL belum diisi di .env.local'); process.exit(1); }
const cmd = process.argv[2] || 'setup';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));

async function ensureDatabase() {
  const u = new URL(url);
  const dbName = u.pathname.slice(1);
  u.pathname = '/postgres';
  const c = new pg.Client({ connectionString: u.toString() });
  await c.connect();
  const r = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!r.rowCount) { await c.query(`CREATE DATABASE "${dbName}"`); console.log('database dibuat:', dbName); }
  else console.log('database sudah ada:', dbName);
  await c.end();
}

// Migrasi yang sudah dijalankan dicatat di tabel _migrations dan tidak diulang (beberapa migrasi mengubah view/kolom sehingga
// tidak aman dijalankan dua kali). File baru tinggal ditambahkan di sql/; yang sudah tercatat dilewati.
async function migrate(c) {
  const dir = path.join(root, 'sql');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  // nama lama tabel pencatatan (sebelum rename ke Inggris)
  const lamaAda = (await c.query("SELECT to_regclass('_migrasi') IS NOT NULL AS ada, to_regclass('_migrations') IS NOT NULL AS baru")).rows[0];
  if (lamaAda.ada && !lamaAda.baru) await c.query('ALTER TABLE _migrasi RENAME TO _migrations');
  await c.query('CREATE TABLE IF NOT EXISTS _migrations (nama text PRIMARY KEY, dijalankan_pada timestamptz NOT NULL DEFAULT now())');
  // Database lama (dibuat sebelum ada pencatatan): 001–003 sudah pernah dijalankan.
  const lama = (await c.query("SELECT to_regclass('anggota') IS NOT NULL AS ada, (SELECT count(*) FROM _migrations) AS n")).rows[0];
  if (lama.ada && Number(lama.n) === 0)
    for (const f of ['001_schema.sql', '002_auth.sql', '003_ktp.sql']) await c.query('INSERT INTO _migrations (nama) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
  const sudah = new Set((await c.query('SELECT nama FROM _migrations')).rows.map((r) => r.nama));
  for (const f of files) {
    if (sudah.has(f)) { console.log('dilewati (sudah dijalankan):', f); continue; }
    await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await c.query('INSERT INTO _migrations (nama) VALUES ($1)', [f]);
    console.log('migrasi:', f);
  }
}

// Hash bcrypt (cost 12) — sama dengan src/lib/auth.ts, sehingga hash dari skrip ini bisa dipakai login.
const BCRYPT_COST = 12;
const hashPassword = (pw) => bcrypt.hash(pw.normalize('NFKC'), BCRYPT_COST);

/**
 * Atur password SEMUA pengguna (semua role) ke nilai SEED_PASSWORD di .env.local.
 * Setiap pengguna mendapat hash bcrypt dengan garam sendiri. Sesi login & kunci akun ikut direset
 * supaya password lama tidak bisa dipakai lagi. Hanya untuk pengembangan.
 */
async function setAllPasswords(c) {
  const pw = process.env.SEED_PASSWORD;
  if (!pw || pw.length < 8) { console.warn('SEED_PASSWORD kosong / < 8 karakter: password tidak diubah'); return 0; }
  if (Buffer.byteLength(pw) > 72) { console.error('SEED_PASSWORD lebih dari 72 byte (batas bcrypt)'); process.exit(1); }
  const rows = (await c.query('SELECT id FROM users ORDER BY id')).rows;
  for (const r of rows) await c.query('UPDATE users SET password_hash = $2, failed_login_count = 0, locked_until = NULL WHERE id = $1', [r.id, await hashPassword(pw)]);
  await c.query('DELETE FROM sessions');
  console.log(`password bcrypt diset untuk ${rows.length} pengguna (dari SEED_PASSWORD); semua sesi login dihapus`);
  return rows.length;
}

// ---------- data contoh ----------
let s = 20261119;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const today = new Date(); today.setHours(0, 0, 0, 0);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const at = (d, h, m) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString(); };

const WILAYAH = ['Cibeunying', 'Coblong', 'Sukajadi', 'Antapani'];
const PETUGAS = [['PTG-003', 'Dedi Kurniawan', 'dedi@koperasiku.id', '0813-2000-031', 0], ['PTG-005', 'Yanto Prasetyo', 'yanto@koperasiku.id', '0813-2000-032', 1], ['PTG-004', 'Asep Hidayat', 'asep@koperasiku.id', '0813-2000-033', 2], ['PTG-006', 'Lilis Suryani', 'lilis@koperasiku.id', '0813-2000-034', 3]];
const NAMA = [
  ['Siti Aminah', 0, 0], ['Wartini', 0, 0], ['Dadang Sutisna', 0, 0], ['Engkos Kosasih', 0, 1], ['Lina Marlina', 0, 1], ['Iis Rohayati', 0, 0], ['Cecep Supriatna', 0, 5], ['Neni Nuraeni', 0, 12], ['Odah Saodah', 0, 20], ['Jajang Nurjaman', 0, 3],
  ['Budi Santoso', 1, 3], ['Agus Salim', 1, 9], ['Ujang Rahmat', 1, -33], ['Hendra Gunawan', 1, 1], ['Iwan Setiadi', 1, -3], ['Rahmat Hidayat', 1, 1], ['Deden Mulyana', 1, 0], ['Yosep Firmansyah', 1, 0], ['Ratna Sari', 1, 14], ['Asep Sunandar', 1, 7],
  ['Nur Hasanah', 2, -12], ['Rina Marlina', 2, 8], ['Ade Kurnia', 2, 1], ['Yayah Rohayah', 2, 6], ['Neneng Sumarni', 2, 1], ['Dewi Kartika', 2, 0], ['Eko Prasetyo', 2, 0], ['Tuti Alawiyah', 2, 17], ['Wawan Kurniawan', 2, 3], ['Sri Mulyani', 2, -2],
  ['Euis Komariah', 3, -68], ['Asep Saepudin', 3, -96], ['Yuli Astuti', 3, -9], ['Tati Rohaeti', 3, 1], ['Wawan Setiawan', 3, 1], ['Entin Kartini', 3, 0], ['Ujang Suhendar', 3, 0], ['Iyus Rusmana', 3, -45], ['Ai Sumiati', 3, 11], ['Dodi Permana', 3, 4],
];
const PLAFON = [5_000_000, 6_000_000, 7_200_000, 8_500_000, 9_000_000, 10_000_000, 11_700_000, 12_600_000, 14_000_000, 15_000_000];
const TENOR = [6, 10, 12, 12, 12, 18];
const JALAN = ['Jl. Cikutra', 'Jl. Dipatiukur', 'Jl. Sukajadi', 'Jl. Jakarta', 'Gg. Sukaluyu II', 'Jl. Phh. Mustofa', 'Jl. Pahlawan', 'Jl. Tubagus Ismail', 'Jl. Cigadung Raya', 'Jl. Sadang Serang', 'Jl. Purwakarta', 'Jl. Sukagalih'];

async function seed(c) {
  // Kosongkan data contoh TANPA "CASCADE": semua tabel punya kolom audit (created_by, ...) yang menunjuk ke users, jadi CASCADE
  // ikut mengosongkan roles, role_permissions, tenors, dan settings. Tabel konfigurasi itu dipertahankan; yang dikosongkan hanya data contoh.
  for (const t of ['roles', 'tenors', 'settings']) await c.query(`UPDATE ${t} SET created_by = NULL, updated_by = NULL, deleted_by = NULL`);
  await c.query('TRUNCATE sessions, activity_logs, reminder_logs, reminder_templates, reminder_rules, reminder_channels, assignments, cash_deposits, payment_promises, payments, installments, loans, members RESTART IDENTITY');
  for (const t of ['users', 'regions']) {
    await c.query(`DELETE FROM ${t}`);
    await c.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), 1, false)`);
  }
  const wil = [];
  for (const n of WILAYAH) wil.push((await c.query('INSERT INTO regions (name) VALUES ($1) RETURNING id', [n])).rows[0].id);
  const ins = async (sql, v) => (await c.query(sql, v)).rows[0]?.id;
  await ins(`INSERT INTO users (code, name, email, phone, role, last_login_at) VALUES ('OWN-001','H. Darmawan','owner@koperasiku.id','0811-2000-001','owner',now()) RETURNING id`);
  const adminId = await ins(`INSERT INTO users (code, name, email, phone, role, last_login_at) VALUES ('ADM-001','Rina Andayani','rina@koperasiku.id','0812-2000-014','admin',now()) RETURNING id`);
  const pet = [];
  for (const [k, n, e, hp, w] of PETUGAS) pet.push(await ins('INSERT INTO users (code, name, email, phone, role, region_id, last_login_at) VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING id', [k, n, e, hp, 'petugas', wil[w]]));
  await setAllPasswords(c); // password semua pengguna dari SEED_PASSWORD

  // saluran & aturan pengingat
  for (const [i, [k, n, d]] of [['whatsapp', 'WhatsApp', 'Pengingat otomatis + bukti bayar terverifikasi'], ['sms', 'SMS', 'Cadangan bila WhatsApp gagal terkirim'], ['telepon', 'Telepon oleh petugas', 'Tugas telepon muncul di aplikasi petugas'], ['surat', 'Surat tagihan', 'Dicetak admin, diantar petugas (H+7 & H+30)']].entries())
    await c.query('INSERT INTO reminder_channels (code, name, description, is_active, sort_order) VALUES ($1,$2,$3,true,$4)', [k, n, d, i]);
  for (const [i, [o, j, k]] of [[-3, 'Pengingat awal', 'WhatsApp ke anggota'], [-1, 'Pengingat ulang', 'WhatsApp + SMS'], [0, 'Hari jatuh tempo', 'WhatsApp + jadwal kunjungan petugas'], [3, 'Mulai telat', 'Telepon petugas · denda Rp 5.000/hari'], [7, 'Surat tagihan I', 'Diantar petugas · status DPK'], [30, 'Surat tagihan II', 'Eskalasi ke Owner · kunjungan khusus']].entries())
    await c.query('INSERT INTO reminder_rules (day_offset, title, description, sort_order) VALUES ($1,$2,$3,$4)', [o, j, k, i]);
  const tpl = (x) => `Assalamu’alaikum Bapak/Ibu {nama},\n\nangsuran ke-{angsuran_ke} pinjaman {no_pinjaman} sebesar {nominal} ${x}.\n\nBayar via transfer BRI 0123-01-000456-50-1 a.n. KoperasiKu atau titipkan ke petugas. Terima kasih.`;
  for (const [k, x] of [['H-3', 'jatuh tempo pada {jatuh_tempo} (3 hari lagi)'], ['H-1', 'jatuh tempo besok, {jatuh_tempo}'], ['HARI_H', 'jatuh tempo hari ini, {jatuh_tempo}'], ['TELAT', 'sudah lewat jatuh tempo sejak {jatuh_tempo}. Denda Rp 5.000/hari berlaku mulai H+3']])
    await c.query('INSERT INTO reminder_templates (code, channel, body) VALUES ($1,$2,$3)', [k, 'whatsapp', tpl(x)]);

  let noAg = 100, noPj = 100, pendingToday = 0;
  for (const [idx, [nama, w, dueOffset]] of NAMA.entries()) {
    const join = addMonths(today, -Math.floor(6 + rnd() * 70));
    const agId = await ins(`INSERT INTO members (member_number, name, phone, address, region_id, joined_on, principal_savings, mandatory_savings, voluntary_savings)
      VALUES ($1,$2,$3,$4,$5,$6,100000,$7,$8) RETURNING id`,
      [`AG-0${noAg += 7}`, nama, `08${pick(['12', '13', '21', '57', '78'])}-${Math.floor(1000 + rnd() * 8999)}-${Math.floor(1000 + rnd() * 8999)}`, `${pick(JALAN)} No. ${Math.floor(1 + rnd() * 90)}, Wil. ${WILAYAH[w]}`, wil[w], iso(join), Math.floor(4 + rnd() * 40) * 50000, Math.floor(rnd() * 30) * 50000]);
    const plafon = pick(PLAFON), tenor = pick(TENOR), jasa = 1.5;
    const pokok = Math.round(plafon / tenor), jasaRp = Math.round(plafon * jasa / 100), total = pokok + jasaRp;
    // angsuran yang sedang berjalan: ke-(paid+1), jatuh tempo = hari ini + dueOffset
    const paid = Math.min(tenor - 1, Math.max(1, Math.floor(rnd() * (tenor - 1)) + 1));
    const dueCurrent = addDays(today, dueOffset);
    const cair = addMonths(dueCurrent, -(paid + 1));
    const pjId = await ins(`INSERT INTO loans (loan_number, member_id, principal_amount, tenor_duration, interest_rate_percent, installment_amount, purpose, disbursed_on, status, submitted_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'aktif',$9) RETURNING id`, [`PJ-${String(cair.getFullYear()).slice(2)}-0${noPj += 13}`, agId, plafon, tenor, jasa, total, pick(['Modal usaha', 'Renovasi rumah', 'Biaya sekolah', 'Modal warung', 'Pembelian motor usaha']), iso(cair), adminId]);
    const petugasId = pet[w];
    for (let k = 1; k <= tenor; k++) {
      const due = addMonths(cair, k);
      const isPaid = k <= paid;
      // pembayaran hari ini (jatuh tempo hari ini, sebagian sudah bayar & menunggu verifikasi)
      const payToday = !isPaid && k === paid + 1 && dueOffset === 0 && (idx % 3 !== 2);
      const status = isPaid ? 'lunas' : payToday ? (pendingToday < 12 ? 'menunggu_verifikasi' : 'lunas') : 'belum';
      const angId = await ins('INSERT INTO installments (loan_id, sequence, due_date, principal_amount, interest_amount, total_amount, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [pjId, k, iso(due), pokok, jasaRp, total, status]);
      if (isPaid) {
        const tunai = rnd() < 0.6;
        await c.query(`INSERT INTO payments (installment_id, amount, method, method_note, collector_id, paid_at, status, verified_by, verified_at)
          VALUES ($1,$2,$3,$4,$5,$6,'terverifikasi',$7,$6)`, [angId, total, tunai ? 'tunai' : 'transfer', tunai ? null : pick(['Transfer BRI', 'Transfer BCA', 'Transfer BNI']), tunai ? petugasId : null, at(addDays(due, -Math.floor(rnd() * 4)), 9, 30), adminId]);
      }
      if (payToday) {
        const tunai = idx % 4 !== 1;
        const pending = status === 'menunggu_verifikasi';
        if (pending) pendingToday++;
        const t = at(today, 7 + Math.floor(rnd() * 4), Math.floor(rnd() * 59));
        await c.query(`INSERT INTO payments (installment_id, amount, method, method_note, collector_id, paid_at, location_name, lat, lng, proof_image, status, verified_by, verified_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [angId, total, tunai ? 'tunai' : 'transfer', tunai ? null : pick(['Transfer BRI', 'Transfer BCA']), tunai ? petugasId : null, t,
          tunai ? 'Sesuai alamat anggota' : null, tunai ? -6.89 - rnd() / 50 : null, tunai ? 107.61 + rnd() / 50 : null, tunai ? 'kwitansi.jpg' : 'bukti-transfer.jpg',
          pending ? 'menunggu' : 'terverifikasi', pending ? null : adminId, pending ? null : t]);
      }
      // penugasan: hari ini & besok
      if (!isPaid && k === paid + 1 && (dueOffset === 0 || dueOffset < 0) && !(dueOffset < -60))
        await c.query('INSERT INTO assignments (installment_id, collector_id, assigned_on) VALUES ($1,$2,$3)', [angId, petugasId, iso(today)]);
      if (!isPaid && k === paid + 1 && dueOffset === 1 && idx % 2 === 0)
        await c.query('INSERT INTO assignments (installment_id, collector_id, assigned_on) VALUES ($1,$2,$3)', [angId, petugasId, iso(addDays(today, 1))]);
      // log pengingat
      if (!isPaid && k === paid + 1 && [-3, 0, 1, 3].includes(dueOffset) || (!isPaid && k === paid + 1 && dueOffset < 0 && dueOffset > -15)) {
        const st = idx % 9 === 4 ? 'gagal' : idx % 3 === 0 ? 'terkirim' : 'dibaca';
        await c.query('INSERT INTO reminder_logs (installment_id, channel, sent_at, status, notes) VALUES ($1,$2,$3,$4,$5)', [angId, idx % 5 === 3 ? 'sms' : 'whatsapp', at(today, 8, idx % 5 === 3 ? 5 : 0), st, st === 'gagal' ? 'Nomor tidak aktif' : null]);
      }
    }
  }
  // setoran kas petugas: tunai 1-3 hari lalu disetor harian (cocok); tunai lebih lama dianggap sudah disetor; hari ini masih di tangan
  for (const pid of pet) {
    for (const back of [1, 2, 3, 4]) {
      const cond = back === 4 ? 'paid_at < CURRENT_DATE - 3' : `paid_at::date = CURRENT_DATE - ${back}`;
      const r = (await c.query(`SELECT array_agg(id) ids, COALESCE(sum(amount), 0) total FROM payments WHERE collector_id = $1 AND method = 'tunai' AND status <> 'ditolak' AND deposit_id IS NULL AND ${cond}`, [pid])).rows[0];
      if (!r.ids) continue;
      const dep = await ins(`INSERT INTO cash_deposits (collector_id, deposited_on, amount, payment_count, status, received_by) VALUES ($1, CURRENT_DATE - $2::int, $3, $4, 'cocok', $5) RETURNING id`, [pid, back, r.total, r.ids.length, adminId]);
      await c.query('UPDATE payments SET deposit_id = $1 WHERE id = ANY($2::int[])', [dep, r.ids]);
    }
  }
  // pengajuan menunggu persetujuan owner (> Rp 20 jt)
  for (const [nama, w, plafon, tenor, tujuan, jaminan] of [['Rudi Setiawan', 0, 25_000_000, 24, 'Modal usaha warung', 'BPKB motor (2019)'], ['Euis Maryani', 1, 40_000_000, 36, 'Renovasi rumah', 'Sertifikat rumah'], ['Taufik Hidayat', 2, 22_000_000, 18, 'Pembelian motor usaha', 'BPKB motor (2021)']]) {
    const agId = await ins(`INSERT INTO members (member_number, name, phone, address, region_id, joined_on, principal_savings, mandatory_savings) VALUES ($1,$2,'0812-5550-0101',$3,$4,$5,100000,1500000) RETURNING id`, [`AG-0${noAg += 7}`, nama, `Jl. Contoh, Wil. ${WILAYAH[w]}`, wil[w], iso(addMonths(today, -40))]);
    const ang = Math.round(plafon / tenor) + Math.round(plafon * 0.015);
    await c.query(`INSERT INTO loans (loan_number, member_id, principal_amount, tenor_duration, interest_rate_percent, installment_amount, purpose, collateral, status, submitted_by) VALUES ($1,$2,$3,$4,1.5,$5,$6,$7,'pengajuan',$8)`, [`PJ-${String(today.getFullYear()).slice(2)}-0${noPj += 13}`, agId, plafon, tenor, ang, tujuan, jaminan, adminId]);
  }
  const n = (await c.query('SELECT (SELECT count(*) FROM members) a, (SELECT count(*) FROM loans) p, (SELECT count(*) FROM installments) s, (SELECT count(*) FROM payments WHERE status = $1) m', ['menunggu'])).rows[0];
  console.log(`data contoh: ${n.a} anggota, ${n.p} pinjaman, ${n.s} angsuran, ${n.m} pembayaran menunggu verifikasi`);
}

if (cmd === 'setup') await ensureDatabase();
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  if (cmd === 'setup' || cmd === 'migrate') await migrate(c);
  if (cmd === 'setup' || cmd === 'seed') await seed(c);
  if (cmd === 'set-password') await setAllPasswords(c);
} finally { await c.end(); }
