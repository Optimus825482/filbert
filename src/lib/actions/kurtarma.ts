"use server";
import { revalidatePath } from "next/cache";
import { auditGeriYukle } from "@/lib/recovery";
export async function geriYukleAuditKaydi(id: string) { const result = await auditGeriYukle(id); if (result.ok) { revalidatePath("/ayarlar/kurtarma"); revalidatePath("/ayarlar"); revalidatePath("/ayarlar/roller"); revalidatePath("/fiyatlar"); revalidatePath("/avans"); revalidatePath("/cari"); revalidatePath("/cari/hesaplar"); revalidatePath("/cari/[id]", "page"); revalidatePath("/"); } return result; }
