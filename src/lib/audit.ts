"server only";
import type { Prisma, UygulamaModulu, AuditEylemi } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentOturum } from "@/lib/auth";

export async function auditYaz(g: { modul?: UygulamaModulu; eylem: AuditEylemi; hedefTipi: string; hedefId: string; oncekiVeri?: Prisma.InputJsonValue; sonrakiVeri?: Prisma.InputJsonValue; aciklama?: string }) {
  const session = await getCurrentOturum();
  const user = session?.kullanici;
  await prisma.auditKaydi.create({ data: { firmaId: user?.firmaId, kullaniciId: user?.id, sistemYoneticisiId: session?.sistemYoneticisi?.id, modul: g.modul, eylem: g.eylem, hedefTipi: g.hedefTipi, hedefId: g.hedefId, oncekiVeri: g.oncekiVeri, sonrakiVeri: g.sonrakiVeri, aciklama: g.aciklama } });
}
