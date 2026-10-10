/**
 * Modül ayrımının tek kaynağı.
 *
 * Uygulama iki ana modüle ayrılır:
 *   1) Fındık Alım Modülü   — alım, randıman, emanet, virman, sevk akışı
 *   2) Fındık İşleme Modülü — kırma / kavurma / paketleme talep akışı ve
 *      kendi kasa yönetimi
 *
 * Bu dosya bilinçli olarak saf tutulur: veritabanına ve Next.js API'lerine
 * dokunmaz, böylece hem sunucu hem istemci bileşenleri güvenle kullanabilir.
 */
import type { UygulamaModuluKodu } from "@/lib/rbac/permissions";

export const MODUL_IDLERI = ["alim", "islem"] as const;
export type ModulId = (typeof MODUL_IDLERI)[number];

/** Aktif modül tercihinin tutulduğu çerez. Oturum dışı kalıcı tercihtir. */
export const MODUL_CEREZI = "filbert_modul";
/** Proxy'nin istek yolundan türettiği modül başlığı. */
export const MODUL_BASLIGI = "x-filbert-modul";
/** Çerez ömrü — kullanıcı tercihi uzun süre korunur. */
export const MODUL_CEREZ_SURESI = 365 * 24 * 60 * 60;

export type ModulTanimi = {
  id: ModulId;
  /** Ayarlar ve geçiş butonlarında kullanılan tam ad. */
  ad: string;
  /** Rozet/etiket için kısa ad. */
  kisa: string;
  /** Modülün giriş ekranı. */
  anaRota: string;
  /** Modül erişiminin bağlı olduğu RBAC modülü. */
  izinModulu: UygulamaModuluKodu;
  /** Karşı modül. */
  karsiModul: ModulId;
  /** Buton metni: "Fındık Alım Modülüne Geç". */
  gecEtiketi: string;
  ikon: "alim-modul" | "isleme-modul";
};

export const MODULLER: Readonly<Record<ModulId, ModulTanimi>> = {
  alim: {
    id: "alim",
    ad: "Fındık Alım Modülü",
    kisa: "Alım",
    anaRota: "/mod/alim",
    izinModulu: "ALIM",
    karsiModul: "islem",
    gecEtiketi: "Fındık Alım Modülüne Geç",
    ikon: "alim-modul",
  },
  islem: {
    id: "islem",
    ad: "Fındık İşleme Modülü",
    kisa: "İşleme",
    anaRota: "/mod/islem",
    izinModulu: "HIZMET",
    karsiModul: "alim",
    gecEtiketi: "Fındık İşleme Modülüne Geç",
    ikon: "isleme-modul",
  },
};

export function modulIdGecerliMi(deger: unknown): deger is ModulId {
  return typeof deger === "string" && (MODUL_IDLERI as readonly string[]).includes(deger);
}

/** Çerez/başlık gibi güvenilmeyen kaynaklardan gelen değeri çözer. */
export function modulCoz(deger: unknown): ModulId | null {
  return modulIdGecerliMi(deger) ? deger : null;
}

/** Veritabanındaki `FirmaModulu` enum değerini modül kimliğine çevirir. */
export function dbModuluCoz(deger: unknown): ModulId {
  return deger === "ISLEME" ? "islem" : "alim";
}

/** Modül kimliğini veritabanı enum değerine çevirir. */
export function dbModulKodu(modul: ModulId): "ALIM" | "ISLEME" {
  return modul === "islem" ? "ISLEME" : "ALIM";
}

export function modulAnaRota(modul: ModulId): string {
  return MODULLER[modul].anaRota;
}

/** Yol ön eki eşleşmesi: `/hizmet` ile `/hizmet/kasa` eşleşir, `/hizmetx` eşleşmez. */
function onekEslesiyor(yol: string, onek: string): boolean {
  return yol === onek || yol.startsWith(`${onek}/`);
}

const ISLEME_ONEKLERI = ["/mod/islem", "/hizmet"] as const;
const ALIM_ONEKLERI = [
  "/mod/alim",
  "/mod/findik",
  "/alim",
  "/randiman",
  "/emanet",
  "/virman",
  "/sevkiyat",
] as const;

/**
 * İstek yolundan modülü türetir. Modüle özel olmayan ekranlarda (`/kasa`,
 * `/ayarlar`, `/raporlar` …) `null` döner; bu durumda kullanıcının son
 * tercihi (çerez) veya varsayılan modülü geçerlidir.
 */
export function rotaModulu(yol: string): ModulId | null {
  const temiz = yol.split("?")[0] ?? "";
  if (ISLEME_ONEKLERI.some((onek) => onekEslesiyor(temiz, onek))) return "islem";
  if (ALIM_ONEKLERI.some((onek) => onekEslesiyor(temiz, onek))) return "alim";
  return null;
}

/**
 * Masaüstü kenar çubuğundaki grupların modül aidiyeti. `null` olan gruplar
 * (yalnızca GENEL) her iki modülde de görünür; diğerleri yalnızca kendi
 * modülünde listelenir. Böylece menüler modüllere göre birbirine karışmaz.
 */
export const NAV_GRUPLARI: Readonly<Record<string, ModulId | null>> = {
  GENEL: null,
  "FINDIK ALIM": "alim",
  "FINDIK İŞLEME": "islem",
  "FİNANS YÖNETİMİ": "alim",
  "CARİ": "alim",
  "RAPORLAR": "alim",
};


/**
 * Mobil alt (sticky) menü ögeleri. Her modül yalnızca kendi işlevlerini listeler:
 * Fındık İşleme modülünde **eller serbest (sesli not / mikrofon) ögesi yoktur**;
 * yerine işleme akışının günlük adımları (yeni talep, kuyruk, işleme kasası) gelir.
 *
 * İkonlar burada yalnızca anahtar olarak tutulur; React bileşenine eşlemesi
 * `src/components/bottom-nav.tsx` içinde yapılır. Böylece bu dosya saf kalır ve
 * menü içeriği birim testleriyle doğrulanabilir.
 */
export type AltMenuIkonu =
  | "ana"
  | "ara"
  | "mikrofon"
  | "ayarlar"
  | "kuyruk"
  | "yeni-talep"
  | "isleme-kasasi";

export type AltMenuOgesi = {
  href: string;
  etiket: string;
  ikon: AltMenuIkonu;
  /** Ortada yükseltilmiş birincil eylem olarak çizilir. */
  vurgulu?: boolean;
};

export const ALT_MENU_OGELERI: Readonly<Record<ModulId, readonly AltMenuOgesi[]>> = {
  alim: [
    { href: "/", etiket: "Ana Sayfa", ikon: "ana" },
    { href: "/arama", etiket: "Ara", ikon: "ara" },
    { href: "/sesli-not", etiket: "Sesli modu aç", ikon: "mikrofon", vurgulu: true },
    { href: "/ayarlar", etiket: "Ayarlar", ikon: "ayarlar" },
  ],
  islem: [
    { href: "/", etiket: "Pano", ikon: "ana" },
    { href: "/hizmet", etiket: "Talep Kuyruğu", ikon: "kuyruk" },
    { href: "/hizmet/yeni", etiket: "Yeni Talep", ikon: "yeni-talep", vurgulu: true },
    { href: "/hizmet/kasa", etiket: "İşleme Kasası", ikon: "isleme-kasasi" },
    { href: "/ayarlar", etiket: "Ayarlar", ikon: "ayarlar" },
  ],
};

/** Aktif modülün alt menü ögeleri. Modül bilinmiyorsa alım menüsü döner. */
export function altMenuOgeleri(modul: ModulId | null | undefined): readonly AltMenuOgesi[] {
  return ALT_MENU_OGELERI[modul ?? "alim"];
}

/** Grup başlığı aktif modülde gösterilmeli mi? Aktif modül bilinmiyorsa hepsi görünür. */
export function navGrubuGorunur(baslik: string, aktifModul: ModulId | null): boolean {
  const grupModulu = NAV_GRUPLARI[baslik] ?? null;
  return !aktifModul || !grupModulu || grupModulu === aktifModul;
}

/**
 * Aktif modülü şu sırayla belirler: istek yolu → çerez tercihi → varsayılan.
 * Yol her zaman en güçlü sinyaldir; böylece `/hizmet/kasa` gibi bir ekrana
 * doğrudan gelen kullanıcı, çerez farklı olsa bile işleme menülerini görür.
 *
 * `yol` alanı proxy'nin eklediği modül başlığı (modül kimliği) veya ham istek
 * yolu olabilir; ikisi de desteklenir.
 */
export function aktifModulBelirle(girdi: {
  yol: string | null | undefined;
  cerez: string | null | undefined;
  varsayilan: unknown;
}): ModulId {
  const yoldan = modulCoz(girdi.yol) ?? (girdi.yol ? rotaModulu(girdi.yol) : null);
  return yoldan ?? modulCoz(girdi.cerez) ?? dbModuluCoz(girdi.varsayilan);
}