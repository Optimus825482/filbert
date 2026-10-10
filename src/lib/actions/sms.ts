"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac/guard";
import { smsKaydiTekrarGonder, smsTeslimDurumunuYenile } from "@/lib/sms/sms-servisi";

/**
 * SMS Merkezi aksiyonları.
 *
 * Gönderim akışının kendisi talep işlemleri içinde çalışır; buradaki aksiyonlar
 * yalnızca izleme ekranından yapılan iki işlemi yürütür: sağlayıcıdan teslim
 * raporu çekmek ve başarısız bir gönderimi yeniden denemek.
 */

export async function smsTeslimDurumlariniYenile(
  kayitId?: string
): Promise<{ ok: boolean; guncellenen: number; hata?: string }> {
  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const sonuc = await smsTeslimDurumunuYenile(actor.firmaId, kayitId);
    if (sonuc.ok) revalidatePath("/hizmet/sms");
    return sonuc;
  } catch (e) {
    console.error("smsTeslimDurumlariniYenile", e);
    return { ok: false, guncellenen: 0, hata: "Teslim durumu sorgulanamadı" };
  }
}

export async function smsKaydiYenidenGonder(
  kayitId: string
): Promise<{ ok: boolean; hata?: string; simulasyon?: boolean; mesajId?: string }> {
  if (!kayitId) return { ok: false, hata: "Kayıt seçilmedi" };

  try {
    const actor = await requirePermission("HIZMET", "GUNCELLE");
    const sonuc = await smsKaydiTekrarGonder(actor.firmaId, kayitId, actor.id);
    revalidatePath("/hizmet/sms");
    if (!sonuc.basarili) return { ok: false, hata: sonuc.hata || "SMS gönderilemedi" };
    return { ok: true, simulasyon: sonuc.simulasyon, mesajId: sonuc.mesajId };
  } catch (e) {
    console.error("smsKaydiYenidenGonder", e);
    return { ok: false, hata: "SMS yeniden gönderilemedi" };
  }
}