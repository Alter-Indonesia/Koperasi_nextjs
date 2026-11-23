/** Isi kwitansi (dipakai tampilan, gambar PNG, dan pesan WhatsApp). */
export type ReceiptDoc = {
  heading: string; // mis. "KWITANSI PELUNASAN DIPERCEPAT"
  code: string; // kode bukti (teks di bawah QR; dicari Admin)
  publicId: string; // UUID publik; QR berisi tautan /bukti/{publicId}
  rows: [string, string][];
  totalLabel: string;
  total: string; // sudah diformat (rupiah)
  footer: string;
};

const LEBAR = 420;
const SKALA = 2;
const PAD = 24;

function bungkus(ctx: CanvasRenderingContext2D, teks: string, lebar: number) {
  const baris: string[] = [];
  let cur = "";
  for (const kata of teks.split(" ")) {
    const coba = cur ? `${cur} ${kata}` : kata;
    if (ctx.measureText(coba).width > lebar && cur) { baris.push(cur); cur = kata; } else cur = coba;
  }
  if (cur) baris.push(cur);
  return baris;
}

/** Menggambar kwitansi ke gambar PNG (warna diambil dari token tema yang aktif). */
export async function receiptPng(doc: ReceiptDoc, qrDataUrl: string): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  const warna = (n: string) => css.getPropertyValue(n).trim();
  const [fg, muted, garis, kanvas, kartu] = [warna("--fg-default"), warna("--fg-muted"), warna("--line-default"), warna("--bg-canvas"), warna("--bg-card")];
  const fam = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const qr = await new Promise<HTMLImageElement>((ok, gagal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = gagal; i.src = qrDataUrl; });

  const tinggi = 500 + doc.rows.length * 26 + 90;
  const c = document.createElement("canvas");
  c.width = LEBAR * SKALA;
  c.height = tinggi * SKALA;
  const ctx = c.getContext("2d")!;
  ctx.scale(SKALA, SKALA);
  ctx.fillStyle = kartu;
  ctx.fillRect(0, 0, LEBAR, tinggi);

  let y = PAD + 22;
  ctx.textAlign = "center";
  ctx.fillStyle = fg;
  ctx.font = `700 20px ${fam}`;
  ctx.fillText("KoperasiKu", LEBAR / 2, y);
  y += 20;
  ctx.fillStyle = muted;
  ctx.font = `700 11px ${fam}`;
  ctx.fillText(doc.heading.split("").join(" ").replace(/ {2,}/g, "   "), LEBAR / 2, y);
  y += 16;
  const garisPutus = () => { ctx.strokeStyle = garis; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(LEBAR - PAD, y); ctx.stroke(); ctx.setLineDash([]); };
  garisPutus();
  y += 16;
  ctx.drawImage(qr, (LEBAR - 192) / 2, y, 192, 192);
  y += 192 + 22;
  ctx.fillStyle = fg;
  ctx.font = `700 14px ${fam}`;
  ctx.fillText(doc.code, LEBAR / 2, y);
  y += 16;
  garisPutus();
  y += 24;

  for (const [a, b] of doc.rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = muted;
    ctx.font = `13px ${fam}`;
    ctx.fillText(a, PAD, y);
    ctx.textAlign = "right";
    ctx.fillStyle = fg;
    let ukuran = 13;
    ctx.font = `700 ${ukuran}px ${fam}`;
    while (ctx.measureText(b).width > LEBAR - PAD * 2 - 120 && ukuran > 9) ctx.font = `700 ${--ukuran}px ${fam}`;
    ctx.fillText(b, LEBAR - PAD, y);
    y += 26;
  }
  y += 6;
  ctx.fillStyle = kanvas;
  ctx.beginPath();
  ctx.roundRect(PAD, y, LEBAR - PAD * 2, 52, 10);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = fg;
  ctx.font = `700 14px ${fam}`;
  ctx.fillText(doc.totalLabel, PAD + 16, y + 31);
  ctx.textAlign = "right";
  ctx.font = `700 20px ${fam}`;
  ctx.fillText(doc.total, LEBAR - PAD - 16, y + 32);
  y += 52 + 26;
  ctx.textAlign = "center";
  ctx.fillStyle = muted;
  ctx.font = `12px ${fam}`;
  for (const baris of bungkus(ctx, doc.footer, LEBAR - PAD * 2)) {
    ctx.fillText(baris, LEBAR / 2, y);
    y += 18;
  }
  return new Promise((ok, gagal) => c.toBlob((b) => (b ? ok(b) : gagal(new Error("Gagal membuat gambar"))), "image/png"));
}
