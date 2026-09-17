import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentOturum } from "@/lib/auth";
import { KurulumYetkileri } from "./yetki-form";

export default async function YetkilerPage({ params }: { params: Promise<{ firmaId: string }> }) {
  const { firmaId } = await params;
  const yonetici = (await getCurrentOturum())?.sistemYoneticisi;
  if (!yonetici?.aktif) redirect("/giris");
  const firma = await prisma.firma.findFirst({ where: { id: firmaId, kuranSistemYoneticisiId: yonetici.id }, include: { yetkiRolleri: { include: { izinler: true }, orderBy: { ad: "asc" } } } });
  if (!firma) notFound();
  return <main className="mx-auto min-h-screen max-w-4xl p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kurulum · 3/3</p><h1 className="mt-1 text-3xl font-extrabold">Yetki grupları</h1><p className="mt-2 text-sm text-muted-foreground">{firma.unvan} için rol ve modül izinlerini tanımlayın. Firma Sahibi tam yetkiyle hazırdır.</p><KurulumYetkileri firmaId={firma.id} roller={firma.yetkiRolleri.map(r => ({ ad: r.ad, izinSayisi: r.izinler.length }))} /></main>;
}
