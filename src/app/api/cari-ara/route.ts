import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const actor = await requirePermission("CARI", "GORUNTULE");
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
    if (q.length < 2) return NextResponse.json([]);

    const cariler = await prisma.cariKart.findMany({
      where: { firmaId: actor.firmaId, aktif: true, ad: { contains: q, mode: "insensitive" } },
      select: { id: true, ad: true, tur: true, bolge: true },
      take: 10,
      orderBy: [{ favori: "desc" }, { ad: "asc" }],
    });

    return NextResponse.json(cariler, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const mesaj = error instanceof Error ? error.message : "Müşteri araması başarısız";
    const status = mesaj === "Oturum açmanız gerekiyor" ? 401 : mesaj === "Bu işlem için yetkiniz yok" ? 403 : 500;
    return NextResponse.json({ hata: status === 500 ? "Müşteri araması başarısız" : mesaj }, { status });
  }
}
