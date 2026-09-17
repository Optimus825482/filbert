"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { finansTaslagiOlustur, type FinansTaslagiGirdi } from "@/lib/finans-taslagi";
import { Prisma } from "@/generated/prisma/client";

export async function sesliFinansTaslagiOlustur(girdi: FinansTaslagiGirdi) { const actor = await requirePermission("SESLI_NOT", "OLUSTUR"); const sonuc = await finansTaslagiOlustur(actor, girdi); if (sonuc.ok) revalidatePath("/finans-taslaklari"); return sonuc; }

export async function finansTaslagiOnayla(g: { taslakId: string; hesapId: string; tip: "ODEME" | "TAHSILAT"; tutar: number; bakiyeTuru: "TL" | "USD" | "EUR" | "XAU"; aciklama?: string }) {
  const actor = await requirePermission("FINANS", "ONAYLA");
  if (!Number.isFinite(g.tutar) || g.tutar <= 0) return { ok: false, hata: "Tutar pozitif ve geçerli bir sayı olmalı" };
  if (!g.taslakId || !g.hesapId) return { ok: false, hata: "Taslak ve hesap seçilmeli" };
  if (!(["ODEME", "TAHSILAT"] as const).includes(g.tip)) return { ok: false, hata: "Geçersiz finans taslak tipi" };
  if (!(["TL", "USD", "EUR", "XAU"] as const).includes(g.bakiyeTuru)) return { ok: false, hata: "Geçersiz para birimi" };
  let sonuc: { ok: true } | { ok: false; hata: string };
  try {
    sonuc = await prisma.$transaction(async (tx) => {
    const taslak = await tx.finansTaslagi.findFirst({ where: { id: g.taslakId, firmaId: actor.firmaId, durum: { in: ["INCELEME_BEKLIYOR", "EKSIK_BILGI"] } } });
    const hesap = await tx.kasaHesap.findFirst({ where: { id: g.hesapId, firmaId: actor.firmaId, aktif: true } });
    if (!taslak || !hesap) return { ok: false as const, hata: "Taslak veya hesap bulunamadı" };
    if (hesap.bakiyeTuru !== g.bakiyeTuru) return { ok: false as const, hata: "Hesap para birimi işlem para birimiyle aynı olmalı" };

    // Koşullu güncelleme taslağı atomik olarak sahiplenir: ikinci bir istek,
    // ilk onay tamamlandıktan sonra finans kaydı oluşturamaz.
    const sahiplenme = await tx.finansTaslagi.updateMany({
      where: { id: taslak.id, firmaId: actor.firmaId, durum: { in: ["INCELEME_BEKLIYOR", "EKSIK_BILGI"] }, finansHareketId: null },
      data: { durum: "ONAYLANDI", onaylayanId: actor.id, sonHatirlatmaAt: new Date() },
    });
    if (sahiplenme.count !== 1) return { ok: false as const, hata: "Taslak başka bir işlem tarafından işlendi" };

    const finans = await tx.finansHareket.create({ data: { tip: g.tip, firmaId: actor.firmaId, cariId: taslak.cariId, hesapId: hesap.id, bakiyeTuru: g.bakiyeTuru, tutar: g.tutar, iliskiliTipi: "SESLI_FINANS_TASLAGI", iliskiliId: taslak.id, aciklama: g.aciklama?.trim() || taslak.onerilenAciklama || "Sesli finans taslağından oluşturuldu" } });
    await tx.cariHareket.create({ data: { cariId: taslak.cariId, yon: g.tip === "ODEME" ? "ALACAK" : "BORC", bakiyeTuru: g.bakiyeTuru, tutar: g.tutar, kaynakTipi: g.tip, kaynakId: finans.id, aciklama: finans.aciklama } });
    await tx.finansTaslagi.update({ where: { id: taslak.id }, data: { finansHareketId: finans.id } });
    await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "FINANS", eylem: "ONAYLA", hedefTipi: "FinansTaslagi", hedefId: taslak.id, sonrakiVeri: { finansHareketId: finans.id, tip: g.tip, tutar: g.tutar, hesapId: hesap.id }, aciklama: "Sesli finans taslağı kontrol edilerek finans hareketine dönüştürüldü." } });
    return { ok: true as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    console.error("finansTaslagiOnayla", error);
    return { ok: false, hata: "Finans taslağı onaylanırken işlem tamamlanamadı" };
  }
  if (!sonuc.ok) return sonuc;
  revalidatePath("/finans-taslaklari"); revalidatePath("/finans"); revalidatePath("/cari"); return sonuc;
}

export async function finansTaslagiReddet(taslakId: string, neden?: string) {
  const actor = await requirePermission("FINANS", "IPTAL");
  let sonuc: { ok: true } | { ok: false; hata: string };
  try {
    sonuc = await prisma.$transaction(async (tx) => {
    const taslak = await tx.finansTaslagi.findFirst({ where: { id: taslakId, firmaId: actor.firmaId, durum: { in: ["INCELEME_BEKLIYOR", "EKSIK_BILGI"] }, finansHareketId: null } });
    if (!taslak) return { ok: false as const, hata: "İncelenecek finans taslağı bulunamadı" };
    const reddetme = await tx.finansTaslagi.updateMany({ where: { id: taslak.id, firmaId: actor.firmaId, durum: { in: ["INCELEME_BEKLIYOR", "EKSIK_BILGI"] }, finansHareketId: null }, data: { durum: "REDDEDILDI", onaylayanId: actor.id, redNedeni: neden?.trim() || null } });
    if (reddetme.count !== 1) return { ok: false as const, hata: "Taslak başka bir işlem tarafından işlendi" };
    await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "FINANS", eylem: "IPTAL", hedefTipi: "FinansTaslagi", hedefId: taslak.id, oncekiVeri: { durum: taslak.durum }, sonrakiVeri: { durum: "REDDEDILDI", neden: neden?.trim() || null }, aciklama: "Sesli finans taslağı reddedildi; finans kaydı oluşturulmadı." } });
    return { ok: true as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    console.error("finansTaslagiReddet", error);
    return { ok: false, hata: "Finans taslağı reddedilirken işlem tamamlanamadı" };
  }
  if (!sonuc.ok) return sonuc;
  revalidatePath("/finans-taslaklari");
  return sonuc;
}
