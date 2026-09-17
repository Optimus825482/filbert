import { NextResponse } from "next/server";
import { izinVar } from "@/lib/rbac/guard";
import { getCurrentOturum } from "@/lib/auth";
import { offlineKomutuDogrula } from "@/lib/offline/protocol";
import { sesliNotTaslagiKaydet } from "@/lib/sesli-not";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const oturum = await getCurrentOturum();
    const actor = oturum?.kullanici;
    if (!actor?.aktif || !actor.firma.aktif) return NextResponse.json({ hata: "Oturum açmanız gerekiyor" }, { status: 401, headers: { "cache-control": "private, no-store" } });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ hata: "Geçersiz offline komut" }, { status: 400, headers: { "cache-control": "private, no-store" } });
    }
    const komut = offlineKomutuDogrula(body);
    if (!komut) return NextResponse.json({ hata: "Geçersiz offline komut" }, { status: 400 });
    if (komut.sahipKullaniciId !== actor.id) return NextResponse.json({ hata: "Offline komut farklı kullanıcıya ait" }, { status: 403 });

    if (komut.tip === "SESLI_NOT_TASLAGI") {
      if (!izinVar(actor, "SESLI_NOT", "OLUSTUR")) return NextResponse.json({ hata: "Bu işlem için yetkiniz yok" }, { status: 403 });
      const sonuc = await sesliNotTaslagiKaydet(actor, { metin: komut.payload.metin, offlineId: komut.id });
      return NextResponse.json(sonuc, { status: sonuc.ok ? 200 : 422, headers: { "cache-control": "private, no-store" } });
    }

    return NextResponse.json({ hata: "Geçersiz offline komut tipi" }, { status: 400 });
  } catch (error) {
    const mesaj = error instanceof Error ? error.message : "Senkronizasyon başarısız";
    const status = mesaj === "Oturum açmanız gerekiyor" ? 401 : mesaj === "Bu işlem için yetkiniz yok" ? 403 : 500;
    return NextResponse.json({ hata: status === 500 ? "Senkronizasyon başarısız" : mesaj }, { status, headers: { "cache-control": "private, no-store" } });
  }
}
