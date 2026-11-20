/** Biodata dari KTP (disimpan di anggota.biodata). Semua opsional: OCR tidak selalu menemukan tiap kolom. */
export type Biodata = {
  name?: string;
  place_of_birth?: string;
  date_of_birth?: string; // YYYY-MM-DD
  gender?: string;
  blood_type?: string;
  address?: string;
  rt_rw?: string;
  village?: string;
  district?: string;
  religion?: string;
  marital_status?: string;
  occupation?: string;
  nationality?: string;
  valid_until?: string;
};

export type HasilKtp = { national_id: string | null; biodata: Biodata };

export const KOLOM_BIODATA = [
  "name", "place_of_birth", "date_of_birth", "gender", "blood_type", "address", "rt_rw",
  "village", "district", "religion", "marital_status", "occupation", "nationality", "valid_until",
] as const satisfies readonly (keyof Biodata)[];

// ---------- utilitas teks (OCR sering salah baca huruf, jadi pencocokan dibuat toleran) ----------
/** Huruf yang sering salah dibaca OCR di tempat angka. */
const SALAH_ANGKA: Record<string, string> = { O: "0", o: "0", D: "0", Q: "0", I: "1", l: "1", "|": "1", "!": "1", i: "1", Z: "2", z: "2", S: "5", s: "5", B: "8", b: "6", G: "6", g: "9", T: "7" };
const keAngka = (s: string) => s.replace(/[A-Za-z|!]/g, (c) => SALAH_ANGKA[c] ?? "");

function jarak(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Kemiripan 0..1 antara dua teks (hanya huruf, tanpa peduli kapital). */
const huruf = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
function mirip(a: string, b: string): number {
  const x = huruf(a), y = huruf(b);
  if (!x || !y) return 0;
  return 1 - jarak(x, y) / Math.max(x.length, y.length);
}

/** Skor kasar "seberapa mirip teks ini dengan KTP" = jumlah label KTP berbeda yang terbaca (untuk memilih orientasi foto). */
const KATA_KUNCI = ["nik", "nama", "alamat", "agama", "pekerjaan", "kewarganegaraan", "berlaku", "provinsi", "tempat", "perkawinan", "kelamin", "kabupaten", "kecamatan"];
export function skorKtp(teks: string): number {
  const t = teks.toLowerCase();
  return KATA_KUNCI.filter((k) => t.includes(k)).length;
}

// ---------- label KTP ----------
type Label = { kolom: keyof Biodata; label: string; maksKata: number; ambang: number };
const LABEL: Label[] = [
  { kolom: "name", label: "nama", maksKata: 1, ambang: 0.74 },
  { kolom: "place_of_birth", label: "tempattgllahir", maksKata: 4, ambang: 0.7 },
  { kolom: "gender", label: "jeniskelamin", maksKata: 2, ambang: 0.7 },
  { kolom: "address", label: "alamat", maksKata: 1, ambang: 0.65 },
  { kolom: "rt_rw", label: "rtrw", maksKata: 2, ambang: 0.74 },
  { kolom: "village", label: "keldesa", maksKata: 2, ambang: 0.7 },
  { kolom: "district", label: "kecamatan", maksKata: 1, ambang: 0.7 },
  { kolom: "religion", label: "agama", maksKata: 1, ambang: 0.7 },
  { kolom: "marital_status", label: "statusperkawinan", maksKata: 3, ambang: 0.7 },
  { kolom: "occupation", label: "pekerjaan", maksKata: 1, ambang: 0.7 },
  { kolom: "nationality", label: "kewarganegaraan", maksKata: 1, ambang: 0.7 },
  { kolom: "valid_until", label: "berlakuhingga", maksKata: 3, ambang: 0.7 },
];

/** Cari label di awal baris (boleh didahului sampah OCR) -> sisa baris setelah label. */
function ambilNilai(baris: string, l: Label): { sisa: string; skor: number } | null {
  const tok = baris.split(/\s+/).filter(Boolean);
  let terbaik: { sisa: string; skor: number } | null = null;
  for (let i = 0; i < Math.min(tok.length, 6); i++) {
    for (let k = 1; k <= l.maksKata && i + k <= tok.length; k++) {
      const gabung = tok.slice(i, i + k).join("");
      if (huruf(gabung).length < 3) continue; // token pendek tanpa huruf ("5", "—") bukan label
      const skor = mirip(gabung, l.label);
      if (skor >= l.ambang && (!terbaik || skor > terbaik.skor)) terbaik = { sisa: tok.slice(i + k).join(" "), skor };
    }
  }
  return terbaik;
}

const SAMPAH_AWAL = /^[\s:;.,\-–—_"'“”‘’=~`|]+/;
/** Buang pemisah di depan & potongan sampah OCR di belakang (pecahan huruf kecil pendek, simbol, angka sepotong). */
function rapikan(v: string): string {
  const tok = v.replace(SAMPAH_AWAL, "").split(/\s+/).filter(Boolean);
  while (tok.length > 1 && tok[0].length === 1) tok.shift(); // serpihan satu karakter di depan nilai
  while (tok.length) {
    const t = tok[tok.length - 1];
    const sampah = !/[A-Za-z0-9]/.test(t) || (t.length <= 2 && !/^[A-Z]{2}$/.test(t) && !/^\d{2}$/.test(t)) || (t.length <= 4 && /[a-z]/.test(t) && !/^[A-Z]/.test(t));
    if (!sampah) break;
    tok.pop();
  }
  return tok.join(" ").replace(/[—–"“”_|=~`]+/g, " ").replace(/[\s:;.,\-]+$/, "").replace(/\s+/g, " ").trim();
}

/** Samakan nilai pilihan terbatas dengan daftar resmi (mis. "ISEAM" -> "ISLAM"); tidak cocok -> null (dilewati). */
function pilih(nilai: string, daftar: string[], ambang = 0.6): string | null {
  let terbaik: [string, number] = ["", 0];
  for (const d of daftar) for (const w of [nilai, ...nilai.split(/\s+/)]) {
    const m = mirip(w, d);
    if (m > terbaik[1]) terbaik = [d, m];
  }
  return terbaik[1] >= ambang ? terbaik[0] : null;
}
const AGAMA = ["ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA", "KONGHUCU"];
const KAWIN = ["BELUM KAWIN", "KAWIN", "CERAI HIDUP", "CERAI MATI"];
const JK = ["LAKI-LAKI", "PEREMPUAN"];
const WN = ["WNI", "WNA"];

function tanggalIso(s: string): string | undefined {
  const m = /(\d{1,2})\s*[-/. ]\s*(\d{1,2})\s*[-/. ]\s*(\d{4})/.exec(keAngka(s));
  if (!m) return;
  const [, d, b, t] = m;
  const bln = Number(b), hr = Number(d), thn = Number(t);
  if (bln < 1 || bln > 12 || hr < 1 || hr > 31 || thn < 1900 || thn > 2100) return;
  return `${t}-${String(bln).padStart(2, "0")}-${String(hr).padStart(2, "0")}`;
}

export function parseSatu(teks: string): Biodata {
  const baris = teks.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
  const b: Biodata = {};
  const sudah = new Set<string>();
  for (const br of baris) {
    // satu baris hanya cocok dengan satu label: yang paling mirip (mis. "ama:" lebih cocok ke "alamat" bila "nama" sudah terisi)
    let pilihan: { l: Label; sisa: string; skor: number } | null = null;
    for (const l of LABEL) {
      if (sudah.has(l.kolom)) continue;
      const c = ambilNilai(br, l);
      if (c && (!pilihan || c.skor > pilihan.skor)) pilihan = { l, ...c };
    }
    if (pilihan) {
      const { l, sisa } = pilihan;
      const v = rapikan(l.kolom === "name" ? sisa.replace(/\|/g, "I") : sisa); // "SUPRIAD|" -> "SUPRIADI"
      let hasil: string | undefined;
      switch (l.kolom) {
        case "name": hasil = v.replace(/\|/g, "I").replace(/[^A-Za-z.,' ]/g, "").replace(/\s+/g, " ").trim().toUpperCase() || undefined; break;
        case "place_of_birth": {
          const tgl = tanggalIso(sisa);
          if (tgl) b.date_of_birth = tgl;
          hasil = rapikan(v.replace(/\d.*$/, "")).replace(/[^A-Za-z .'-]/g, "").trim().toUpperCase() || undefined;
          break;
        }
        case "gender": hasil = pilih(v, JK) ?? undefined; break;
        case "religion": hasil = pilih(v, AGAMA) ?? undefined; break;
        case "marital_status": hasil = pilih(v, KAWIN, 0.55) ?? undefined; break;
        case "nationality": hasil = pilih(v, WN, 0.6) ?? undefined; break;
        case "valid_until": hasil = mirip(v, "seumur hidup") >= 0.5 || /seumur/i.test(v) ? "SEUMUR HIDUP" : tanggalIso(v); break;
        case "rt_rw": { const m = /(\d{3})\s*\/\s*(\d{3})/.exec(keAngka(v)); hasil = m ? `${m[1]}/${m[2]}` : undefined; break; }
        default: hasil = v.replace(/[^A-Za-z0-9 .,/'-]/g, "").trim().toUpperCase() || undefined;
      }
      if (hasil && hasil.length >= 2) { (b as Record<string, string>)[l.kolom] = hasil; sudah.add(l.kolom); }
    }
  }
  const gol = /(?:gol\w*\.?\s*)?dara\w?\s*[:;]?\s*([ABO]{1,2}[+-]?)\b/i.exec(teks);
  if (gol) b.blood_type = gol[1].toUpperCase();
  return b;
}

// ---------- NIK ----------
/** 16 digit NIK pada teks (toleran terhadap salah baca huruf↔angka dan spasi). */
export function cariNik(teks: string): string | null {
  const calon = (s: string) => {
    const d = keAngka(s.replace(/[\s.:\-“”"']/g, ""));
    return /\d{16}/.exec(d)?.[0] ?? null;
  };
  const baris = teks.split(/\r?\n/);
  for (const b of baris) if (/\bN\s*I\s*K\b/i.test(b)) { const n = calon(b.replace(/^.*?N\s*I\s*K/i, "")); if (n) return n; }
  for (const b of baris) if ((b.match(/[0-9OoIl|DSB]/g)?.length ?? 0) >= 15) { const n = calon(b); if (n) return n; }
  return null;
}

/** Digit 7–12 NIK = tanggal lahir (DDMMYY; perempuan: tanggal + 40). Dipakai untuk memeriksa hasil OCR. */
function cocokTanggal(nik: string, tgl?: string, jk?: string): boolean {
  if (!tgl) return true;
  const [y, m, d] = tgl.split("-");
  const dd = String(Number(d) + (jk === "PEREMPUAN" ? 40 : 0)).padStart(2, "0");
  return nik.slice(6, 12) === `${dd}${m}${y.slice(2)}`;
}

// ---------- gabungan beberapa hasil baca ----------
const modus = <T,>(xs: T[]): T | undefined => {
  const n = new Map<T, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; // seri -> yang pertama muncul
};

/** Gabungkan beberapa hasil OCR (pengolahan gambar berbeda): per kolom ambil nilai terbanyak; kolom tak terbaca dilewati. */
export function parseKtpBanyak(teks: string[]): HasilKtp {
  // pengolahan yang menemukan kolom terbanyak didahulukan, jadi menang saat suara seri
  const hasil = teks.map(parseSatu).sort((a, b) => Object.keys(b).length - Object.keys(a).length);
  const biodata: Biodata = {};
  for (const k of KOLOM_BIODATA) {
    const v = modus(hasil.map((h) => h[k]).filter((x): x is string => !!x));
    if (v) biodata[k] = v;
  }
  const kandidat = teks.map(cariNik).filter((n): n is string => !!n);
  const sah = kandidat.filter((n) => cocokTanggal(n, biodata.date_of_birth, biodata.gender));
  // tanpa tanggal lahir sebagai pembanding, hanya terima NIK yang dibaca sama oleh minimal dua pengolahan
  const nik = biodata.date_of_birth ? modus(sah) : kandidat.length > 1 ? modus(kandidat.filter((n, i) => kandidat.indexOf(n) !== i)) : kandidat[0];
  return { national_id: nik ?? null, biodata };
}

export const parseKtp = (teks: string): HasilKtp => parseKtpBanyak([teks]);
