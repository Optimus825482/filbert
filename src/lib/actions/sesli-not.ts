"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac/guard";
import { sesliNotTaslagiKaydet } from "@/lib/sesli-not";

export async function sesliNotTaslagiOlustur(metin: string, offlineId?: string) {
  const actor = await requirePermission("SESLI_NOT", "OLUSTUR");
  const sonuc = await sesliNotTaslagiKaydet(actor, { metin, offlineId });
  if (sonuc.ok) revalidatePath("/sesli-not");
  return sonuc;
}
