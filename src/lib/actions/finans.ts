"use server";

// Ödeme / tahsilat / virman — para birimi kontrollü
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sayiCevir } from "@/lib/format";
import { requirePermission } from "@/lib/rbac/guard";
import { Prisma } from "@/generated/prisma/client";
import { TUTAR_MAKS, gecerliSayi } from "@/lib/dogrulama";

export interface FinansGirdi {
  tip: "ODEME" | "TAHSILAT";
  cariId: string;
  hesapId: string;
  tutar: number;
  bakiyeTuru: "TL" | "USD" | "EUR" | "XAU";
  aciklama?: string;
  vadeTarihi?: string;
  kullaniciId?: string;
}

export async function createFinansIslem(g: FinansGirdi): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("FINANS", "OLUSTUR");
  if (!(["ODEME", "TAHSILAT"] as const).includes(g.tip)) return { ok: false, hata: "Geçersiz finans işlem tipi" };
  if (!(["TL", "USD", "EUR", "XAU"] as const).includes(g.bakiyeTuru)) return { ok: false, hata: "Geçersiz para birimi" };
  if (!g.cariId) return { ok: false, hata: "Cari seçilmedi" };
  if (!g.hesapId) return { ok: false, hata: "Kasa/banka seçilmedi" };
  if (!gecerliSayi(g.tutar, 0.001, TUTAR_MAKS)) return { ok: false, hata: "Geçerli bir tutar girilmeli" };
  if (g.vadeTarihi && Number.isNaN(new Date(g.vadeTarihi).getTime())) return { ok: false, hata: "Vade tarihi geçersiz" };

  // ── Hesap para birimi kontrolü ──
  const [hesap, cari] = await Promise.all([
    prisma.kasaHesap.findFirst({ where: { id: g.hesapId, firmaId: actor.firmaId } }),
    prisma.cariKart.findFirst({ where: { id: g.cariId, firmaId: actor.firmaId } }),
  ]);
  if (!hesap || !hesap.aktif) return { ok: false, hata: "Hesap bulunamadı veya pasif" };
  if (!cari || !cari.aktif) return { ok: false, hata: "Cari bulunamadı veya pasif" };
  if (hesap.bakiyeTuru !== g.bakiyeTuru) {
    return { ok: false, hata: `Hesap para birimi "${hesap.bakiyeTuru}", işlem "${g.bakiyeTuru}". Farklı para biriminde işlem yapılamaz!` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const finans = await tx.finansHareket.create({
        data: {
          tip: g.tip,
          firmaId: actor.firmaId,
          cariId: g.cariId,
          hesapId: g.hesapId,
          bakiyeTuru: g.bakiyeTuru,
          tutar: g.tutar,
          aciklama: g.aciklama,
          vadeTarihi: g.vadeTarihi ? new Date(g.vadeTarihi) : undefined,
        },
      });

      await tx.cariHareket.create({
        data: {
          cariId: g.cariId,
          yon: g.tip === "ODEME" ? "ALACAK" : "BORC",
          bakiyeTuru: g.bakiyeTuru,
          tutar: g.tutar,
          kaynakTipi: g.tip,
          sezonId: (await tx.sezon.findFirst({ where: { firmaId: actor.firmaId, aktif: true } }))?.id,
          aciklama: g.aciklama ?? (g.tip === "ODEME" ? "Ödeme" : "Tahsilat"),
          vadeTarihi: g.vadeTarihi ? new Date(g.vadeTarihi) : undefined,
        },
      });
      await tx.auditKaydi.create({ data: {
        firmaId: actor.firmaId, kullaniciId: actor.id, modul: "FINANS", eylem: "OLUSTUR",
        hedefTipi: "FinansHareket", hedefId: finans.id,
        sonrakiVeri: { tip: g.tip, cariId: g.cariId, hesapId: g.hesapId, bakiyeTuru: g.bakiyeTuru, tutar: g.tutar, aciklama: g.aciklama ?? null },
        aciklama: "Finans hareketi ters kayıtla düzeltilebilir.",
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/");
    revalidatePath("/finans");
    revalidatePath("/cari");
    return { ok: true };
  } catch (e) {
    console.error("createFinansIslem", e);
    return { ok: false, hata: "İşlem kaydedilemedi" };
  }
}

// ─── Virman (hesaplar arası transfer) ─────────────────────────

export interface VirmanGirdi {
  kaynakHesapId: string;
  hedefHesapId: string;
  tutar: number;
  aciklama?: string;
}

export async function createVirman(form: FormData): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("FINANS", "OLUSTUR");
  const kaynakHesapId = form.get("kaynakHesapId") as string | null;
  const hedefHesapId = form.get("hedefHesapId") as string | null;
  const tutar = sayiCevir(form.get("tutar") as string | null);
  const aciklama = (form.get("aciklama") as string | null)?.trim() || undefined;

  if (!kaynakHesapId) return { ok: false, hata: "Kaynak hesap seçilmedi" };
  if (!hedefHesapId) return { ok: false, hata: "Hedef hesap seçilmedi" };
  if (kaynakHesapId === hedefHesapId) return { ok: false, hata: "Kaynak ve hedef aynı olamaz" };
  if (!gecerliSayi(tutar, 0.001, TUTAR_MAKS)) return { ok: false, hata: "Geçerli bir tutar girilmeli" };

  try {
    await prisma.$transaction(async (tx) => {
      const [kaynak, hedef] = await Promise.all([
        tx.kasaHesap.findFirst({ where: { id: kaynakHesapId, firmaId: actor.firmaId } }),
        tx.kasaHesap.findFirst({ where: { id: hedefHesapId, firmaId: actor.firmaId } }),
      ]);

      if (!kaynak || !kaynak.aktif) throw new Error("Kaynak hesap bulunamadı veya pasif");
      if (!hedef || !hedef.aktif) throw new Error("Hedef hesap bulunamadı veya pasif");

      // ── Para birimi kontrolü ──
      if (kaynak.bakiyeTuru !== hedef.bakiyeTuru) {
        throw new Error(`Farklı para birimleri arası virman yapılamaz (${kaynak.bakiyeTuru} → ${hedef.bakiyeTuru})`);
      }

      // 1. ÇIKIŞ
      const cikis = await tx.finansHareket.create({
        data: {
          tip: "VIRMAN",
          firmaId: actor.firmaId,
          hesapId: kaynakHesapId,
          bakiyeTuru: kaynak.bakiyeTuru,
          tutar: -tutar,
          aciklama: aciklama ? `Virman ÇIKIŞ: ${aciklama}` : `Virman ÇIKIŞ → ${hedef.ad}`,
          iliskiliTipi: "VIRMAN",
        },
      });

      // 2. GİRİŞ
      const giris = await tx.finansHareket.create({
        data: {
          tip: "VIRMAN",
          firmaId: actor.firmaId,
          hesapId: hedefHesapId,
          bakiyeTuru: hedef.bakiyeTuru,
          tutar,
          aciklama: aciklama ? `Virman GİRİŞ: ${aciklama}` : `Virman GİRİŞ ← ${kaynak.ad}`,
          iliskiliTipi: "VIRMAN",
          iliskiliId: cikis.id,
        },
      });
      await tx.finansHareket.update({ where: { id: cikis.id }, data: { iliskiliId: giris.id } });
      await tx.auditKaydi.create({ data: {
        firmaId: actor.firmaId, kullaniciId: actor.id, modul: "FINANS", eylem: "OLUSTUR",
        hedefTipi: "Virman", hedefId: cikis.id,
        sonrakiVeri: { kaynakFinansId: cikis.id, hedefFinansId: giris.id, kaynakHesapId, hedefHesapId, tutar },
        aciklama: "Virman iki karşılıklı finans hareketi olarak kaydedildi; düzeltme ters virmanla yapılır.",
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/virman");
    revalidatePath("/finans");
    return { ok: true };
  } catch (e) {
    console.error("createVirman", e);
    const mesaj = e instanceof Error ? e.message : "";
    // Yalnız kendi ürettiğimiz doğrulama mesajları istemciye döner; ham
    // veritabanı hataları (kısıt adları vb.) sızdırılmaz.
    const guvenli = mesaj.startsWith("Kaynak hesap") || mesaj.startsWith("Hedef hesap") || mesaj.startsWith("Farklı para birimleri")
      ? mesaj
      : "Virman kaydedilemedi";
    return { ok: false, hata: guvenli };
  }
}

// Finansal kayıt silinmez; yanlış kayıt bu karşı hareketle dengelenir.
export async function finansHareketiniTersKaydet(finansId: string): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("FINANS", "IPTAL");
  const original = await prisma.finansHareket.findFirst({ where: { id: finansId, firmaId: actor.firmaId } });
  if (!original) return { ok: false, hata: "Finans hareketi bulunamadı" };
  if (original.iliskiliTipi === "TERS_KAYIT") return { ok: false, hata: "Ters kayıt tekrar terslenemez" };
  if (original.iliskiliTipi === "VIRMAN") {
    if (!original.iliskiliId) return { ok: false, hata: "Virman bağ kaydı bulunamadı; bu eski hareket otomatik terslenemez" };
    const karsi = await prisma.finansHareket.findFirst({ where: { id: original.iliskiliId, iliskiliTipi: "VIRMAN", iliskiliId: original.id, firmaId: actor.firmaId } });
    if (!karsi) return { ok: false, hata: "Virmanın karşı hesabı bulunamadı" };
    try {
      await prisma.$transaction(async (tx) => {
        const mevcut = await tx.finansHareket.count({ where: { iliskiliTipi: "TERS_KAYIT", iliskiliId: { in: [original.id, karsi.id] }, firmaId: actor.firmaId } });
        if (mevcut) throw new Error("Bu virman için zaten ters kayıt oluşturulmuş");
        const tersKaynak = await tx.finansHareket.create({ data: { tip: "VIRMAN", firmaId: actor.firmaId, hesapId: original.hesapId, bakiyeTuru: original.bakiyeTuru, tutar: -Number(original.tutar), iliskiliTipi: "TERS_KAYIT", iliskiliId: original.id, aciklama: `Ters virman: ${original.aciklama ?? "Virman"}` } });
        const tersHedef = await tx.finansHareket.create({ data: { tip: "VIRMAN", firmaId: actor.firmaId, hesapId: karsi.hesapId, bakiyeTuru: karsi.bakiyeTuru, tutar: -Number(karsi.tutar), iliskiliTipi: "TERS_KAYIT", iliskiliId: karsi.id, aciklama: `Ters virman: ${karsi.aciklama ?? "Virman"}` } });
        await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "FINANS", eylem: "IPTAL", hedefTipi: "Virman", hedefId: original.id, oncekiVeri: { kaynakFinansId: original.id, hedefFinansId: karsi.id }, sonrakiVeri: { tersKaynakId: tersKaynak.id, tersHedefId: tersHedef.id }, aciklama: "Virman iki karşı hareketle birlikte terslendi." } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      revalidatePath("/"); revalidatePath("/kasa"); revalidatePath("/banka"); revalidatePath("/finans"); revalidatePath("/virman");
      return { ok: true };
    } catch (e) {
      console.error("finansHareketiniTersKaydet virman", e);
      const mesaj = e instanceof Error ? e.message : "";
      return { ok: false, hata: mesaj === "Bu virman için zaten ters kayıt oluşturulmuş" ? mesaj : "Virman ters kaydı oluşturulamadı" };
    }
  }
  try {
    await prisma.$transaction(async (tx) => {
      const mevcutTers = await tx.finansHareket.findFirst({
        where: { iliskiliTipi: "TERS_KAYIT", iliskiliId: original.id, firmaId: actor.firmaId },
        select: { id: true },
      });
      if (mevcutTers) throw new Error("Bu hareket için zaten ters kayıt oluşturulmuş");
      const ters = await tx.finansHareket.create({ data: {
        tip: original.tip,        firmaId: actor.firmaId,
 cariId: original.cariId, hesapId: original.hesapId, bakiyeTuru: original.bakiyeTuru,
        tutar: -Number(original.tutar), kur: original.kur, vadeTarihi: original.vadeTarihi,
        iliskiliTipi: "TERS_KAYIT", iliskiliId: original.id, aciklama: `Ters kayıt: ${original.aciklama ?? original.tip}`,
      } });
      if (original.cariId && (original.tip === "ODEME" || original.tip === "TAHSILAT")) {
        await tx.cariHareket.create({ data: {
          cariId: original.cariId, yon: original.tip === "ODEME" ? "BORC" : "ALACAK", bakiyeTuru: original.bakiyeTuru,
          tutar: Number(original.tutar), kaynakTipi: original.tip, kaynakId: ters.id,
          aciklama: `Ters kayıt: ${original.aciklama ?? original.tip}`,
        } });
      }
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "FINANS", eylem: "IPTAL", hedefTipi: "FinansHareket", hedefId: original.id, oncekiVeri: { id: original.id, tip: original.tip, tutar: Number(original.tutar), hesapId: original.hesapId }, sonrakiVeri: { tersFinansId: ters.id }, aciklama: "Finans hareketi silinmedi; ters kayıt ile dengelendi." } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/"); revalidatePath("/kasa"); revalidatePath("/banka"); revalidatePath("/finans"); revalidatePath("/tahsilat"); revalidatePath("/cari");
    return { ok: true };
  } catch (e) {
    console.error("finansHareketiniTersKaydet", e);
    return { ok: false, hata: e instanceof Error && e.message === "Bu hareket için zaten ters kayıt oluşturulmuş" ? e.message : "Ters kayıt oluşturulamadı" };
  }
}
