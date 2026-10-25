import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFirma } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

/**
 * Fındık İşleme Modülü — Dinamik Müşteri Arama Ucu.
 * Statik 500 müşteri sınırını kaldırarak müşterileri isim veya telefonla
 * gerçek zamanlı ve sayfalamaya uygun biçimde arar.
 */
export async function GET(request: Request) {
  try {
    await requirePermission("HIZMET", "GORUNTULE");
    const firma = await getCurrentFirma();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const qRakam = q.replace(/\D/g, "");

    const orKriterleri = q
      ? [
          { ad: { contains: q, mode: "insensitive" as const } },
          { telefon: { contains: q } },
          ...(qRakam && qRakam !== q && qRakam.length >= 3
            ? [{ telefon: { contains: qRakam } }]
            : []),
        ]
      : undefined;

    const musteriler = await prisma.musteri.findMany({
      where: {
        firmaId: firma.id,
        aktif: true,
        ...(orKriterleri ? { OR: orKriterleri } : {}),
      },
      select: { id: true, ad: true, telefon: true },
      orderBy: { ad: "asc" },
      take: 30,
    });

    return NextResponse.json({
      ok: true,
      musteriler: musteriler.map((m) => ({
        id: m.id,
        ad: m.ad,
        telefon: m.telefon || "",
      })),
    });
  } catch (err: unknown) {
    const mesaj = err instanceof Error ? err.message : "Müşteri aranamadı";
    return NextResponse.json(
      { ok: false, hata: mesaj, musteriler: [] },
      { status: 400 }
    );
  }
}
