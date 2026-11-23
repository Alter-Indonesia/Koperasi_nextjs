/**
 * Spesifikasi OpenAPI 3.1 untuk REST API KoperasiKu (`/api/v1`).
 * Disajikan di GET /api/v1/openapi.json dan ditampilkan Scalar di /docs.
 *
 * Saat menambah/mengubah endpoint, perbarui file ini lalu jalankan `npm run test:docs`
 * (memeriksa setiap route.ts punya padanan di sini).
 */

type Json = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schema: Json, required = true) => ({ required, content: { "application/json": { schema } } });
const resp = (description: string, schema?: Json) => ({ description, ...(schema ? { content: { "application/json": { schema } } } : {}) });
const err = (description: string) => resp(description, ref("Error"));

/** Pembungkus respons sukses: { data, meta? } */
const data = (schema: Json, meta?: Json) => ({
  type: "object",
  required: ["data"],
  properties: { data: schema, ...(meta ? { meta } : {}) },
});
const arr = (schema: Json) => ({ type: "array", items: schema });
const integer = { type: "integer" };
const number = { type: "number" };
const string = { type: "string" };
const date = { type: "string", format: "date", example: "2026-11-19" };
const dateTime = { type: "string", format: "date-time" };
const nullable = (s: Json) => ({ ...s, type: [s.type as string, "null"] });
const obj = (properties: Json, required?: string[]) => ({ type: "object", properties, ...(required ? { required } : {}) });
const rp = (desc = "Rupiah") => ({ type: "integer", description: desc, example: 1250000 });

const FOTO_BODY = { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["foto"], properties: { foto: { type: "string", format: "binary", description: "JPG/PNG/WebP, maks. 5 MB" } } } } } };
const UNAUTH ={ "401": err("Belum login / sesi berakhir"), "403": err("Role tidak punya akses, atau Origin tidak sesuai (POST/PUT/PATCH)") };
const page = { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "Halaman (mulai 1)" };
const limit = (def: number, max = 100) => ({ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: max, default: def }, description: "Jumlah baris per halaman" });
const q = (desc: string) => ({ name: "q", in: "query", schema: string, description: desc });
const idPath = (desc: string) => ({ name: "id", in: "path", required: true, schema: integer, description: desc });
const wilayahId = { name: "region_id", in: "query", schema: integer, description: "Filter wilayah (lihat GET /wilayah)" };
const dateQ = (desc: string) => ({ name: "date", in: "query", schema: date, description: desc });

const KOL = ["Lancar", "DPK", "Kurang Lancar", "Diragukan", "Macet"];
const ADMIN = "Admin, Owner";

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "KoperasiKu REST API",
    version: "1.0.0",
    description: [
      "API aplikasi simpan pinjam & penagihan koperasi. Semua endpoint berada di bawah `/api/v1`.",
      "",
      "## Format respons",
      "- Sukses: `{ \"data\": …, \"meta\": … }` (`meta` hanya ada di endpoint daftar / ringkasan).",
      "- Gagal: `{ \"error\": { \"message\": \"…\", \"details\": […] } }`. `details` hanya ada pada validasi (400).",
      "",
      "## Autentikasi",
      "Panggil `POST /auth/login`; server mengirim cookie **`koperasi_sesi`** (httpOnly, SameSite=Lax) yang dipakai semua endpoint lain.",
      "Klien non-browser (mobile/API): kirim `\"token\": true` saat login, lalu pakai `Authorization: Bearer <token>` di setiap request. Token yang sama dengan cookie; `POST /auth/logout` mencabutnya.",
      "Di halaman dokumentasi ini, login dulu di `/login` pada browser yang sama (otomatis dipakai Test Request), atau tempel token di tombol **Authorize**.",
      "",
      "## Hak akses",
      "Endpoint data Admin hanya untuk role **admin** dan **owner**; endpoint `/petugas/*` untuk role **petugas** (data milik sendiri). `anggota` mendapat `403`.",
      "Request yang mengubah data (POST/PUT/PATCH) dari Origin yang berbeda ditolak (`403`).",
      "",
      "## Konvensi",
      "- Uang: bilangan bulat Rupiah. Tanggal: `YYYY-MM-DD`; waktu: ISO 8601.",
      "- Kolektibilitas dihitung otomatis dari hari keterlambatan angsuran tertua: ≤30 hari **DPK**, ≤60 **Kurang Lancar**, ≤90 **Diragukan**, >90 **Macet**.",
      "- Pinjaman di atas batas persetujuan (pengaturan `loan_approval_limit`, default Rp 20 juta) berstatus `pengajuan` dan menunggu persetujuan Owner.",
      "- `loan_amount` (jumlah pinjaman) tidak boleh melebihi plafon (`principal_amount`, dari pengaturan `loan_ceiling`). Owner boleh melebihinya selama pengaturan `loan_ceiling_owner_override` aktif.",
    ].join("\n"),
  },
  servers: [{ url: "/", description: "Server ini" }],
  tags: [
    { name: "Autentikasi", description: "Login, logout, dan pengguna saat ini" },
    { name: "Dashboard", description: "Ringkasan penagihan hari ini" },
    { name: "Pinjaman", description: "Data pinjaman dan jadwal angsuran" },
    { name: "Anggota", description: "Data anggota koperasi" },
    { name: "Jatuh Tempo", description: "Monitoring angsuran jatuh tempo" },
    { name: "Pembayaran", description: "Verifikasi pembayaran dari lapangan / transfer" },
    { name: "Penugasan", description: "Pembagian tagihan ke petugas lapangan" },
    { name: "Pengingat", description: "Saluran, jadwal, template, dan log pengingat tagihan" },
    { name: "Laporan", description: "Laporan penagihan" },
    { name: "Referensi", description: "Data pendukung (petugas)" },
    { name: "Petugas", description: "Aplikasi petugas lapangan: tugas hari ini, setoran kas, profil (data milik petugas yang login)" },
    { name: "Master Data", description: "Wilayah dan tenor pinjaman (soft delete)" },
    { name: "Setoran", description: "Admin menerima atau menolak setoran uang tunai dari petugas; selisih dan setoran yang ditolak kembali ke petugas" },
    { name: "Persetujuan", description: "Keputusan Owner untuk pinjaman di atas batas persetujuan (`loan_approval_limit`)" },
    { name: "Sistem", description: "Pengguna, role & hak akses, dan log aktivitas" },
  ],
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  paths: {
    // ---------------- Autentikasi ----------------
    "/api/v1/auth/login": {
      post: {
        tags: ["Autentikasi"],
        summary: "Login",
        description: "Memeriksa email & password lalu membuat sesi. 5 kali salah berturut-turut mengunci akun 15 menit. Email tidak terdaftar dan password salah memberi pesan yang sama.",
        security: [],
        requestBody: jsonBody(ref("LoginRequest")),
        responses: {
          "200": {
            description: "Berhasil. Cookie sesi dikirim lewat header `Set-Cookie`.",
            headers: { "Set-Cookie": { schema: string, description: "koperasi_sesi=…; HttpOnly; SameSite=Lax; Path=/" } },
            content: { "application/json": { schema: data(ref("LoginResult")) } },
          },
          "400": err("Format email / password tidak valid"),
          "401": err("Email atau password salah"),
          "429": err("Akun terkunci sementara karena terlalu banyak percobaan"),
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Autentikasi"],
        summary: "Logout",
        description: "Menghapus sesi di database dan cookie. Aman dipanggil walau sesi sudah berakhir.",
        security: [],
        responses: { "200": resp("Berhasil keluar", data(obj({ logged_out: { type: "boolean" } }))) },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Autentikasi"],
        summary: "Pengguna yang sedang login",
        description: "Berlaku untuk semua role. `permissions` dipakai klien untuk menyaring menu.",
        responses: { "200": resp("Pengguna, role, area menu, halaman awal, dan hak akses per modul", data(obj({ user: ref("User"), role_name: string, area: { type: "string", enum: ["admin", "owner", "petugas", "anggota"] }, home: { ...string, example: "/admin" }, permissions: ref("PermissionMatrix") }))), "401": err("Belum login") },
      },
    },

    // ---------------- Dashboard ----------------
    "/api/v1/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Ringkasan penagihan hari ini",
        description: `Role: ${ADMIN}.`,
        responses: { "200": resp("Ringkasan", data(ref("Dashboard"))), ...UNAUTH },
      },
    },

    // ---------------- Pinjaman ----------------
    "/api/v1/pinjaman": {
      get: {
        tags: ["Pinjaman"],
        summary: "Daftar pinjaman aktif",
        description: `Role: ${ADMIN}. Urut dari yang paling telat.`,
        parameters: [
          { name: "collectibility", in: "query", schema: { type: "string", enum: KOL }, description: "Filter kolektibilitas" },
          q("Cari nama anggota atau nomor pinjaman"),
          page,
          limit(10),
        ],
        responses: {
          "200": resp(
            "Daftar pinjaman",
            data(
              arr(ref("LoanSummary")),
              obj({
                page: integer, limit: integer, total: integer,
                outstanding: { ...rp("Total sisa pinjaman aktif"), example: 247588169 },
                total_active: { ...integer, description: "Jumlah semua pinjaman aktif" },
                collectibility: { type: "object", description: "Jumlah pinjaman per kolektibilitas", additionalProperties: integer, example: { Lancar: 30, DPK: 5, "Kurang Lancar": 2, Diragukan: 2, Macet: 1 } },
              }),
            ),
          ),
          ...UNAUTH,
        },
      },
      post: {
        tags: ["Pinjaman"],
        summary: "Buat pinjaman baru",
        description: `Role: ${ADMIN}. Pinjaman ≤ batas persetujuan (\`loan_approval_limit\`, default Rp 20 juta) langsung \`aktif\` dan jadwal angsuran dibuat otomatis (bunga flat). Di atas itu berstatus \`pengajuan\` (menunggu Owner) dan belum punya jadwal.`,
        requestBody: jsonBody(ref("NewLoan")),
        responses: {
          "201": resp("Pinjaman dibuat", data(obj({ id: integer, loan_number: { ...string, example: "PJ-26-0044" }, status: { type: "string", enum: ["aktif", "pengajuan"] } }))),
          "400": err("Data tidak valid"),
          "404": err("Anggota tidak ditemukan"),
          "422": err("Anggota tidak aktif / tenor tidak tersedia"),
          ...UNAUTH,
        },
      },
    },
    "/api/v1/pinjaman/pengaturan": {
      get: {
        tags: ["Pinjaman"],
        summary: "Pengaturan untuk form pinjaman",
        description: "Perlakuan biaya admin yang berlaku saat ini (Sistem › Pengaturan). Cukup hak lihat Pinjaman.",
        responses: { "200": resp("Pengaturan", data(obj({ admin_fee_mode: { type: "string", enum: ["potong", "tambah"], description: "potong = pengurang dana cair; tambah = penambah pokok pinjaman" }, ceiling: { ...integer, description: "Plafon (pengaturan loan_ceiling): batas atas jumlah pinjaman", example: 20000000 }, can_exceed: { type: "boolean", description: "true bila pengguna yang login (Owner) boleh melebihi plafon" }, approval_limit: { ...integer, description: "Batas persetujuan Owner (pengaturan loan_approval_limit): pinjaman di atas nilai ini berstatus pengajuan", example: 20000000 } }))), ...UNAUTH },
      },
    },
    "/api/v1/pinjaman/{id}": {
      get: {
        tags: ["Pinjaman"],
        summary: "Detail pinjaman + jadwal angsuran",
        description: `Role: ${ADMIN}.`,
        parameters: [idPath("ID pinjaman")],
        responses: { "200": resp("Detail", data(ref("LoanDetail"))), "404": err("Pinjaman tidak ditemukan"), ...UNAUTH },
      },
    },

    // ---------------- Anggota ----------------
    "/api/v1/anggota": {
      get: {
        tags: ["Anggota"],
        summary: "Daftar anggota + statistik",
        description: `Role: ${ADMIN}.`,
        parameters: [wilayahId, q("Cari nama, nomor anggota, atau nomor HP"), page, limit(9)],
        responses: {
          "200": resp(
            "Daftar anggota",
            data(
              arr(ref("MemberSummary")),
              obj({
                page: integer, limit: integer, total: integer,
                stats: obj({ total: integer, new_this_month: { ...integer, description: "Anggota baru bulan ini" }, borrowing: integer, in_arrears: integer, total_savings: rp("Total simpanan semua anggota") }),
              }),
            ),
          ),
          ...UNAUTH,
        },
      },
      post: {
        tags: ["Anggota"],
        summary: "Tambah anggota",
        description: `Role: ${ADMIN}. Nomor anggota (AG-xxxx) dibuat otomatis. \`biodata\` (kolom KTP) disimpan di kolom biodata; kolom metadata diisi server dari biodata + data anggota lain. Foto KTP diunggah terpisah ke \`POST /anggota/{id}/ktp\`.`,
        requestBody: jsonBody(ref("NewMember")),
        responses: {
          "201": resp("Anggota dibuat", data(obj({ id: integer, member_number: { ...string, example: "AG-1044" }, name: string }))),
          "400": err("Data tidak valid"),
          "409": err("NIK sudah terdaftar"),
          "422": err("Wilayah tidak ditemukan"),
          ...UNAUTH,
        },
      },
    },
    "/api/v1/anggota/{id}": {
      get: {
        tags: ["Anggota"],
        summary: "Detail anggota",
        description: `Role: ${ADMIN}. Biodata KTP, jejak audit (dibuat/diubah oleh dan kapan), dan daftar pinjaman. Anggota yang sudah dihapus (soft delete) menjawab 404.`,
        parameters: [idPath("ID anggota")],
        responses: { "200": resp("Detail anggota", data(ref("MemberDetail"))), "404": err("Anggota tidak ditemukan"), ...UNAUTH },
      },
      patch: {
        tags: ["Anggota"],
        summary: "Ubah anggota",
        description: `Role: ${ADMIN}. Hanya kolom yang dikirim yang diubah; \`biodata\` menggantikan seluruh biodata. updated_by dan updated_at terisi otomatis. Foto KTP diganti lewat \`POST /anggota/{id}/ktp\`.`,
        parameters: [idPath("ID anggota")],
        requestBody: jsonBody(ref("UpdateMember")),
        responses: {
          "200": resp("Tersimpan", data(obj({ id: integer, member_number: string, name: string }))),
          "400": err("Data tidak valid / tidak ada yang diubah"),
          "404": err("Anggota tidak ditemukan"),
          "409": err("NIK sudah dipakai anggota lain"),
          "422": err("Wilayah tidak ditemukan"),
          ...UNAUTH,
        },
      },
      delete: {
        tags: ["Anggota"],
        summary: "Hapus anggota (soft delete)",
        description: `Role: ${ADMIN}. Mengisi deleted_at dan deleted_by; data tetap ada di basis data tetapi tidak muncul lagi di aplikasi. Ditolak bila anggota masih punya pinjaman berstatus pengajuan atau aktif.`,
        parameters: [idPath("ID anggota")],
        responses: {
          "200": resp("Dihapus", data(obj({ id: integer, member_number: string, name: string, deleted: { type: "boolean" } }))),
          "404": err("Anggota tidak ditemukan / sudah dihapus"),
          "409": err("Masih punya pinjaman berjalan"),
          ...UNAUTH,
        },
      },
    },
    "/api/v1/anggota/baca-ktp": {
      post: {
        tags: ["Anggota"],
        summary: "Baca foto KTP (OCR)",
        description: `Role: ${ADMIN}. OCR lokal dengan Tesseract (foto tidak dikirim ke pihak ketiga) dan tidak menyimpan apa pun. Hasil bisa keliru, jadi harus diperiksa sebelum disimpan lewat \`POST /anggota\`. Bisa memakan 10–30 detik.`,
        requestBody: FOTO_BODY,
        responses: {
          "200": resp("Hasil bacaan (kolom yang tidak terbaca tidak ada)", data(obj({ national_id: { type: ["string", "null"], example: "3273010101900001" }, biodata: ref("Biodata") }), obj({ fields_read: integer }))),
          "400": err("Berkas tidak dikirim"),
          "413": err("Foto lebih dari 5 MB"),
          "415": err("Bukan JPG/PNG/WebP"),
          ...UNAUTH,
        },
      },
    },
    "/api/v1/anggota/{id}/ktp": {
      get: {
        tags: ["Anggota"],
        summary: "Ambil foto KTP anggota",
        description: `Role: ${ADMIN}. Mengembalikan berkas gambar (bukan JSON). Foto KTP tidak punya URL publik.`,
        parameters: [idPath("ID anggota")],
        responses: {
          "200": { description: "Gambar KTP", content: { "image/jpeg": { schema: { type: "string", format: "binary" } }, "image/png": { schema: { type: "string", format: "binary" } }, "image/webp": { schema: { type: "string", format: "binary" } } } },
          "404": err("Anggota / foto tidak ditemukan"),
          ...UNAUTH,
        },
      },
      post: {
        tags: ["Anggota"],
        summary: "Unggah / ganti foto KTP anggota",
        description: `Role: ${ADMIN}. Disimpan di folder server (storage/ktp); foto lama dihapus.`,
        parameters: [idPath("ID anggota")],
        requestBody: FOTO_BODY,
        responses: { "200": resp("Tersimpan", data(obj({ id_card_image: string }))), "400": err("Berkas tidak dikirim"), "404": err("Anggota tidak ditemukan"), "413": err("Foto lebih dari 5 MB"), "415": err("Bukan JPG/PNG/WebP"), ...UNAUTH },
      },
    },

    // ---------------- Jatuh tempo ----------------
    "/api/v1/jatuh-tempo": {
      get: {
        tags: ["Jatuh Tempo"],
        summary: "Angsuran jatuh tempo pada suatu tanggal + tunggakan sebelumnya",
        description: `Role: ${ADMIN}. \`meta.week\` berisi 7 hari (Senin–Minggu) dari minggu tanggal terpilih beserta jumlah tagihannya.`,
        parameters: [
          dateQ("Tanggal acuan; default hari ini"),
          { name: "status", in: "query", schema: { type: "string", enum: ["all", "unpaid", "overdue"], default: "all" }, description: "`unpaid` = jatuh tempo pada tanggal itu & belum dibayar; `overdue` = sudah lewat jatuh tempo & belum dibayar" },
          { name: "q", in: "query", schema: { type: "string" }, description: "Cari nama anggota, no. pinjaman, atau nama petugas" },
          { name: "bucket", in: "query", schema: { type: "string", enum: ["overdue", "today", "tomorrow", "h3"] }, description: "Daftar di balik satu kartu ringkasan (lewat jatuh tempo / hari ini / H-1 / H-3); mengabaikan `status`. Jumlahnya sama dengan `meta.summary.*_count`" },
        ],
        responses: {
          "200": resp(
            "Daftar angsuran (maks. 200 baris)",
            data(
              arr(ref("DueInstallment")),
              obj({
                date: date,
                status: string,
                week: arr(obj({ date: date, count: integer })),
                summary: obj({ overdue_count: integer, overdue_amount: rp(), today_count: integer, today_amount: rp(), tomorrow_count: integer, tomorrow_amount: rp(), h3_count: integer, h3_amount: rp() }),
              }),
            ),
          ),
          ...UNAUTH,
        },
      },
    },

    // ---------------- Pembayaran ----------------
    "/api/v1/pembayaran": {
      get: {
        tags: ["Pembayaran"],
        summary: "Antrean pembayaran",
        description: `Role: ${ADMIN}. \`menunggu\` diurut terlama dulu; \`terverifikasi\`/\`ditolak\` hanya yang diproses hari ini.`,
        parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["menunggu", "terverifikasi", "ditolak"], default: "menunggu" } }, limit(50, 200)],
        responses: {
          "200": resp(
            "Daftar pembayaran",
            data(arr(ref("PaymentSummary")), obj({ status: string, counts: obj({ menunggu: integer, terverifikasi: integer, ditolak: integer }) })),
          ),
          ...UNAUTH,
        },
      },
    },
    "/api/v1/pembayaran/{id}": {
      get: {
        tags: ["Pembayaran"],
        summary: "Detail bukti pembayaran",
        description: `Role: ${ADMIN}. Termasuk sisa pinjaman sebelum & sesudah diverifikasi.`,
        parameters: [idPath("ID pembayaran")],
        responses: { "200": resp("Detail", data(ref("PaymentDetail"))), "404": err("Pembayaran tidak ditemukan"), ...UNAUTH },
      },
    },
    "/api/v1/pembayaran/{id}/verifikasi": {
      post: {
        tags: ["Pembayaran"],
        summary: "Verifikasi atau tolak pembayaran",
        description: [
          `Role: ${ADMIN}. Pembayaran harus berstatus \`menunggu\`.`,
          "- **verify**: pembayaran `terverifikasi`, angsuran `lunas`, saldo pinjaman berkurang; bila semua angsuran lunas, pinjaman menjadi `lunas`.",
          "- **reject**: pembayaran `ditolak`, angsuran kembali `belum` dan masuk penagihan lanjutan. `notes` (alasan) wajib.",
          "- Pembayaran **tunai yang dicatat petugas** baru bisa diverifikasi setelah uangnya disetor dan setorannya diterima Admin (status setoran `cocok`/`selisih`); bila belum, **verify** ditolak 422. **reject** tidak dibatasi.",
        ].join("\n"),
        parameters: [idPath("ID pembayaran")],
        requestBody: jsonBody(ref("VerifyRequest")),
        responses: {
          "200": resp("Diproses", data(obj({ id: integer, status: { type: "string", enum: ["terverifikasi", "ditolak"] }, loan_paid_off: { type: "boolean" } }))),
          "400": err("Data tidak valid"),
          "404": err("Pembayaran tidak ditemukan"),
          "409": err("Pembayaran sudah diproses"),
          "422": err("Alasan penolakan wajib diisi / setoran petugas belum diterima"),
          ...UNAUTH,
        },
      },
    },

    // ---------------- Penugasan ----------------
    "/api/v1/penugasan": {
      get: {
        tags: ["Penugasan"],
        summary: "Tagihan yang belum ditugaskan + beban tiap petugas",
        description: `Role: ${ADMIN}. Tagihan = angsuran tertua yang belum dibayar per pinjaman, jatuh tempo s.d. tanggal tugas.`,
        parameters: [dateQ("Tanggal tugas; default besok")],
        responses: { "200": resp("Data penugasan", data(ref("Assignments"))), ...UNAUTH },
      },
      post: {
        tags: ["Penugasan"],
        summary: "Tugaskan tagihan ke satu petugas",
        description: `Role: ${ADMIN}. Bila tagihan sudah ditugaskan di tanggal itu, petugasnya diganti.`,
        requestBody: jsonBody(ref("AssignRequest")),
        responses: { "201": resp("Ditugaskan", data(obj({ assigned: integer }))), "400": err("Data tidak valid"), "404": err("Petugas tidak ditemukan"), ...UNAUTH },
      },
    },
    "/api/v1/penugasan/otomatis": {
      post: {
        tags: ["Penugasan"],
        summary: "Bagi tagihan otomatis per wilayah",
        description: `Role: ${ADMIN}. Setiap tagihan yang belum ditugaskan diberikan ke petugas di wilayah anggotanya.`,
        requestBody: jsonBody(obj({ date: date }, ["date"])),
        responses: { "201": resp("Ditugaskan", data(obj({ assigned: integer }))), "400": err("Data tidak valid"), ...UNAUTH },
      },
    },

    // ---------------- Pengingat ----------------
    "/api/v1/pengingat": {
      get: {
        tags: ["Pengingat"],
        summary: "Saluran, aturan jadwal, template pesan, dan log hari ini",
        description: `Role: ${ADMIN}.`,
        responses: { "200": resp("Pengaturan pengingat", data(ref("Reminders"))), ...UNAUTH },
      },
    },
    "/api/v1/pengingat/kirim": {
      post: {
        tags: ["Pengingat"],
        summary: "Kirim pengingat",
        description: `Role: ${ADMIN}. **Catatan:** gateway WhatsApp/SMS belum terhubung; pengingat baru dicatat di log dengan status \`terkirim\`. Isi \`installment_ids\` atau set \`all_due\` = true.`,
        requestBody: jsonBody(ref("SendReminderRequest")),
        responses: {
          "201": resp("Dicatat", data(obj({ sent: integer, channel: { type: "string", enum: ["whatsapp", "sms"] } }))),
          "400": err("Angsuran belum dipilih / data tidak valid"),
          "422": err("Saluran sedang dinonaktifkan"),
          ...UNAUTH,
        },
      },
    },
    "/api/v1/pengingat/saluran/{kode}": {
      patch: {
        tags: ["Pengingat"],
        summary: "Aktif / nonaktifkan saluran",
        description: `Role: ${ADMIN}.`,
        parameters: [{ name: "kode", in: "path", required: true, schema: { type: "string", enum: ["whatsapp", "sms", "telepon", "surat"] } }],
        requestBody: jsonBody(obj({ is_active: { type: "boolean" } }, ["is_active"])),
        responses: { "200": resp("Tersimpan", data(obj({ code: string, name: string, is_active: { type: "boolean" } }))), "404": err("Saluran tidak ditemukan"), ...UNAUTH },
      },
    },
    "/api/v1/pengingat/template/{kode}": {
      put: {
        tags: ["Pengingat"],
        summary: "Ubah isi template pesan",
        description: `Role: ${ADMIN}. Variabel yang dikenali: \`{nama}\`, \`{angsuran_ke}\`, \`{no_pinjaman}\`, \`{nominal}\`, \`{jatuh_tempo}\`.`,
        parameters: [{ name: "kode", in: "path", required: true, schema: { type: "string", enum: ["H-3", "H-1", "HARI_H", "TELAT"] } }],
        requestBody: jsonBody(obj({ body: { type: "string", minLength: 10, maxLength: 1000 } }, ["body"])),
        responses: { "200": resp("Tersimpan", data(obj({ code: string, channel: string, body: string }))), "400": err("Data tidak valid"), "404": err("Template tidak ditemukan"), ...UNAUTH },
      },
    },

    // ---------------- Laporan ----------------
    "/api/v1/laporan/penagihan": {
      get: {
        tags: ["Laporan"],
        summary: "Laporan penagihan",
        description: `Role: ${ADMIN}. Default periode: awal bulan ini s.d. hari ini. "Ditagih" = angsuran yang jatuh tempo di periode tsb.`,
        parameters: [
          { name: "from", in: "query", schema: date, description: "Awal periode" },
          { name: "to", in: "query", schema: date, description: "Akhir periode" },
          wilayahId,
        ],
        responses: { "200": resp("Laporan", data(ref("CollectionReport"), obj({ from: date, to: date }))), ...UNAUTH },
      },
    },

    // ---------------- Referensi ----------------
    "/api/v1/wilayah": {
      get: {
        tags: ["Master Data"],
        summary: "Daftar wilayah",
        description: `Role: ${ADMIN}.`,
        responses: { "200": resp("Wilayah", data(arr(ref("Region")))), ...UNAUTH },
      },
      post: {
        tags: ["Master Data"],
        summary: "Tambah wilayah",
        description: `Role: ${ADMIN}. Nama wilayah unik (tidak peka huruf besar).`,
        requestBody: jsonBody(obj({ name: { type: "string", minLength: 2, maxLength: 60, example: "Cibeunying" } }, ["name"])),
        responses: { "201": resp("Dibuat", data(obj({ id: integer, name: string }))), "400": err("Data tidak valid"), "409": err("Nama wilayah sudah ada"), ...UNAUTH },
      },
    },
    "/api/v1/wilayah/{id}": {
      get: {
        tags: ["Master Data"],
        summary: "Detail wilayah",
        description: `Role: ${ADMIN}.`,
        parameters: [idPath("ID wilayah")],
        responses: { "200": resp("Detail", data(ref("Region"))), "404": err("Wilayah tidak ditemukan"), ...UNAUTH },
      },
      patch: {
        tags: ["Master Data"],
        summary: "Ubah wilayah",
        description: `Role: ${ADMIN}.`,
        parameters: [idPath("ID wilayah")],
        requestBody: jsonBody(obj({ name: { type: "string", minLength: 2, maxLength: 60 } }, ["name"])),
        responses: { "200": resp("Tersimpan", data(obj({ id: integer, name: string }))), "400": err("Data tidak valid"), "404": err("Wilayah tidak ditemukan"), "409": err("Nama wilayah sudah ada"), ...UNAUTH },
      },
      delete: {
        tags: ["Master Data"],
        summary: "Hapus wilayah (soft delete)",
        description: `Role: ${ADMIN}. Ditolak bila masih dipakai anggota atau pengguna.`,
        parameters: [idPath("ID wilayah")],
        responses: { "200": resp("Dihapus", data(obj({ id: integer, name: string, deleted: { type: "boolean" } }))), "404": err("Wilayah tidak ditemukan"), "409": err("Wilayah masih dipakai"), ...UNAUTH },
      },
    },
    "/api/v1/pengaturan": {
      get: {
        tags: ["Sistem"],
        summary: "Daftar pengaturan sistem",
        description: "Hak: Pengaturan › lihat. Tiap baris = satu pengaturan; `value_type` + `config` menentukan bentuk isiannya (halaman dibentuk otomatis dari sini).",
        responses: { "200": resp("Pengaturan", data(arr(ref("Setting")))), ...UNAUTH },
      },
      patch: {
        tags: ["Sistem"],
        summary: "Ubah pengaturan",
        description: "Hak: Pengaturan › ubah. Beberapa pengaturan sekaligus; nilai divalidasi menurut tipe & config barisnya.",
        requestBody: jsonBody(obj({ values: { type: "object", additionalProperties: true, example: { admin_fee_mode: "tambah" }, description: "{ key: nilai }" } }, ["values"])),
        responses: { "200": resp("Tersimpan (daftar terbaru)", data(arr(ref("Setting")))), "400": err("Data tidak valid"), "422": err("Pengaturan tidak dikenal / nilai tidak valid"), ...UNAUTH },
      },
    },
    "/api/v1/tenor": {
      get: {
        tags: ["Master Data"],
        summary: "Daftar tenor",
        description: `Role: ${ADMIN}. \`active=1\` hanya tenor aktif (dipakai form pinjaman).`,
        parameters: [{ name: "active", in: "query", schema: { type: "string", enum: ["1"] }, description: "1 = hanya yang aktif" }],
        responses: { "200": resp("Tenor", data(arr(ref("Tenor")))), ...UNAUTH },
      },
      post: {
        tags: ["Master Data"],
        summary: "Tambah tenor",
        description: `Role: ${ADMIN}. Lama (bulan) unik.`,
        requestBody: jsonBody(ref("TenorInput")),
        responses: { "201": resp("Dibuat", data(ref("Tenor"))), "400": err("Data tidak valid"), "409": err("Tenor sudah ada"), ...UNAUTH },
      },
    },
    "/api/v1/tenor/{id}": {
      get: {
        tags: ["Master Data"],
        summary: "Detail tenor",
        description: `Role: ${ADMIN}.`,
        parameters: [idPath("ID tenor")],
        responses: { "200": resp("Detail", data(ref("Tenor"))), "404": err("Tenor tidak ditemukan"), ...UNAUTH },
      },
      patch: {
        tags: ["Master Data"],
        summary: "Ubah tenor",
        description: `Role: ${ADMIN}. Hanya kolom yang dikirim yang diubah.`,
        parameters: [idPath("ID tenor")],
        requestBody: jsonBody(ref("TenorInput"), false),
        responses: { "200": resp("Tersimpan", data(ref("Tenor"))), "400": err("Data tidak valid"), "404": err("Tenor tidak ditemukan"), "409": err("Tenor sudah ada"), ...UNAUTH },
      },
      delete: {
        tags: ["Master Data"],
        summary: "Hapus tenor (soft delete)",
        description: `Role: ${ADMIN}. Pinjaman yang sudah ada tidak terpengaruh.`,
        parameters: [idPath("ID tenor")],
        responses: { "200": resp("Dihapus", data(obj({ id: integer, duration: integer, unit: { type: "string", enum: ["bulan", "hari"] }, deleted: { type: "boolean" } }))), "404": err("Tenor tidak ditemukan"), ...UNAUTH },
      },
    },
    "/api/v1/role": {
      get: {
        tags: ["Sistem"],
        summary: "Daftar role",
        description: `Role: ${ADMIN} (modul \`roles\`). Hak akses tiap endpoint mengikuti matriks role ini.`,
        responses: { "200": resp("Role", data(arr(ref("RoleSummary")))), ...UNAUTH },
      },
      post: {
        tags: ["Sistem"],
        summary: "Tambah role kustom",
        description: `Role kustom baru belum punya hak akses; atur lewat \`PUT /role/{id}/permissions\`.`,
        requestBody: jsonBody(ref("NewRole")),
        responses: { "201": resp("Dibuat", data(obj({ id: integer, code: string, name: string }))), "400": err("Data tidak valid"), "409": err("Kode role sudah dipakai"), ...UNAUTH },
      },
    },
    "/api/v1/role/{id}": {
      get: { tags: ["Sistem"], summary: "Detail role + hak akses", parameters: [idPath("ID role")], responses: { "200": resp("Detail", data(ref("RoleDetail"))), "404": err("Role tidak ditemukan"), ...UNAUTH } },
      patch: {
        tags: ["Sistem"], summary: "Ubah role", description: "Nama, deskripsi, dan area. Area role bawaan tidak bisa diubah.", parameters: [idPath("ID role")],
        requestBody: jsonBody(obj({ name: string, description: string, area: { type: "string", enum: ["admin", "owner", "petugas", "anggota"] } }), false),
        responses: { "200": resp("Tersimpan", data(obj({ id: integer, code: string, name: string, area: string }))), "400": err("Data tidak valid"), "404": err("Role tidak ditemukan"), "409": err("Area role bawaan tidak bisa diubah"), ...UNAUTH },
      },
      delete: {
        tags: ["Sistem"], summary: "Hapus role kustom (soft delete)", description: "Ditolak untuk role bawaan atau role yang masih dipakai pengguna.", parameters: [idPath("ID role")],
        responses: { "200": resp("Dihapus", data(obj({ id: integer, code: string, deleted: { type: "boolean" } }))), "404": err("Role tidak ditemukan"), "409": err("Role bawaan / masih dipakai"), ...UNAUTH },
      },
    },
    "/api/v1/role/{id}/permissions": {
      put: {
        tags: ["Sistem"],
        summary: "Ganti hak akses role",
        description: "Mengganti seluruh hak akses. Aksi selain `view` otomatis menyertakan `view`. Role `owner` (superadmin) dikunci (409). Perubahan berlaku seketika.",
        parameters: [idPath("ID role")],
        requestBody: jsonBody(obj({ permissions: ref("PermissionMatrix") }, ["permissions"])),
        responses: { "200": resp("Tersimpan", data(obj({ id: integer, modules: { ...integer, description: "Jumlah modul yang diberi hak" } }))), "400": err("Modul/aksi tidak dikenal"), "404": err("Role tidak ditemukan"), "409": err("Role admin dikunci"), ...UNAUTH },
      },
    },
    "/api/v1/pengguna": {
      get: {
        tags: ["Sistem"], summary: "Daftar pengguna", description: `Role: ${ADMIN} (modul \`users\`).`,
        parameters: [q("Cari nama, email, atau kode"), { name: "role", in: "query", schema: string, description: "Filter kode role" }, { name: "status", in: "query", schema: { type: "string", enum: ["aktif", "nonaktif"] } }, page, limit(10)],
        responses: { "200": resp("Pengguna", data(arr(ref("User2")), obj({ page: integer, limit: integer, total: integer }))), ...UNAUTH },
      },
      post: {
        tags: ["Sistem"], summary: "Tambah pengguna", description: "Password awal di-hash bcrypt. Kode dikosongkan = dibuat otomatis (mis. PET-014).",
        requestBody: jsonBody(ref("NewUser")),
        responses: { "201": resp("Dibuat", data(obj({ id: integer, name: string, email: string }))), "400": err("Data tidak valid"), "409": err("Email / kode sudah dipakai"), "422": err("Role / wilayah tidak ditemukan"), ...UNAUTH },
      },
    },
    "/api/v1/pengguna/{id}": {
      get: { tags: ["Sistem"], summary: "Detail pengguna", description: "Tidak pernah mengembalikan password.", parameters: [idPath("ID pengguna")], responses: { "200": resp("Detail", data(ref("UserDetail"))), "404": err("Pengguna tidak ditemukan"), ...UNAUTH } },
      patch: {
        tags: ["Sistem"], summary: "Ubah pengguna",
        description: "Kolom yang dikirim saja. Mengirim `password` mengganti password dan memutus semua sesi pengguna itu; menonaktifkan akun juga memutus sesi. Role/status akun sendiri tidak bisa diubah.",
        parameters: [idPath("ID pengguna")],
        requestBody: jsonBody(ref("NewUser"), false),
        responses: { "200": resp("Tersimpan", data(obj({ id: integer, name: string, email: string }))), "400": err("Data tidak valid"), "404": err("Pengguna tidak ditemukan"), "409": err("Email/kode dipakai atau mengubah akun sendiri"), "422": err("Role / wilayah tidak ditemukan"), ...UNAUTH },
      },
      delete: {
        tags: ["Sistem"], summary: "Hapus pengguna (soft delete)", description: "Sesi login ikut diputus. Akun sendiri tidak bisa dihapus.", parameters: [idPath("ID pengguna")],
        responses: { "200": resp("Dihapus", data(obj({ id: integer, name: string, deleted: { type: "boolean" } }))), "404": err("Pengguna tidak ditemukan"), "409": err("Akun sendiri tidak bisa dihapus"), ...UNAUTH },
      },
    },
    "/api/v1/log-aktivitas": {
      get: {
        tags: ["Sistem"], summary: "Log aktivitas", description: "Setiap login dan setiap perubahan data (POST/PUT/PATCH/DELETE) dicatat otomatis. Hanya nama kolom yang dicatat, tidak pernah nilainya. Log hanya bisa dibaca.",
        parameters: [q("Cari nama pengguna atau alamat API"), { name: "module", in: "query", schema: string }, { name: "action", in: "query", schema: string }, { name: "user_id", in: "query", schema: integer }, { name: "from", in: "query", schema: date }, { name: "to", in: "query", schema: date }, page, limit(15)],
        responses: { "200": resp("Catatan", data(arr(ref("ActivityLog")), obj({ page: integer, limit: integer, total: integer }))), ...UNAUTH },
      },
    },
    "/api/v1/log-aktivitas/{id}": {
      get: { tags: ["Sistem"], summary: "Detail catatan log", parameters: [idPath("ID catatan")], responses: { "200": resp("Detail", data(ref("ActivityLog"))), "404": err("Catatan tidak ditemukan"), ...UNAUTH } },
    },
    "/api/v1/persetujuan": {
      get: {
        tags: ["Persetujuan"], summary: "Pengajuan pinjaman menunggu keputusan", description: "Pinjaman berstatus `pengajuan` (> `loan_approval_limit`). Modul `loan_approvals`.",
        responses: { "200": resp("Pengajuan", data(arr(ref("Approval")), obj({ summary: obj({ pending: integer, pending_amount: rp(), approved_today: integer, rejected_today: integer }) }))), ...UNAUTH },
      },
    },
    "/api/v1/persetujuan/{id}": {
      get: { tags: ["Persetujuan"], summary: "Detail pengajuan", parameters: [idPath("ID pinjaman")], responses: { "200": resp("Detail", data(ref("Approval"))), "404": err("Pengajuan tidak ditemukan"), ...UNAUTH } },
      post: {
        tags: ["Persetujuan"], summary: "Putuskan pengajuan",
        description: "Butuh hak **ubah** pada modul `loan_approvals` (Owner). `approve`: status `aktif` + jadwal angsuran dibuat dari tanggal cair. `reject`: status `ditolak`, `notes` wajib.",
        parameters: [idPath("ID pinjaman")],
        requestBody: jsonBody(obj({ action: { type: "string", enum: ["approve", "reject"] }, notes: { type: "string", maxLength: 500 } }, ["action"])),
        responses: { "200": resp("Diputuskan", data(obj({ id: integer, loan_number: string, status: { type: "string", enum: ["aktif", "ditolak"] } }))), "404": err("Pengajuan tidak ditemukan"), "409": err("Sudah diputuskan"), "422": err("Alasan penolakan wajib diisi"), ...UNAUTH },
      },
    },
    "/api/v1/setoran": {
      get: {
        tags: ["Setoran"], summary: "Daftar setoran kas petugas",
        description: "Modul `deposit_receipts`. Yang `menunggu` tampil lebih dulu. `status` kosong = semua.",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["menunggu", "cocok", "selisih", "ditolak"] } },
          { name: "q", in: "query", description: "Cari nama petugas", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
        ],
        responses: { "200": resp("Setoran", data(arr(ref("Deposit")), obj({ page: integer, limit: integer, total: integer, summary: obj({ pending: integer, pending_amount: rp(), received_today: rp(), returned_today: rp() }) }))), ...UNAUTH },
      },
    },
    "/api/v1/setoran/{id}": {
      get: {
        tags: ["Setoran"], summary: "Detail setoran + pembayaran tunai yang disetor", parameters: [idPath("ID setoran")],
        responses: { "200": resp("Detail", data({ allOf: [ref("Deposit"), obj({ carried_amount: rp("Uang kembalian dari setoran sebelumnya yang ikut disetor"), payments: arr(obj({ id: integer, amount: rp(), paid_at: dateTime, member_name: string, loan_number: string, installment_sequence: integer })) })] })), "404": err("Setoran tidak ditemukan"), ...UNAUTH },
      },
      post: {
        tags: ["Setoran"], summary: "Terima atau tolak setoran",
        description: "Butuh hak **ubah** pada modul `deposit_receipts` (Admin). `approve`: `received_amount` (default = nilai setoran, maks. nilai setoran). Sama -> `cocok`; kurang -> `selisih` (`notes` wajib) dan selisihnya (`returned_amount`) kembali ke petugas. `reject`: status `ditolak`, `notes` wajib, seluruh nilai setoran kembali ke petugas. Uang yang dikembalikan masuk lagi ke uang tunai di tangan petugas dan ikut tersetor pada setoran berikutnya.",
        parameters: [idPath("ID setoran")],
        requestBody: jsonBody(obj({ action: { type: "string", enum: ["approve", "reject"] }, received_amount: { type: "integer", minimum: 1, description: "Hanya untuk approve" }, notes: { type: "string", maxLength: 500 } }, ["action"])),
        responses: { "200": resp("Diputuskan", data(obj({ id: integer, status: { type: "string", enum: ["cocok", "selisih", "ditolak"] }, received_amount: rp(), returned_amount: rp() }))), "404": err("Setoran tidak ditemukan"), "409": err("Sudah diputuskan"), "422": err("Jumlah melebihi setoran / catatan wajib"), ...UNAUTH },
      },
    },
    "/api/v1/petugas": {
      get: {
        tags: ["Referensi"],
        summary: "Daftar petugas lapangan aktif",
        description: `Role: ${ADMIN}.`,
        responses: { "200": resp("Petugas", data(arr(ref("Collector")))), ...UNAUTH },
      },
    },
    "/api/v1/petugas/tugas": {
      get: {
        tags: ["Petugas"],
        summary: "Tagihan yang ditugaskan kepada saya (hari ini atau sampai 4 hari ke depan)",
        description: "Role: Petugas (modul `my_tasks`). Hanya penugasan milik pengguna yang login; telat lebih dulu, yang sudah dibayar (menunggu verifikasi/lunas) di akhir. `date` kosong = hari ini; di luar hari ini s.d. 4 hari ke depan ditolak 422. `meta.upcoming` = jumlah tugas per hari untuk 4 hari ke depan (untuk tab).",
        parameters: [{ name: "date", in: "query", description: "Tanggal penugasan (YYYY-MM-DD); hari ini s.d. hari ini + 4", schema: { type: "string", format: "date" } }],
        responses: {
          "422": err("Tanggal di luar rentang"),
          "200": resp("Tugas", data(arr(obj({ id: integer, sequence: integer, due_date: date, total_amount: rp(), status: { type: "string", enum: ["belum", "menunggu_verifikasi", "lunas"] }, member_name: string, member_address: nullable(string), member_phone: nullable(string), region_name: string, loan_number: string, tenor_duration: integer, days_overdue: integer, promised_on: nullable(date), promise_reason: nullable(string) })), obj({ date, today: date, upcoming: arr(obj({ date, count: integer })), total: integer, done: integer, postponed: integer, amount_total: rp(), amount_done: rp(), methods: obj({ tunai: { type: "boolean" }, transfer: { type: "boolean" } }), bank: obj({ name: string, number: string, holder: string }) }))),
          ...UNAUTH,
        },
      },
    },
    "/api/v1/petugas/tugas/{id}/bayar": {
      post: {
        tags: ["Petugas"],
        summary: "Catat pembayaran angsuran (tunai / transfer)",
        description: "Role: Petugas (hak `create` pada `my_tasks`). `id` = angsuran yang ditugaskan kepada petugas hari ini. Nominal = total angsuran. Pembayaran berstatus `menunggu` dan angsuran menjadi `menunggu_verifikasi` sampai admin memverifikasi. Metode yang dinonaktifkan di pengaturan ditolak 422.",
        parameters: [idPath("ID angsuran")],
        requestBody: jsonBody(obj({ method: { type: "string", enum: ["tunai", "transfer"] }, method_note: { type: "string", maxLength: 100, description: "Wajib untuk transfer: bank / no. referensi" }, notes: { type: "string", maxLength: 300 } }, ["method"])),
        responses: { "201": resp("Pembayaran tercatat", data(obj({ id: integer, amount: rp(), method: string, status: { type: "string", example: "menunggu" } }))), "400": err("Data tidak valid"), "404": err("Tagihan tidak ada di tugas hari ini"), "409": err("Sudah dibayar / menunggu verifikasi"), "422": err("Metode dinonaktifkan / referensi transfer kosong"), ...UNAUTH },
      },
    },
    "/api/v1/petugas/tugas/{id}/tunda": {
      post: {
        tags: ["Petugas"],
        summary: "Tunda tagihan ke tanggal janji bayar",
        description: "Role: Petugas (hak `create` pada `my_tasks`). Tanggal janji harus setelah hari ini dan paling lama 30 hari ke depan. Tagihan ikut ditugaskan ke petugas yang sama pada tanggal janji; alasan dicatat di `payment_promises`.",
        parameters: [idPath("ID angsuran")],
        requestBody: jsonBody(obj({ promised_on: date, reason: { type: "string", minLength: 3, maxLength: 300 } }, ["promised_on", "reason"])),
        responses: { "201": resp("Tagihan ditunda", data(obj({ id: integer, promised_on: date }))), "400": err("Data tidak valid"), "404": err("Tagihan tidak ada di tugas hari ini"), "409": err("Sudah dibayar / menunggu verifikasi"), "422": err("Tanggal janji di luar batas"), ...UNAUTH },
      },
    },
    "/api/v1/petugas/setoran": {
      get: {
        tags: ["Petugas"],
        summary: "Uang tunai di tangan, rincian hari ini, riwayat setoran",
        description: "Role: Petugas (modul `my_deposits`). Uang di tangan = pembayaran tunai petugas yang belum disetor. `meta.deadline` = batas setor (pengaturan `deposit_deadline`).",
        responses: {
          "200": resp("Setoran kas", data(obj({
            cash_on_hand: obj({ amount: rp("Pembayaran tunai belum disetor + uang yang dikembalikan kasir"), count: integer, returned_amount: rp("Bagian yang dikembalikan kasir (setoran ditolak / selisih)") }), non_cash: obj({ amount: rp(), count: integer }),
            today: arr(obj({ id: integer, amount: rp(), method: { type: "string", enum: ["tunai", "transfer", "qris"] }, paid_at: dateTime, deposit_id: nullable(integer), member_name: string })),
            deposits: arr(obj({ id: integer, deposited_on: date, amount: rp(), payment_count: integer, status: { type: "string", enum: ["menunggu", "cocok", "selisih", "ditolak"] }, received_amount: nullable(rp()), returned_amount: rp(), notes: nullable(string), received_by_name: nullable(string) })),
          }), obj({ date, deadline: { type: "string", example: "17:00" } }))),
          ...UNAUTH,
        },
      },
      post: {
        tags: ["Petugas"],
        summary: "Setor seluruh uang tunai yang belum disetor",
        description: "Role: Petugas (hak `create` pada `my_deposits`). Tanpa body. Semua pembayaran tunai yang belum disetor, ditambah uang yang dikembalikan kasir, dikelompokkan menjadi satu setoran berstatus `menunggu` (diputuskan Admin lewat `/setoran/{id}`).",
        responses: { "201": resp("Setoran dibuat", data(obj({ id: integer, amount: rp(), payment_count: integer }))), "422": err("Tidak ada uang tunai yang perlu disetor"), ...UNAUTH },
      },
    },
    "/api/v1/petugas/profil": {
      get: {
        tags: ["Petugas"],
        summary: "Profil petugas dan capaian bulan ini",
        description: "Role: Petugas (modul `my_tasks`). Target dari pengaturan `collector_monthly_target`; collection rate = tertagih bulan ini / target (0–1).",
        responses: {
          "200": resp("Profil", data(obj({ id: integer, code: nullable(string), name: string, email: string, phone: nullable(string), status: string, joined_at: nullable(string), last_login_at: nullable(string), region_name: nullable(string), member_count: integer, month: { type: "string", example: "2026-11" }, collected: rp(), visits: integer, target: rp(), collection_rate: number, remaining: rp() }))),
          ...UNAUTH,
        },
      },
    },
    "/api/v1/petugas/profil/password": {
      post: {
        tags: ["Petugas"],
        summary: "Ganti password sendiri",
        description: "Role: Petugas (modul `my_tasks`). Password saat ini harus benar (422 bila salah atau password baru sama). Berhasil: semua sesi login pengguna diputus, klien harus masuk ulang.",
        requestBody: jsonBody(obj({ current_password: string, new_password: { ...string, minLength: 8, maxLength: 72 } }, ["current_password", "new_password"])),
        responses: {
          "200": resp("Password diganti", data(obj({ changed: { type: "boolean" } }))),
          "400": err("Data tidak valid"),
          "422": err("Password saat ini salah"),
          ...UNAUTH,
        },
      },
    },
  },

  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "koperasi_sesi", description: "Cookie sesi dari POST /auth/login (httpOnly)." },
      bearerAuth: { type: "http", scheme: "bearer", description: "Token dari POST /auth/login dengan `token: true` (untuk klien mobile/API)." },
    },
    schemas: {
      Error: obj(
        { error: obj({ message: { ...string, example: "Sesi berakhir, silakan masuk kembali" }, details: { type: "array", description: "Rincian validasi zod (hanya status 400)", items: { type: "object" } } }, ["message"]) },
        ["error"],
      ),
      Kolektibilitas: { type: "string", enum: KOL },
      Role: { type: "string", description: "Kode role (GET /role): bawaan owner, admin, petugas, anggota, atau role kustom", example: "admin" },
      User: obj(
        {
          id: { ...integer, example: 2 }, code: { ...nullable(string), example: "ADM-001" }, name: { ...string, example: "Rina Andayani" },
          email: { ...string, format: "email", example: "rina@koperasiku.id" }, role: ref("Role"), region_id: nullable(integer), region_name: nullable(string),
        },
        ["id", "name", "email", "role"],
      ),
      LoginRequest: obj(
        {
          email: { ...string, format: "email", maxLength: 120, example: "rina@koperasiku.id" },
          password: { ...string, minLength: 1, description: "Maks. 72 byte (batas bcrypt)" },
          remember: { type: "boolean", default: false, description: "true = sesi 30 hari (default 12 jam)" },
          token: { type: "boolean", default: false, description: "true = sertakan token Bearer di respons (klien mobile/API)" },
        },
        ["email", "password"],
      ),
      LoginResult: obj({
        user: obj({ id: { ...integer, example: 2 }, name: { ...string, example: "Rina Andayani" }, email: { ...string, example: "rina@koperasiku.id" }, role: ref("Role") }),
        home: { ...string, example: "/admin" },
        token: { ...string, description: "Hanya ada bila request memakai `token: true`" },
        token_type: { ...string, example: "Bearer" },
        expires_in: { ...integer, description: "Masa berlaku token (detik)", example: 43200 },
      }),

      Dashboard: obj({
        date: date,
        active: obj({ count: integer, outstanding: rp(), members: integer }),
        due_today: obj({ count: integer, amount: rp() }),
        paid_today: obj({ count: integer, amount: rp(), from_due: integer }),
        arrears: obj({ amount: rp(), members: integer, npl: { type: ["number", "null"], description: "Rasio NPL 0–1", example: 0.101 } }),
        flow: obj({ active_loans: integer, due: integer, reminders: integer, payments: integer, verifications: integer, paid_off: integer, follow_up: integer }),
        pending: arr(obj({ id: integer, amount: rp(), method: string, method_note: nullable(string), paid_at: dateTime, installment_sequence: integer, tenor_duration: integer, tenor_unit: { type: "string", enum: ["bulan", "hari"] }, loan_number: string, member_name: string, collector_name: nullable(string) })),
        collectors: arr(obj({ id: integer, name: string, region_name: string, tasks: integer, completed: integer, collected: rp() })),
      }),

      Deposit: obj({
        id: integer, deposited_on: date, amount: rp("Nilai yang disetor petugas"), payment_count: integer, status: { type: "string", enum: ["menunggu", "cocok", "selisih", "ditolak"] },
        received_amount: nullable(rp("Uang yang diterima Admin (null selama menunggu)")), returned_amount: rp("Dikembalikan ke petugas (selisih, atau seluruhnya bila ditolak)"),
        notes: nullable(string), decided_at: nullable(dateTime), collector_name: string, received_by_name: nullable(string),
      }),
      LoanSummary: obj({
        id: integer, loan_number: { ...string, example: "PJ-25-0516" }, member_id: integer, member_name: string, member_number: string, region_name: string,
        principal_amount: rp("Plafon: batas atas pinjaman (snapshot pengaturan loan_ceiling saat pinjaman dibuat)"), loan_amount: rp("Jumlah pinjaman yang diinput; dasar angsuran, jasa, dan biaya admin"),
        tenor_duration: integer, tenor_unit: { type: "string", enum: ["bulan", "hari"] }, installment_amount: rp("Angsuran per bulan/hari (mengikuti tenor_unit)"), next_due_date: nullable(date), remaining_balance: rp("Sisa pinjaman"),
        paid_installments: integer, days_overdue: { ...integer, description: "Hari keterlambatan angsuran tertua yang belum dibayar (0 = tidak telat)" }, collectibility: ref("Kolektibilitas"),
      }),
      Installment: obj({
        id: integer, sequence: integer, due_date: date, principal_amount: rp(), interest_amount: rp(), total_amount: rp(),
        status: { type: "string", enum: ["belum", "menunggu_verifikasi", "lunas"] }, paid_at: nullable(dateTime),
      }),
      LoanDetail: {
        allOf: [
          ref("LoanSummary"),
          obj({
            purpose: nullable(string), collateral: nullable(string), disbursed_on: nullable(date), interest_rate_percent: { ...number, description: "% flat per bulan/hari (mengikuti tenor_unit), diambil dari master tenor", example: 1.5 },
            arrears_amount: rp("Total angsuran yang sudah lewat jatuh tempo"), status: { type: "string", enum: ["pengajuan", "aktif", "lunas", "ditolak"] },
            installments: arr(ref("Installment")),
          }),
        ],
      },
      NewLoan: obj(
        {
          member_id: { ...integer, minimum: 1 },
          loan_amount: { type: "integer", minimum: 500000, maximum: 500000000, example: 10000000, description: "Jumlah pinjaman. Tidak boleh melebihi plafon (pengaturan loan_ceiling, 422), kecuali pengguna Owner bila pengaturan loan_ceiling_owner_override aktif" },
          tenor_id: { ...integer, minimum: 1, description: "ID master tenor (GET /tenor). Lama, satuan (bulan/hari), dan persen jasa diambil dari tenor ini" },
          admin_fee: { type: "integer", minimum: 0, default: 0, description: "Biaya admin (Rp); harus lebih kecil dari jumlah pinjaman. Perlakuannya (pengurang dana cair / penambah pokok) mengikuti Sistem › Pengaturan dan dicatat di pinjaman sebagai admin_fee_mode", example: 200000 },
          purpose: { type: "string", minLength: 3, maxLength: 120, example: "Modal usaha" },
          collateral: { type: "string", maxLength: 120, example: "BPKB motor" },
          disbursed_on: { ...date, description: "Jatuh tempo angsuran ke-n = tanggal ini + n bulan (tenor bulanan) atau + n hari (tenor harian)" },
        },
        ["member_id", "loan_amount", "tenor_id", "purpose", "disbursed_on"],
      ),

      MemberSummary: obj({
        id: integer, member_number: { ...string, example: "AG-0412" }, name: string, phone: string, joined_on: date, status: { type: "string", enum: ["aktif", "nonaktif"] }, region_name: string,
        total_savings: rp("Pokok + wajib + sukarela"), active_loans: integer, remaining_balance: rp(), arrears_amount: rp(),
        status_label: { type: "string", enum: ["Aktif", "Menunggak", "Baru", "Nonaktif"] },
      }),
      NewMember: obj(
        {
          name: { type: "string", minLength: 2, maxLength: 100, example: "Siti Aminah" },
          national_id: { type: "string", pattern: "^\\d{16}$", example: "3273010101900001", description: "NIK, 16 digit, unik" },
          phone: { type: "string", pattern: "^[0-9+\\- ]{8,20}$", example: "0812-2233-4410" },
          address: { type: "string", minLength: 5, maxLength: 200, example: "Jl. Cikutra No. 12, RT 03/05" },
          region_id: { ...integer, minimum: 1 },
          principal_savings: { type: "integer", minimum: 0, default: 0 },
          biodata: ref("Biodata"),
          biodata_source: { type: "string", enum: ["manual", "ocr"], default: "manual" },
          allow_partial_payment: { type: ["boolean", "null"], default: null, description: "Izin bayar sebagian anggota ini: null = ikuti pengaturan partial_payment_enabled, true/false = timpa" },
        },
        ["name", "national_id", "phone", "address", "region_id"],
      ),
      UpdateMember: obj({
        name: { type: "string", minLength: 2, maxLength: 100 },
        national_id: { type: "string", pattern: "^\\d{16}$", description: "NIK, 16 digit, unik" },
        phone: { type: "string", pattern: "^[0-9+\\- ]{8,20}$" },
        address: { type: "string", minLength: 5, maxLength: 200 },
        region_id: { ...integer, minimum: 1 },
        status: { type: "string", enum: ["aktif", "nonaktif"] },
        biodata: ref("Biodata"),
        biodata_source: { type: "string", enum: ["manual", "ocr"] },
        allow_partial_payment: { type: ["boolean", "null"], description: "null = ikuti pengaturan umum (partial_payment_enabled)" },
      }),
      MemberDetail: obj({
        id: integer, member_number: { ...string, example: "AG-1044" }, name: string, national_id: { type: ["string", "null"] }, phone: string, address: string,
        region_id: integer, region_name: string, joined_on: date, status: { type: "string", enum: ["aktif", "nonaktif"] },
        biodata: ref("Biodata"), has_id_card: { type: "boolean", description: "Foto KTP sudah diunggah (ambil lewat GET /anggota/{id}/ktp)" },
        allow_partial_payment: { type: ["boolean", "null"], description: "Izin bayar sebagian anggota ini (null = ikuti pengaturan umum)" },
        created_at: dateTime, updated_at: dateTime,
        created_by_name: { type: ["string", "null"], description: "Nama pengguna created_by" }, updated_by_name: { type: ["string", "null"], description: "Nama pengguna updated_by" },
        loans: arr(obj({ id: integer, loan_number: string, principal_amount: rp("Plafon"), loan_amount: rp("Jumlah pinjaman"), tenor_duration: integer, tenor_unit: { type: "string", enum: ["bulan", "hari"] }, installment_amount: rp(), status: string, remaining_balance: rp(), arrears_amount: rp(), collectibility: ref("Kolektibilitas") })),
      }),
      Region: obj({ id: integer, name: string, member_count: { ...integer, description: "Anggota aktif di wilayah ini" }, user_count: { ...integer, description: "Pengguna di wilayah ini" }, created_at: dateTime, updated_at: dateTime, created_by_name: nullable(string), updated_by_name: nullable(string) }),
      Tenor: obj({ id: integer, duration: { ...integer, example: 12 }, unit: { type: "string", enum: ["bulan", "hari"] }, interest_rate_percent: { ...number, description: "Jasa flat (%) per bulan/hari mengikuti satuan", example: 1.5 }, label: nullable(string), is_active: { type: "boolean" }, sort_order: integer, loan_count: { ...integer, description: "Hanya di detail" } }),
      Setting: obj({
        id: integer, key: { ...string, example: "admin_fee_mode" }, group_name: { ...string, example: "Pinjaman" }, label: string, description: nullable(string),
        value_type: { type: "string", enum: ["text", "number", "boolean", "select"] }, value: { description: "Nilai saat ini (tipe mengikuti value_type)" },
        config: { type: "object", description: "select: options[{value,label}]; number: min,max,step,prefix,suffix; text: max_length, pattern (regex) + pattern_hint", additionalProperties: true },
        sort_order: integer, updated_at: dateTime, updated_by_name: nullable(string),
      }),
      TenorInput: obj({ duration: { type: "integer", minimum: 1, maximum: 365, description: "Bulan (maks. 60) atau hari (maks. 365) sesuai unit", example: 12 }, unit: { type: "string", enum: ["bulan", "hari"], default: "bulan" }, interest_rate_percent: { type: "number", minimum: 0, maximum: 100, default: 1.5 }, label: { type: "string", maxLength: 40 }, is_active: { type: "boolean", default: true }, sort_order: { type: "integer", minimum: 0, maximum: 999, default: 0 } }, ["duration"]),
      PermissionMatrix: { type: "object", description: "Peta modul → aksi yang diizinkan. Modul: dashboard, members, loans, loan_approvals, due_dates, payments, assignments, reminders, reports, regions, tenors, users, roles, activity_logs.", additionalProperties: arr({ type: "string", enum: ["view", "create", "update", "delete"] }), example: { members: ["view", "create"], loans: ["view"] } },
      RoleSummary: obj({ id: integer, code: string, name: string, description: nullable(string), area: { type: "string", enum: ["admin", "owner", "petugas", "anggota"] }, is_system: { type: "boolean" }, user_count: integer, module_count: integer }),
      RoleDetail: obj({ id: integer, code: string, name: string, description: nullable(string), area: string, is_system: { type: "boolean" }, user_count: integer, permissions: ref("PermissionMatrix"), created_at: dateTime, updated_at: dateTime, created_by_name: nullable(string), updated_by_name: nullable(string) }),
      NewRole: obj({ code: { type: "string", pattern: "^[a-z][a-z0-9_]{2,29}$", example: "supervisor" }, name: { type: "string", minLength: 2, maxLength: 60 }, description: { type: "string", maxLength: 200 }, area: { type: "string", enum: ["admin", "owner", "petugas", "anggota"] } }, ["code", "name", "area"]),
      User2: obj({ id: integer, code: nullable(string), name: string, email: string, phone: nullable(string), role: string, role_name: string, region_name: nullable(string), status: { type: "string", enum: ["aktif", "nonaktif"] }, last_login_at: nullable(dateTime) }),
      UserDetail: obj({ id: integer, code: nullable(string), name: string, email: string, phone: nullable(string), role: string, role_name: string, region_id: nullable(integer), region_name: nullable(string), status: string, last_login_at: nullable(dateTime), created_at: dateTime, updated_at: dateTime, created_by_name: nullable(string), updated_by_name: nullable(string) }),
      NewUser: obj({
        code: { type: "string", maxLength: 20 }, name: { type: "string", minLength: 2, maxLength: 100 }, email: { ...string, format: "email" }, phone: { type: "string", maxLength: 20 },
        role: { ...string, description: "Kode role (GET /role)" }, region_id: nullable(integer), status: { type: "string", enum: ["aktif", "nonaktif"], default: "aktif" },
        password: { type: "string", minLength: 8, description: "Maks. 72 byte" },
      }, ["name", "email", "role", "password"]),
      ActivityLog: obj({
        id: integer, user_id: nullable(integer), user_name: nullable(string), action: { ...string, example: "update" }, module: nullable(string), entity_id: nullable(integer), method: nullable(string), path: nullable(string),
        status_code: nullable(integer), ip: nullable(string), user_agent: nullable(string), details: { type: ["object", "null"], description: "{ fields: [nama kolom] } atau { email } untuk login gagal" }, created_at: dateTime,
      }),
      Approval: obj({
        id: integer, loan_number: string, member_id: integer, member_name: string, member_number: string, region_name: string, principal_amount: rp("Plafon"), loan_amount: rp("Jumlah pinjaman"), tenor_duration: integer, tenor_unit: { type: "string", enum: ["bulan", "hari"] }, admin_fee: rp("Biaya admin"), installment_amount: rp(),
        interest_rate_percent: number, purpose: nullable(string), collateral: nullable(string), disbursed_on: nullable(date), status: string, created_at: dateTime, submitted_by_name: nullable(string),
        decided_by_name: nullable(string), decided_at: nullable(dateTime), decision_notes: nullable(string), member_active_loans: integer, member_outstanding: rp(),
      }),
      Biodata: obj({
        name: string, place_of_birth: string, date_of_birth: { ...string, format: "date" }, gender: { ...string, example: "LAKI-LAKI" }, blood_type: string,
        address: string, rt_rw: { ...string, example: "003/005" }, village: string, district: string, religion: string, marital_status: string,
        occupation: string, nationality: { ...string, example: "WNI" }, valid_until: string,
      }),

      DueInstallment: obj({
        id: { ...integer, description: "ID angsuran" }, loan_id: integer, sequence: integer, tenor_duration: integer, due_date: date, total_amount: rp(), status: { type: "string", enum: ["belum", "menunggu_verifikasi", "lunas"] },
        loan_number: string, member_name: string, region_name: string, collector_name: nullable(string), days_overdue: integer,
        reminder_channel: nullable(string), reminder_status: nullable({ type: "string", enum: ["terkirim", "dibaca", "gagal"] }),
      }),

      PaymentSummary: obj({
        id: integer, amount: rp("Nominal + denda"), method: { type: "string", enum: ["tunai", "transfer", "qris"] }, method_note: nullable(string), paid_at: dateTime,
        status: { type: "string", enum: ["menunggu", "terverifikasi", "ditolak"] }, member_name: string, loan_number: string, installment_sequence: integer, tenor_duration: integer, tenor_unit: { type: "string", enum: ["bulan", "hari"] }, collector_name: nullable(string),
        verify_block: { type: "string", nullable: true, enum: ["belum_disetor", "setoran_menunggu", "setoran_ditolak", null], description: "Alasan pembayaran tunai petugas belum boleh diverifikasi (null = boleh)" },
      }),
      PaymentDetail: obj({
        id: integer, amount: rp(), penalty_amount: rp(), installment_total: rp("Total angsuran"), method: string, method_note: nullable(string), paid_at: dateTime,
        proof_image: nullable(string), location_name: nullable(string), lat: nullable(number), lng: nullable(number), notes: nullable(string),
        status: { type: "string", enum: ["menunggu", "terverifikasi", "ditolak"] }, verification_notes: nullable(string), verified_at: nullable(dateTime), verifier_name: nullable(string),
        installment_sequence: integer, tenor_duration: integer, tenor_unit: { type: "string", enum: ["bulan", "hari"] }, due_date: date, installment_status: string, loan_id: integer, loan_number: string, member_name: string, member_address: string, region_name: string, collector_name: nullable(string),
        verify_block: { type: "string", nullable: true, enum: ["belum_disetor", "setoran_menunggu", "setoran_ditolak", null], description: "Alasan pembayaran tunai petugas belum boleh diverifikasi (null = boleh)" },
        remaining_balance: rp(), balance_before: rp("Sisa pinjaman sebelum verifikasi"), balance_after: rp("Sisa pinjaman setelah verifikasi"),
      }),
      VerifyRequest: obj(
        { action: { type: "string", enum: ["verify", "reject"] }, notes: { type: "string", maxLength: 500, description: "Wajib bila `action` = reject" } },
        ["action"],
      ),

      Assignments: obj({
        date: date,
        unassigned: arr(obj({ id: { ...integer, description: "ID angsuran" }, loan_id: integer, sequence: integer, due_date: date, total_amount: rp(), member_name: string, member_address: string, region_id: integer, region_name: string, loan_number: string })),
        collectors: arr(obj({
          id: integer, code: nullable(string), name: string, region_id: nullable(integer), region_name: nullable(string), load: integer, max_load: { ...integer, example: 30 },
          tasks: arr(obj({ collector_id: integer, installment_id: integer, total_amount: rp(), member_name: string })),
        })),
      }),
      AssignRequest: obj(
        { date: date, collector_id: { ...integer, minimum: 1 }, installment_ids: { type: "array", items: integer, minItems: 1, maxItems: 200, description: "ID angsuran yang berstatus `belum`" } },
        ["date", "collector_id", "installment_ids"],
      ),
      Collector: obj({ id: integer, code: nullable(string), name: string, phone: nullable(string), region_id: nullable(integer), region_name: nullable(string) }),

      Reminders: obj({
        channels: arr(obj({ code: { type: "string", enum: ["whatsapp", "sms", "telepon", "surat"] }, name: string, description: nullable(string), is_active: { type: "boolean" } })),
        rules: arr(obj({ id: integer, day_offset: { ...integer, description: "-3 = H-3, 0 = hari H, 7 = H+7" }, title: string, description: nullable(string) })),
        templates: arr(obj({ code: { type: "string", enum: ["H-3", "H-1", "HARI_H", "TELAT"] }, channel: string, body: string })),
        stats: obj({ sent: integer, read: integer, failed: integer }),
        logs: arr(obj({ id: integer, channel: string, status: { type: "string", enum: ["terkirim", "dibaca", "gagal"] }, sent_at: dateTime, notes: nullable(string), member_name: string })),
      }),
      SendReminderRequest: obj({
        installment_ids: { type: "array", items: integer, minItems: 1, maxItems: 500 },
        all_due: { type: "boolean", description: "true = semua angsuran belum bayar yang jatuh tempo s.d. hari ini" },
        channel: { type: "string", enum: ["whatsapp", "sms"], default: "whatsapp" },
      }),

      CollectionReport: obj({
        kpi: obj({ billed_count: integer, billed_amount: rp(), paid_count: integer, collected_amount: rp(), arrears_count: integer, arrears_amount: rp() }),
        per_collector: arr(obj({ id: integer, name: string, region_name: string, billed: integer, paid: integer, collected: rp(), arrears: rp() })),
        methods: arr(obj({ method: { type: "string", enum: ["tunai", "transfer", "qris"] }, count: integer, amount: rp() })),
        daily: arr(obj({ date: date, amount: rp() })),
        aging: arr(obj({ bucket: { type: "string", enum: ["1–30 hari", "31–60 hari", "61–90 hari", "> 90 hari"] }, members: integer, amount: rp() })),
        follow_up: obj({ phone_call: { ...integer, description: "H+3 s.d. H+6" }, letter_1: { ...integer, description: "H+7 s.d. H+29" }, letter_2: { ...integer, description: "H+30 s.d. 90 hari" }, escalation: { ...integer, description: "> 90 hari" } }),
      }),
    },
  },
} as const;
