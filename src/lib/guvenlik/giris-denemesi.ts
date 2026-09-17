"server only";

// Kalıcı giriş denemesi sınırlaması ve giriş denetim izi.
//
// Bellek içi sınırlayıcının aksine bu katman deneme sayılarını `AuditKaydi`
// içinde saklar: uygulama yeniden başlasa veya birden çok örneğe yayılsa da
// sınır geçerli kalır. Ek olarak IP tabanlı sınır eklenir; böylece tek bir
// IP'den farklı e-postalara yapılan dağıtık denemeler de engellenir.
// AuditKaydi yalnız ekleme yapılabilen (değiştirilemez) bir tablo olduğundan
// başarısız girişler kalıcı bir denetim izi de bırakır.

import { prisma } from "@/lib/db";
import type { AuditEylemi } from "@/generated/prisma/enums";

const PENCERE_MS = 15 * 60 * 1000;
const EPOSTA_LIMIT = 5;
const IP_LIMIT = 20;
const GIRIS_HEDEF_TIPI = "GirisDenemesi";

/** Son 15 dakikada e-posta (veya IP) için eşik aşıldıysa girişi engelle. */
export async function girisDenemesiEngelliMi(eposta: string, ip?: string): Promise<boolean> {
  const kesilmeAni = new Date(Date.now() - PENCERE_MS);
  const anahtar = eposta.trim().toLowerCase();

  const [epostaAdet, ipAdet] = await Promise.all([
    prisma.auditKaydi.count({
      where: { eylem: "GIRIS", basarili: false, hedefTipi: GIRIS_HEDEF_TIPI, hedefId: anahtar, createdAt: { gte: kesilmeAni } },
    }),
    ip
      ? prisma.auditKaydi.count({
        where: { eylem: "GIRIS", basarili: false, hedefTipi: GIRIS_HEDEF_TIPI, ipAdresi: ip, createdAt: { gte: kesilmeAni } },
      })
      : Promise.resolve(0),
  ]);

  return epostaAdet >= EPOSTA_LIMIT || ipAdet >= IP_LIMIT;
}

/** Başarısız bir denemeyi kalıcı olarak kaydeder. */
export async function basarisizGirisDenemesiKaydet(eposta: string, ip?: string): Promise<void> {
  await prisma.auditKaydi.create({
    data: {
      eylem: "GIRIS",
      basarili: false,
      hedefTipi: GIRIS_HEDEF_TIPI,
      hedefId: eposta.trim().toLowerCase(),
      ipAdresi: ip ?? null,
      aciklama: "Başarısız giriş denemesi",
    },
  });
}

/** Başarılı giriş için denetim izi yazar. */
export async function girisAuditYaz(aktör: {
  firmaId?: string | null;
  kullaniciId?: string | null;
  sistemYoneticisiId?: string | null;
  ipAdresi?: string | null;
}, eylem: AuditEylemi, hedefId?: string): Promise<void> {
  await prisma.auditKaydi.create({
    data: {
      firmaId: aktör.firmaId ?? null,
      kullaniciId: aktör.kullaniciId ?? null,
      sistemYoneticisiId: aktör.sistemYoneticisiId ?? null,
      eylem,
      hedefTipi: "Oturum",
      hedefId: hedefId ?? aktör.kullaniciId ?? aktör.sistemYoneticisiId ?? null,
      ipAdresi: aktör.ipAdresi ?? null,
      aciklama: eylem === "GIRIS" ? "Kullanıcı giriş yaptı" : "Kullanıcı çıkış yaptı",
    },
  });
}