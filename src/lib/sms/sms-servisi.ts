import { prisma } from "@/lib/db";
import {
  type SmsAyarlari,
  type SmsGonderSonuc,
  type SmsSaglayici,
  VARSAYILAN_KAYIT_SABLONU,
  VARSAYILAN_TAMAMLANDI_SABLONU,
} from "./types";

import { telefonTemizle, sablonDoldur } from "./utils";
export { telefonTemizle, sablonDoldur } from "./utils";

/** Firma SMS ayarlarını veritabanından getirir, yoksa varsayılan ayarları döndürür. */
export async function getFirmaSmsAyarlari(firmaId: string): Promise<SmsAyarlari> {
  const kayit = await prisma.smsAyari.findUnique({
    where: { firmaId },
  });

  if (!kayit) {
    return {
      aktif: false,
      saglayici: "TEST",
      apiUrl: "",
      kullaniciAdi: "",
      sifre: "",
      baslik: "",
      kayitSablonu: VARSAYILAN_KAYIT_SABLONU,
      tamamlandiSablonu: VARSAYILAN_TAMAMLANDI_SABLONU,
      otomatikGirisSms: true,
    };
  }

  return {
    aktif: kayit.aktif,
    saglayici: (kayit.saglayici as SmsSaglayici) || "TEST",
    apiUrl: kayit.apiUrl ?? "",
    kullaniciAdi: kayit.kullaniciAdi ?? "",
    sifre: kayit.sifre ?? "",
    baslik: kayit.baslik ?? "",
    kayitSablonu: kayit.kayitSablonu || VARSAYILAN_KAYIT_SABLONU,
    tamamlandiSablonu: kayit.tamamlandiSablonu || VARSAYILAN_TAMAMLANDI_SABLONU,
    otomatikGirisSms: kayit.otomatikGirisSms,
  };
}

/**
 * Belirtilen firmaya ait SMS yapılandırmasını kullanarak alıcıya SMS gönderir.
 */
export async function smsGonder(
  firmaId: string,
  aliciTelefon: string,
  mesaj: string
): Promise<SmsGonderSonuc> {
  const ayarlar = await getFirmaSmsAyarlari(firmaId);
  const normalizeTel = telefonTemizle(aliciTelefon);

  if (!normalizeTel || normalizeTel.length < 10) {
    return { basarili: false, hata: "Geçersiz telefon numarası" };
  }

  if (!mesaj || !mesaj.trim()) {
    return { basarili: false, hata: "Gönderilecek mesaj boş olamaz" };
  }

  // Eğer SMS servisi aktif değilse veya TEST modundaysa simüle et
  if (!ayarlar.aktif || ayarlar.saglayici === "TEST") {
    console.log(
      `[SMS SİMÜLASYONU] Alıcı: ${normalizeTel} | Sağlayıcı: ${ayarlar.saglayici} | Mesaj: ${mesaj}`
    );
    return {
      basarili: true,
      simulasyon: true,
      mesajId: `SIM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  try {
    if (ayarlar.saglayici === "NETGSM") {
      return await netgsmGonder(ayarlar, normalizeTel, mesaj);
    }

    if (ayarlar.saglayici === "ILETIMERKEZI") {
      return await iletiMerkeziGonder(ayarlar, normalizeTel, mesaj);
    }

    if (ayarlar.saglayici === "GENERIC_HTTP") {
      return await genericHttpGonder(ayarlar, normalizeTel, mesaj);
    }

    return { basarili: false, hata: `Desteklenmeyen sağlayıcı: ${ayarlar.saglayici}` };
  } catch (error) {
    console.error("SMS gönderim hatası:", error);
    return {
      basarili: false,
      hata: error instanceof Error ? error.message : "SMS gönderilirken bilinmeyen hata oluştu",
    };
  }
}

/** Netgsm SMS API Gönderimi */
async function netgsmGonder(
  ayarlar: SmsAyarlari,
  telefon: string,
  mesaj: string
): Promise<SmsGonderSonuc> {
  // Netgsm API GET veya XML POST
  const endpoint = ayarlar.apiUrl || "https://api.netgsm.com.tr/sms/send/get/";
  const params = new URLSearchParams({
    usercode: ayarlar.kullaniciAdi ?? "",
    password: ayarlar.sifre ?? "",
    gsmno: telefon,
    message: mesaj,
    msgheader: ayarlar.baslik ?? "",
    dil: "TR",
  });

  const url = `${endpoint}?${params.toString()}`;
  const response = await fetch(url, { method: "GET" });
  const yanitMetni = await response.text();

  // Netgsm 00 veya 01 veya 02 ile başlayan ID dönerse başarılıdır (ör. "00 12345678")
  if (yanitMetni.startsWith("00") || yanitMetni.startsWith("01") || yanitMetni.startsWith("02")) {
    return { basarili: true, mesajId: yanitMetni.trim() };
  }

  return { basarili: false, hata: `Netgsm Hata Kodu: ${yanitMetni}` };
}

/** İletiMerkezi JSON API Gönderimi */
async function iletiMerkeziGonder(
  ayarlar: SmsAyarlari,
  telefon: string,
  mesaj: string
): Promise<SmsGonderSonuc> {
  const endpoint = ayarlar.apiUrl || "https://api.iletimerkezi.com/v1/send-sms/json";
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
          text: mesaj,
          receipents: {
            number: [telefon],
          },
        },
      },
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (data?.response?.status?.code === 200) {
    return { basarili: true, mesajId: String(data?.response?.order?.id ?? "") };
  }

  return {
    basarili: false,
    hata: data?.response?.status?.message || "İletiMerkezi SMS gönderilemedi",
  };
}

/** Generic Webhook / HTTP POST SMS Gönderimi */
async function genericHttpGonder(
  ayarlar: SmsAyarlari,
  telefon: string,
  mesaj: string
): Promise<SmsGonderSonuc> {
  if (!ayarlar.apiUrl) {
    return { basarili: false, hata: "Generic HTTP sağlayıcı için API URL zorunludur" };
  }

  const payload = {
    to: telefon,
    message: mesaj,
    sender: ayarlar.baslik,
    apiKey: ayarlar.kullaniciAdi,
    apiSecret: ayarlar.sifre,
  };

  const response = await fetch(ayarlar.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { basarili: false, hata: `HTTP Hata: ${response.status} ${response.statusText}` };
  }

  return { basarili: true, mesajId: `HTTP-${Date.now()}` };
}
