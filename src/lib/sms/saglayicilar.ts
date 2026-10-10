import {
  NETGSM_GONDERIM_HATALARI,
  type SmsAyarlari,
  type SmsGonderSonuc,
} from "./types";
import { netgsmNumara, smsMetniHazirla, smsParcaHesapla } from "./utils";

/** Netgsm REST v2 kök adresi. `apiUrl` ayarlanırsa onun yerine o kullanılır. */
export const NETGSM_VARSAYILAN_API = "https://api.netgsm.com.tr";

function netgsmKok(ayarlar: SmsAyarlari): string {
  return (ayarlar.apiUrl?.trim() || NETGSM_VARSAYILAN_API).replace(/\/+$/, "");
}

function temelKimlik(ayarlar: SmsAyarlari): string {
  return `Basic ${Buffer.from(`${ayarlar.kullaniciAdi ?? ""}:${ayarlar.sifre ?? ""}`).toString("base64")}`;
}

/**
 * Netgsm gönderim gövdesini üretir. Ayrı bir fonksiyondur ki ağ çağrısı
 * yapılmadan birim testiyle doğrulanabilsin.
 *
 * `iysfilter: "0"` — talep alındı / tamamlandı / teslim hatırlatma mesajları
 * ticari elektronik ileti sayılmadığı için İYS onay filtresi uygulanmaz.
 */
export function netgsmGonderimGovdesi(
  ayarlar: SmsAyarlari,
  telefon: string,
  mesaj: string,
  numara: string
): Record<string, unknown> {
  const { metin } = smsMetniHazirla(mesaj, ayarlar.kodlama);
  return {
    msgheader: ayarlar.baslik?.trim() ?? "",
    encoding: ayarlar.kodlama === "ASCII" ? "ASCII" : "TR",
    iysfilter: "0",
    appname: ayarlar.appname?.trim() || "filbert",
    messages: [{ msg: metin, no: numara }],
  };
}

/** Netgsm REST v2 SMS gönderimi. Sonuç HTTP durumundan değil gövdedeki koddan okunur. */
export async function netgsmGonder(
  ayarlar: SmsAyarlari,
  telefon: string,
  mesaj: string
): Promise<SmsGonderSonuc> {
  const parcaSayisi = smsParcaHesapla(mesaj, ayarlar.kodlama).parcaSayisi;
  const numara = netgsmNumara(telefon);
  if (!numara) {
    return { basarili: false, hata: "Geçersiz telefon numarası (5XXXXXXXXX bekleniyor)", parcaSayisi };
  }
  if (!ayarlar.kullaniciAdi || !ayarlar.sifre) {
    return { basarili: false, hata: "Netgsm kullanıcı adı ve şifresi tanımlı değil", parcaSayisi };
  }
  if (!ayarlar.baslik?.trim()) {
    return { basarili: false, hata: "Onaylı gönderici başlığı (originator) tanımlı değil", parcaSayisi };
  }

  try {
    const yanit = await fetch(`${netgsmKok(ayarlar)}/sms/rest/v2/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: temelKimlik(ayarlar),
      },
      body: JSON.stringify(netgsmGonderimGovdesi(ayarlar, telefon, mesaj, numara)),
      signal: AbortSignal.timeout(15_000),
    });

    const veri = (await yanit.json().catch(() => null)) as
      | { code?: string; jobid?: string | null; description?: string }
      | null;

    const kod = String(veri?.code ?? "");
    if (kod === "00") {
      return { basarili: true, mesajId: veri?.jobid ?? undefined, parcaSayisi };
    }

    return {
      basarili: false,
      hataKodu: kod || undefined,
      hata:
        NETGSM_GONDERIM_HATALARI[kod] ??
        veri?.description ??
        `Netgsm gönderim hatası (HTTP ${yanit.status})`,
      parcaSayisi,
    };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? `Netgsm bağlantı hatası: ${hata.message}` : "Netgsm bağlantı hatası",
      parcaSayisi,
    };
  }
}

export interface SmsBakiyeSonuc {
  basarili: boolean;
  /** Kredi adedi (stip=2) ya da paket satırları (stip=1/3). */
  bakiye?: string;
  paketler?: { ad: string; adet: number }[];
  hata?: string;
}

/**
 * Netgsm bakiye sorgusu. `stip=2` kredi, `stip=1` paket, `stip=3` her ikisini
 * döndürür. Sonuç SMS Merkezi'nde gösterilir; kredi bitmeden fark edilir.
 */
export async function netgsmBakiyeSorgula(ayarlar: SmsAyarlari): Promise<SmsBakiyeSonuc> {
  if (!ayarlar.kullaniciAdi || !ayarlar.sifre) {
    return { basarili: false, hata: "Netgsm kullanıcı adı ve şifresi tanımlı değil" };
  }

  try {
    const yanit = await fetch(`${netgsmKok(ayarlar)}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usercode: ayarlar.kullaniciAdi,
        password: ayarlar.sifre,
        stip: 3,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const veri = (await yanit.json().catch(() => null)) as
      | { code?: string; balance?: string | { amount?: number | string; balance_name?: string }[] }
      | null;

    if (String(veri?.code ?? "") !== "00") {
      return {
        basarili: false,
        hata: NETGSM_GONDERIM_HATALARI[String(veri?.code ?? "")] ?? "Bakiye sorgulanamadı",
      };
    }

    if (typeof veri?.balance === "string") {
      return { basarili: true, bakiye: veri.balance };
    }

    const satirlar = Array.isArray(veri?.balance) ? veri.balance : [];
    const kredi = satirlar.find((s) => (s.balance_name ?? "").toLowerCase().includes("kredi"));
    return {
      basarili: true,
      bakiye: kredi?.amount !== undefined ? String(kredi.amount) : undefined,
      paketler: satirlar.map((s) => ({
        ad: s.balance_name ?? "Paket",
        adet: Number(s.amount ?? 0),
      })),
    };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? `Bakiye sorgu hatası: ${hata.message}` : "Bakiye sorgu hatası",
    };
  }
}

/** Aboneliğe tanımlı, onaylı gönderici başlıklarını listeler. */
export async function netgsmBasliklariGetir(ayarlar: SmsAyarlari): Promise<{ basarili: boolean; basliklar?: string[]; hata?: string }> {
  if (!ayarlar.kullaniciAdi || !ayarlar.sifre) {
    return { basarili: false, hata: "Netgsm kullanıcı adı ve şifresi tanımlı değil" };
  }

  try {
    const sorgu = new URLSearchParams({ appname: ayarlar.appname?.trim() || "filbert" });
    const yanit = await fetch(`${netgsmKok(ayarlar)}/sms/rest/v2/msgheader?${sorgu.toString()}`, {
      method: "GET",
      headers: { Authorization: temelKimlik(ayarlar) },
      signal: AbortSignal.timeout(15_000),
    });

    const veri = (await yanit.json().catch(() => null)) as
      | { code?: string; msgheaders?: string[]; msgheader?: string[] }
      | null;

    if (String(veri?.code ?? "") !== "00") {
      return {
        basarili: false,
        hata: NETGSM_GONDERIM_HATALARI[String(veri?.code ?? "")] ?? "Başlık listesi alınamadı",
      };
    }

    return { basarili: true, basliklar: veri?.msgheaders ?? veri?.msgheader ?? [] };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? `Başlık sorgu hatası: ${hata.message}` : "Başlık sorgu hatası",
    };
  }
}

export interface TeslimSatiri {
  jobid: string;
  numara: string;
  status: number;
  operator?: number;
  msglen?: number;
  teslimTarihi?: string;
  hataKodu?: number;
}

export interface SmsRaporSonuc {
  basarili: boolean;
  satirlar?: TeslimSatiri[];
  hata?: string;
}

/**
 * Gönderilen mesajların teslim raporunu okur (Netgsm `/sms/rest/v2/report`).
 * Sağlayıcı dakikada 10 sorguyla sınırlıdır; bu yüzden sorgu tekil satır ya da
 * toplu işlem sonrası elle tetiklenir.
 */
export async function netgsmRaporSorgula(
  ayarlar: SmsAyarlari,
  jobIdler: string[]
): Promise<SmsRaporSonuc> {
  const gecerli = jobIdler.filter((j) => j && j.trim());
  if (gecerli.length === 0) return { basarili: false, hata: "Sorgulanacak görev kimliği yok" };
  if (!ayarlar.kullaniciAdi || !ayarlar.sifre) {
    return { basarili: false, hata: "Netgsm kullanıcı adı ve şifresi tanımlı değil" };
  }

  try {
    const yanit = await fetch(`${netgsmKok(ayarlar)}/sms/rest/v2/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: temelKimlik(ayarlar),
      },
      body: JSON.stringify({
        jobids: gecerli,
        appname: ayarlar.appname?.trim() || "filbert",
        pagenumber: 1,
        pagesize: Math.min(Math.max(gecerli.length, 20), 1000),
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const veri = (await yanit.json().catch(() => null)) as
      | {
          code?: string;
          jobs?: {
            jobid?: string;
            number?: string;
            status?: number;
            operator?: number;
            msglen?: number;
            deliveredDate?: string;
            errorCode?: number;
          }[];
        }
      | null;

    const kod = String(veri?.code ?? "");
    // 60: bu kriterlere uyan kayıt yok — hata değil, henüz rapor oluşmamış demektir.
    if (kod === "60") return { basarili: true, satirlar: [] };
    if (kod !== "00") {
      return {
        basarili: false,
        hata: NETGSM_GONDERIM_HATALARI[kod] ?? `Teslim raporu alınamadı (kod ${kod || "?"})`,
      };
    }

    return {
      basarili: true,
      satirlar: (veri?.jobs ?? []).map((satir) => ({
        jobid: String(satir.jobid ?? ""),
        numara: String(satir.number ?? ""),
        status: Number(satir.status ?? 0),
        operator: satir.operator,
        msglen: satir.msglen,
        teslimTarihi: satir.deliveredDate,
        hataKodu: satir.errorCode,
      })),
    };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? `Teslim raporu hatası: ${hata.message}` : "Teslim raporu hatası",
    };
  }
}

/** İleti Merkezi JSON API gönderimi (key/hash kimlik doğrulaması). */
export async function iletiMerkeziGonder(
  ayarlar: SmsAyarlari,
  telefon: string,
  mesaj: string
): Promise<SmsGonderSonuc> {
  const endpoint = ayarlar.apiUrl?.trim() || "https://api.iletimerkezi.com/v1/send-sms/json";
  const { metin } = smsMetniHazirla(mesaj, ayarlar.kodlama);
  const parcaSayisi = smsParcaHesapla(mesaj, ayarlar.kodlama).parcaSayisi;

  const payload = {
    request: {
      authentication: {
        key: ayarlar.kullaniciAdi,
        hash: ayarlar.sifre,
      },
      order: {
        sender: ayarlar.baslik,
        sendDateTime: [],
        message: {
          text: metin,
          receipents: {
            number: [telefon],
          },
        },
      },
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await response.json().catch(() => null)) as
      | { response?: { status?: { code?: number; message?: string }; order?: { id?: string | number } } }
      | null;

    if (data?.response?.status?.code === 200) {
      return {
        basarili: true,
        mesajId: String(data?.response?.order?.id ?? ""),
        parcaSayisi,
      };
    }

    return {
      basarili: false,
      hataKodu: data?.response?.status?.code ? String(data.response.status.code) : undefined,
      hata: data?.response?.status?.message || "İleti Merkezi SMS gönderilemedi",
      parcaSayisi,
    };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? `İleti Merkezi bağlantı hatası: ${hata.message}` : "İleti Merkezi bağlantı hatası",
      parcaSayisi,
    };
  }
}

/** Genel amaçlı HTTP/webhook gönderimi: sağlayıcı seçilmemişse son çare. */
export async function genericHttpGonder(
  ayarlar: SmsAyarlari,
  telefon: string,
  mesaj: string
): Promise<SmsGonderSonuc> {
  if (!ayarlar.apiUrl?.trim()) {
    return { basarili: false, hata: "Genel HTTP sağlayıcı için API adresi zorunludur" };
  }

  const parcaSayisi = smsParcaHesapla(mesaj, ayarlar.kodlama).parcaSayisi;
  const payload = {
    to: telefon,
    message: mesaj,
    sender: ayarlar.baslik,
    apiKey: ayarlar.kullaniciAdi,
    apiSecret: ayarlar.sifre,
  };

  try {
    const response = await fetch(ayarlar.apiUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { basarili: false, hata: `HTTP hatası: ${response.status} ${response.statusText}`, parcaSayisi };
    }

    return { basarili: true, mesajId: `HTTP-${Date.now()}`, parcaSayisi };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? `HTTP gönderim hatası: ${hata.message}` : "HTTP gönderim hatası",
      parcaSayisi,
    };
  }
}