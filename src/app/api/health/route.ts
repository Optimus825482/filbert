import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Konteyner hazır-olma (readiness) denetimi. Yalnızca sunucu ayakta değil,
// şeması kurulmuş veritabanına da erişilebildiğinde başarılı döner; böylece
// Coolify/Traefik, veritabanına bağlanamayan bir konteynere trafik göndermez.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { durum: "saglikli", veritabani: "bagli" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { durum: "sagliksiz", veritabani: "bagli-degil" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
