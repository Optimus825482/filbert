"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";

export type HFMusteri = { id: string; ad: string; tur: string };

export async function hfMusteriAra(sorgu: string): Promise<{ ok: true; kayitlar: HFMusteri[] } | { ok: false; hata: string }> {
  const actor = await requirePermission("CARI", "GORUNTULE");
  const metin = sorgu.trim().replace(/\s+/g, " ");
  if (metin.length < 2) return { ok: false, hata: "Müşteri adı en az iki karakter olmalı." };
  const kayitlar = await prisma.cariKart.findMany({
    where: { firmaId: actor.firmaId, aktif: true, ad: { contains: metin, mode: "insensitive" } },
    select: { id: true, ad: true, tur: true }, orderBy: [{ favori: "desc" }, { ad: "asc" }], take: 5,
  });
  return { ok: true, kayitlar };
}

export async function hfCariBakiyesi(cariId: string): Promise<{ ok: true; ad: string; bakiyeler: Record<string, number> } | { ok: false; hata: string }> {
  const actor = await requirePermission("CARI", "GORUNTULE");
  const cari = await prisma.cariKart.findFirst({ where: { id: cariId, firmaId: actor.firmaId, aktif: true }, select: { id: true, ad: true } });
  if (!cari) return { ok: false, hata: "Müşteri bulunamadı." };
  const gruplar = await prisma.cariHareket.groupBy({ by: ["bakiyeTuru", "yon"], where: { cariId: cari.id }, _sum: { tutar: true } });
  const bakiyeler: Record<string, number> = {};
  for (const grup of gruplar) bakiyeler[grup.bakiyeTuru] = (bakiyeler[grup.bakiyeTuru] ?? 0) + (grup.yon === "ALACAK" ? Number(grup._sum.tutar ?? 0) : -Number(grup._sum.tutar ?? 0));
  return { ok: true, ad: cari.ad, bakiyeler };
}
