/**
 * Fındık İşleme Modülü — ESC/POS etiket üreticisi.
 *
 * Nimbot B1 (50×50 mm) ve geniş termal rulo (80×70 mm) etiketleri için ham
 * ESC/POS bayt dizisi üretir. Modül bilinçli olarak "saf"tır: veritabanına,
 * dosya sistemine veya ağa dokunmaz; bu sayede birim testlerinde bayt bayt
 * doğrulanabilir.
 *
 * Kullanılan komut kümesi Epson ESC/POS referansına göredir:
 *   ESC @        yazıcıyı sıfırla
 *   ESC t n      kod sayfası seç (13 = PC857 Türkçe)
 *   ESC a n      hizalama (0 sol, 1 orta, 2 sağ)
 *   GS  ! n      karakter genişlik/yükseklik çarpanı
 *   ESC E n      kalın (bold)
 *   GS  B n      beyaz/siyah ters baskı
 *   ESC d n      yaz ve n satır besle
 *   GS ( k ...   QR kod (model 2): model, modül boyutu, hata düzeyi, veri, bas
 */

import {
  VARSAYILAN_KOD_SAYFASI,
  kodSayfasiNo,
  type EtiketProfili,
  type KodSayfasi,
} from "@/lib/findik-isleme";

export { VARSAYILAN_KOD_SAYFASI, kodSayfasiGecerliMi, kodSayfasiNo, KOD_SAYFALARI } from "@/lib/findik-isleme";
export type { KodSayfasi } from "@/lib/findik-isleme";

/**
 * PC857 (Türkçe) kod sayfasında ASCII dışı Türkçe harflerin bayt karşılıkları.
 * Değerler iconv-lite ile PC857 kodlaması üzerinden doğrulanmıştır.
 */
const CP857_TURKCE: Readonly<Record<string, number>> = {
  "ç": 0x87,
  "Ç": 0x80,
  "ğ": 0xa7,
  "Ğ": 0xa6,
  "ı": 0x8d,
  "İ": 0x98,
  "ö": 0x94,
  "Ö": 0x99,
  "ş": 0x9f,
  "Ş": 0x9e,
  "ü": 0x81,
  "Ü": 0x9a,
};

/** Kod sayfası desteklemeyen yazıcılar için sadeleştirme karşılıkları. */
const ASCII_KARSILIK: Readonly<Record<string, string>> = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
  â: "a",
  Â: "A",
  î: "i",
  Î: "I",
  û: "u",
  Û: "U",
};

/** Tek bayta sığmayan ama etikette sık geçen işaretlerin sadeleştirilmesi. */
const METIN_DEGISIMLERI: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u2018\u2019\u02bc]/g, "'"],
  [/[\u201c\u201d]/g, '"'],
  [/[\u2013\u2014]/g, "-"],
  [/[•·]/g, "*"],
  [/[\u20ba]/g, "TL"],
  [/[\u00a0]/g, " "],
];

export function escposMetinNormalize(metin: string): string {
  let sonuc = metin;
  for (const [kalip, yerine] of METIN_DEGISIMLERI) sonuc = sonuc.replace(kalip, yerine);
  return sonuc;
}

/**
 * Metni yazıcının anlayacağı tek baytlık kodlamaya çevirir. Kod sayfası dışı
 * kalan karakterler sadeleştirilir, hâlâ eşleşmeyen karakter `?` olur.
 */
export function escposMetinKodla(
  metin: string,
  kodSayfasi: KodSayfasi = VARSAYILAN_KOD_SAYFASI
): number[] {
  const cikti: number[] = [];
  for (const harf of escposMetinNormalize(metin)) {
    if (harf === "\n") {
      cikti.push(0x0a);
      continue;
    }
    const nokta = harf.codePointAt(0) ?? 0x3f;
    if (nokta >= 0x20 && nokta <= 0x7e) {
      cikti.push(nokta);
      continue;
    }
    if (kodSayfasi === "CP857") {
      const bayt = CP857_TURKCE[harf];
      if (bayt !== undefined) {
        cikti.push(bayt);
        continue;
      }
    }
    const sade = ASCII_KARSILIK[harf];
    cikti.push(sade ? sade.charCodeAt(0) : 0x3f);
  }
  return cikti;
}

// ─── Etiket ölçüleri ────────────────────────────────────────

export interface EtiketOlcusu {
  /** Satır başına sığan karakter sayısı (Font A, tek genişlik). */
  satirGenisligi: number;
  /** QR kod modül (nokta) boyutu: 1-16. */
  qrModulBoyutu: number;
  /** Başlıkta büyük punto kullanılsın mı. */
  baslikBuyuk: boolean;
}

export const ETIKET_OLCULERI: Readonly<Record<EtiketProfili, EtiketOlcusu>> = {
  // 50 mm etiket ≈ 384 nokta baskı genişliği / 12 nokta karakter = 32 karakter.
  NIMBOT_B1_50x50: { satirGenisligi: 32, qrModulBoyutu: 4, baslikBuyuk: false },
  // 50×30 mm: genişlik aynı, yükseklik kısa; satır düzeni 50 mm ile aynıdır.
  NIMBOT_B1_50x30: { satirGenisligi: 32, qrModulBoyutu: 4, baslikBuyuk: false },
  // 80 mm rulo ≈ 576 nokta baskı genişliği = 48 karakter.
  TERMAL_80x70: { satirGenisligi: 48, qrModulBoyutu: 6, baslikBuyuk: true },
};

export function etiketOlcusu(profil: EtiketProfili): EtiketOlcusu {
  return ETIKET_OLCULERI[profil] ?? ETIKET_OLCULERI.NIMBOT_B1_50x50;
}

/** Uzun metni kelime sınırlarından bölerek etiket satırlarına ayırır. */
export function etiketSatirlaraSar(metin: string, genislik: number): string[] {
  const kelimeler = metin.trim().split(/\s+/).filter(Boolean);
  if (kelimeler.length === 0) return [""];

  const satirlar: string[] = [];
  let aktif = "";
  for (const kelime of kelimeler) {
    if (kelime.length > genislik) {
      if (aktif) {
        satirlar.push(aktif);
        aktif = "";
      }
      for (let i = 0; i < kelime.length; i += genislik) satirlar.push(kelime.slice(i, i + genislik));
      continue;
    }
    const aday = aktif ? `${aktif} ${kelime}` : kelime;
    if (aday.length <= genislik) {
      aktif = aday;
      continue;
    }
    satirlar.push(aktif);
    aktif = kelime;
  }
  if (aktif) satirlar.push(aktif);
  return satirlar;
}

// ─── ESC/POS komut üreticisi ────────────────────────────────

export type Hizalama = "sol" | "orta" | "sag";
export type QrHataDuzeyi = "L" | "M" | "Q" | "H";

const HIZALAMA_BAYT: Readonly<Record<Hizalama, number>> = { sol: 0, orta: 1, sag: 2 };
const QR_HATA_BAYT: Readonly<Record<QrHataDuzeyi, number>> = { L: 48, M: 49, Q: 50, H: 51 };

export interface QrSecenekleri {
  /** Modül boyutu (nokta): 1-16. Etiket ölçüsünden gelir. */
  modulBoyutu?: number;
  hataDuzeyi?: QrHataDuzeyi;
}

/** ESC/POS komut akışını adım adım kuran yardımcı sınıf. */
export class EscPos {
  private parcalar: number[] = [];

  constructor(private kodSayfasi: KodSayfasi = VARSAYILAN_KOD_SAYFASI) {}

  /** ESC @ — yazıcıyı sıfırlar ve kod sayfasını seçer. */
  baslat(): this {
    this.parcalar.push(0x1b, 0x40);
    return this.kodSayfasiSec();
  }

  kodSayfasiSec(kod: KodSayfasi = this.kodSayfasi): this {
    this.kodSayfasi = kod;
    this.parcalar.push(0x1b, 0x74, kodSayfasiNo(kod));
    return this;
  }

  hizala(hizalama: Hizalama): this {
    this.parcalar.push(0x1b, 0x61, HIZALAMA_BAYT[hizalama]);
    return this;
  }

  /** GS ! n — genişlik/yükseklik çarpanı (1-8 arası anlamlıdır). */
  boyut(genislik = 1, yukseklik = 1): this {
    const g = Math.min(8, Math.max(1, Math.trunc(genislik))) - 1;
    const y = Math.min(8, Math.max(1, Math.trunc(yukseklik))) - 1;
    this.parcalar.push(0x1d, 0x21, ((g & 0x07) << 4) | (y & 0x07));
    return this;
  }

  kalin(aktif = true): this {
    this.parcalar.push(0x1b, 0x45, aktif ? 1 : 0);
    return this;
  }

  ters(aktif = true): this {
    this.parcalar.push(0x1d, 0x42, aktif ? 1 : 0);
    return this;
  }

  metin(icerik: string): this {
    this.parcalar.push(...escposMetinKodla(icerik, this.kodSayfasi));
    return this;
  }

  satir(icerik = ""): this {
    if (icerik) this.metin(icerik);
    this.parcalar.push(0x0a);
    return this;
  }

  /** ESC d n — n satır besleyip yazdırır. */
  besle(satirSayisi = 1): this {
    const n = Math.min(255, Math.max(0, Math.trunc(satirSayisi)));
    this.parcalar.push(0x1b, 0x64, n);
    return this;
  }

  /**
   * QR kod (model 2) yazdırır. Epson sırası: model → modül boyutu → hata
   * düzeyi → veri → bas.
   */
  qr(veri: string, secenekler: QrSecenekleri = {}): this {
    const modul = Math.min(16, Math.max(1, Math.trunc(secenekler.modulBoyutu ?? 4)));
    const hata = QR_HATA_BAYT[secenekler.hataDuzeyi ?? "M"];
    const govde = escposMetinKodla(veri, this.kodSayfasi);

    // Model 2 seç
    this.parcalar.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Modül boyutu
    this.parcalar.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, modul);
    // Hata düzeyi
    this.parcalar.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, hata);
    // Veriyi sakla (pL,pH = veri uzunluğu + 3)
    const uzunluk = govde.length + 3;
    this.parcalar.push(
      0x1d,
      0x28,
      0x6b,
      uzunluk & 0xff,
      (uzunluk >> 8) & 0xff,
      0x31,
      0x50,
      0x30,
      ...govde
    );
    // Saklanan sembolü bas
    this.parcalar.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  cikti(): Uint8Array {
    return Uint8Array.from(this.parcalar);
  }

  uzunluk(): number {
    return this.parcalar.length;
  }
}

// ─── Etiket içeriği ─────────────────────────────────────────

export interface EtiketIslemleri {
  kirma: boolean;
  kavurma: boolean;
  paketleme: boolean;
}

export interface EtiketVerisi {
  firmaAdi: string;
  siraNo: string;
  musteriAdi: string;
  telefon: string;
  kilo: string;
  islemler: EtiketIslemleri;
  paketTipi?: string | null;
  paketAdedi?: number | null;
  odemeDurumu?: string | null;
  toplamTutar?: string | null;
  tarihSaatStr: string;
  notlar?: string | null;
}

function ayrac(genislik: number): string {
  return "-".repeat(genislik);
}

/** Paket tipi kodunu etikette okunur biçime çevirir (1_KG → 1 KG). */
export function paketTipiEtiketi(paketTipi?: string | null): string | null {
  if (!paketTipi) return null;
  return paketTipi.replace(/_/g, " ");
}

/** Etikette işaretlenecek kutu satırlarını üretir: "[X] Kırma". */
export function islemSatirlari(islemler: EtiketIslemleri): string[] {
  return [
    `${islemler.kirma ? "[X]" : "[ ]"} Kırma`,
    `${islemler.kavurma ? "[X]" : "[ ]"} Kavurma`,
    `${islemler.paketleme ? "[X]" : "[ ]"} Vakumlu Paketleme`,
  ];
}

function baslikYaz(escpos: EscPos, metin: string, olcu: EtiketOlcusu): void {
  escpos.kalin(true);
  if (olcu.baslikBuyuk) escpos.boyut(2, 2);
  for (const satir of etiketSatirlaraSar(metin, olcu.satirGenisligi)) escpos.satir(satir);
  if (olcu.baslikBuyuk) escpos.boyut(1, 1);
  escpos.kalin(false);
}

/**
 * Tek bir fındık hizmet talebi için ESC/POS etiket baytlarını üretir.
 * Etiket içeriği ekrandaki kâğıt etiketle (QR + işlem kutuları) aynıdır.
 */
export function hizmetEtiketiOlustur(
  veri: EtiketVerisi,
  profil: EtiketProfili,
  kodSayfasi: KodSayfasi = VARSAYILAN_KOD_SAYFASI
): Uint8Array {
  const olcu = etiketOlcusu(profil);
  const genislik = olcu.satirGenisligi;
  const escpos = new EscPos(kodSayfasi);

  escpos.baslat();
  baslikYaz(escpos, veri.firmaAdi, olcu);
  escpos.hizala("orta").kalin(true).satir(`TALEP #${veri.siraNo}`).kalin(false);
  escpos.hizala("sol").satir(ayrac(genislik));

  for (const satir of etiketSatirlaraSar(`MÜŞTERİ: ${veri.musteriAdi}`, genislik)) {
    escpos.kalin(true).satir(satir).kalin(false);
  }
  escpos.satir(`TELEFON: ${veri.telefon}`);

  escpos.kalin(true);
  escpos.boyut(1, olcu.baslikBuyuk ? 2 : 2);
  escpos.satir(`MİKTAR: ${veri.kilo} KG`);
  escpos.boyut(1, 1);
  escpos.kalin(false);
  escpos.satir(ayrac(genislik));

  escpos.satir("YAPILACAK İŞLEMLER:");
  for (const satir of islemSatirlari(veri.islemler)) escpos.satir(satir);

  const paket = paketTipiEtiketi(veri.paketTipi);
  if (paket) {
    const adet = veri.paketAdedi ? `${veri.paketAdedi}x ` : "";
    for (const satir of etiketSatirlaraSar(`Paket: ${adet}${paket}`, genislik)) {
      escpos.satir(satir);
    }
  }

  escpos.satir(ayrac(genislik));
  for (const satir of etiketSatirlaraSar(`TARİH: ${veri.tarihSaatStr}`, genislik)) {
    escpos.satir(satir);
  }
  if (veri.toplamTutar) escpos.satir(`TUTAR: ${veri.toplamTutar} TL`);

  if (veri.odemeDurumu === "ODENDI") {
    escpos.hizala("orta").ters(true).satir(" TAHSİL EDİLDİ ").ters(false).hizala("sol");
  } else if (veri.odemeDurumu === "VERESIYE") {
    escpos.hizala("orta").ters(true).satir(" VERESİYE ").ters(false).hizala("sol");
  }

  if (veri.notlar && veri.notlar.trim()) {
    escpos.satir(ayrac(genislik));
    escpos.kalin(true).satir("NOT:").kalin(false);
    for (const satir of etiketSatirlaraSar(veri.notlar.trim(), genislik)) escpos.satir(satir);
  }

  escpos.besle(1);
  escpos.hizala("orta").qr(`FILBERT-HIZMET:${veri.siraNo}`, { modulBoyutu: olcu.qrModulBoyutu });
  escpos.besle(1);
  if (olcu.baslikBuyuk) {
    escpos.kalin(true).satir("* TESLİMATTA İBRAZ EDİNİZ *").kalin(false);
  }
  escpos.besle(2);

  return escpos.cikti();
}

/** Ayarlar ekranındaki "Test Etiketi Yazdır" için örnek içerik. */
export function testEtiketiVerisi(firmaAdi: string): EtiketVerisi {
  return {
    firmaAdi,
    siraNo: "TEST",
    musteriAdi: "TEST MÜŞTERİ",
    telefon: "0500 000 00 00",
    kilo: "25.00",
    islemler: { kirma: true, kavurma: true, paketleme: true },
    paketTipi: "1_KG",
    paketAdedi: 25,
    odemeDurumu: null,
    toplamTutar: "200.00",
    tarihSaatStr: "Test baskisi",
  };
}
