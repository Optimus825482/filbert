import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { izinVar, requirePermission } from "@/lib/rbac/guard";

const MAX_BYTES = 10 * 1024 * 1024;

// MIME etiketi yanıltıcı olabileceğinden ses dosyası büyüsü (ilk baytlar)
// doğrulanır; tarayıcı mikrofon kayıtlarının çıktığı kapsayıcılar kabul edilir.
function sesImzasiGecerli(veri: Uint8Array): boolean {
  if (veri.length < 12) return false;
  const imza = (offset: number, ...bayt: number[]) => bayt.every((b, i) => veri[offset + i] === b);
  const ascii = (offset: number, metin: string) => imza(offset, ...[...metin].map((c) => c.charCodeAt(0)));
  // Ogg / Opus
  if (ascii(0, "OggS")) return true;
  // WAV: RIFF....WAVE
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return true;
  // MP3: ID3 etiketi veya MPEG çerçevesi
  if (ascii(0, "ID3")) return true;
  if (veri[0] === 0xff && (veri[1] & 0xe0) === 0xe0) return true;
  // MP4 / M4A / AAC (ISO BMFF): ....ftyp
  return ascii(4, "ftyp");
}

function yetkiHatasi(error: unknown) {
  const mesaj = error instanceof Error ? error.message : "Ses kaydı yüklenemedi";
  const status = mesaj === "Oturum açmanız gerekiyor" ? 401 : mesaj === "Bu işlem için yetkiniz yok" ? 403 : 500;
  return NextResponse.json({ hata: status === 500 ? "Ses kaydı yüklenemedi" : mesaj }, { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("SESLI_NOT", "OLUSTUR");
    const { id } = await params;
    const not = await prisma.sesliNot.findFirst({ where: { id, firmaId: actor.firmaId, kullaniciId: actor.id } });
    if (!not) return NextResponse.json({ hata: "Sesli not bulunamadı" }, { status: 404 });
    const file = (await request.formData()).get("audio");
    if (!(file instanceof File) || !file.type.startsWith("audio/") || file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ hata: "En fazla 10 MB geçerli ses dosyası yüklenebilir" }, { status: 400 });
    const veri = Buffer.from(await file.arrayBuffer());
    if (!sesImzasiGecerli(new Uint8Array(veri))) return NextResponse.json({ hata: "Dosya içeriği geçerli bir ses kapsayıcısı değil" }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      const onceki = await tx.sesKaydi.findUnique({ where: { sesliNotId: id } });
      const kayit = await tx.sesKaydi.upsert({ where: { sesliNotId: id }, create: { sesliNotId: id, mimeTipi: file.type, veri, boyutByte: file.size }, update: { mimeTipi: file.type, veri, boyutByte: file.size } });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "SESLI_NOT", eylem: onceki ? "GUNCELLE" : "OLUSTUR", hedefTipi: "SesKaydi", hedefId: kayit.id, oncekiVeri: onceki ? { mimeTipi: onceki.mimeTipi, boyutByte: onceki.boyutByte } : undefined, sonrakiVeri: { sesliNotId: id, mimeTipi: kayit.mimeTipi, boyutByte: kayit.boyutByte }, aciklama: "Sesli nota ait ses kaydı eklendi veya güncellendi." } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return yetkiHatasi(error); }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("SESLI_NOT", "GORUNTULE");
    const { id } = await params;
    // Finansal ses kaydı gizlidir: yalnız notun sahibi dinleyebilir. Finans
    // taslağını incelemekle yetkili onaycılar da kaydı dinleyebilir. Önceki
    // sürüm yalnız firmaId ile kapsamlandığı için aynı firmadaki herhangi bir
    // kullanıcı başkasının kaydına erişebiliyordu.
    const inceleyici = izinVar(actor, "FINANS", "ONAYLA");
    const kayit = await prisma.sesKaydi.findFirst({
      where: { sesliNotId: id, sesliNot: { firmaId: actor.firmaId, ...(inceleyici ? {} : { kullaniciId: actor.id }) } },
    });
    if (!kayit) return new NextResponse(null, { status: 404 });
    const tur = kayit.mimeTipi.includes("ogg") ? "ogg" : kayit.mimeTipi.includes("webm") ? "webm" : kayit.mimeTipi.includes("mp4") || kayit.mimeTipi.includes("m4a") ? "m4a" : kayit.mimeTipi.includes("wav") ? "wav" : "mp3";
    // İçerik satır içi, sabit adla sunulur; tarayıcı MIME'a göre davranır.
    return new Response(kayit.veri, { headers: { "content-type": kayit.mimeTipi, "content-length": String(kayit.boyutByte), "cache-control": "private, no-store", "content-disposition": `inline; filename="ses-${kayit.id.slice(0, 8)}.${tur}"` } });
  } catch (error) { return yetkiHatasi(error); }
}
