"server only";
import { createHash, createHmac, randomBytes, scrypt as rawScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
const scrypt = promisify(rawScrypt), COOKIE = "filbert_session", SETUP_COOKIE = "filbert_setup_authorized", DAY = 86_400_000, SETUP_WINDOW_MS = 10 * 60_000;
export async function sifreHashle(sifre: string) { const salt = randomBytes(16).toString("hex"), hash = await scrypt(sifre, salt, 64) as Buffer; return `scrypt:${salt}:${hash.toString("hex")}`; }
export async function sifreDogrula(sifre: string, stored: string) { const [algoritma, salt, expected] = stored.split(":"); if (algoritma !== "scrypt" || !salt || !/^[a-f0-9]{128}$/i.test(expected ?? "")) return false; const hesaplanan = await scrypt(sifre, salt, 64) as Buffer; const beklenen = Buffer.from(expected, "hex"); return beklenen.length === hesaplanan.length && timingSafeEqual(hesaplanan, beklenen); }
export function gizliDegerDogrula(girdi: string, beklenen: string | undefined) { if (!beklenen) return false; const sol = Buffer.from(girdi), sag = Buffer.from(beklenen); return sol.length === sag.length && timingSafeEqual(sol, sag); }
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function oturumOlustur(actor: { kullaniciId?: string; sistemYoneticisiId?: string }, beniHatirla = true) { const token = randomBytes(32).toString("base64url"); await prisma.oturum.create({ data: { ...actor, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * DAY) } }); (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: beniHatirla ? 30 * 24 * 60 * 60 : undefined }); }
export async function oturumKapat() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  const session = token ? await getCurrentOturum() : null;
  if (token) await prisma.oturum.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
  if (session) await prisma.auditKaydi.create({ data: { firmaId: session.kullanici?.firmaId, kullaniciId: session.kullanici?.id, sistemYoneticisiId: session.sistemYoneticisi?.id, eylem: "CIKIS", hedefTipi: "Oturum", hedefId: session.id, aciklama: "Kullanıcı oturumu güvenli şekilde kapatıldı." } });
  cookieStore.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}
function setupImzasi(zaman: string) { const anahtar = process.env.SYSTEM_ADMIN_PASS; return anahtar ? createHmac("sha256", anahtar).update(`filbert-setup:${zaman}`).digest("base64url") : ""; }
export async function setupYetkisiVer() { const zaman = String(Date.now()), imza = setupImzasi(zaman); if (!imza) return; (await cookies()).set(SETUP_COOKIE, `${zaman}.${imza}`, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/setup", maxAge: Math.floor(SETUP_WINDOW_MS / 1000) }); }
export async function setupYetkisiVar() { const deger = (await cookies()).get(SETUP_COOKIE)?.value; const [zaman, imza] = deger?.split(".") ?? []; const beklenen = zaman ? setupImzasi(zaman) : ""; if (!zaman || !imza || !beklenen || !/^\d+$/.test(zaman) || Date.now() - Number(zaman) > SETUP_WINDOW_MS || Number(zaman) > Date.now()) return false; const sol = Buffer.from(imza), sag = Buffer.from(beklenen); return sol.length === sag.length && timingSafeEqual(sol, sag); }
export async function setupYetkisiniTemizle() { (await cookies()).set(SETUP_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/setup", maxAge: 0 }); }
export async function getCurrentOturum() { const token = (await cookies()).get(COOKIE)?.value; return token ? prisma.oturum.findFirst({ where: { tokenHash: tokenHash(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { kullanici: { include: { firma: true, roller: { include: { rol: { include: { izinler: true } } } } } }, sistemYoneticisi: true } }) : null; }
export async function getCurrentFirma() { const user = (await getCurrentOturum())?.kullanici; if (!user?.aktif || !user.firma.aktif) throw new Error("Oturum açmanız gerekiyor"); return user.firma; }
export async function getCurrentFirmaId() { return (await getCurrentFirma()).id; }
export async function requireSistemYonetici() { const yonetici = (await getCurrentOturum())?.sistemYoneticisi; if (!yonetici?.aktif) throw new Error("Sistem yöneticisi oturumu gerekiyor"); return yonetici; }
