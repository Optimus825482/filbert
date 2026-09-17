"server only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { izinlerGecerli, type Izin } from "@/lib/rbac/permissions";
import { Prisma } from "@/generated/prisma/client";

type FirmaSnapshot = { unvan: string; vergiNo?: string | null; vergiDairesi?: string | null; adres?: string | null; telefon?: string | null };
type DepoSnapshot = { ad: string; subeId?: string | null; aktif?: boolean };
type HesapSnapshot = { ad: string; tip: "KASA" | "BANKA"; bakiyeTuru: "TL" | "USD" | "EUR" | "XAU"; bankaAdi?: string | null; iban?: string | null; aktif?: boolean };
type AracSnapshot = { plaka: string; marka?: string | null; tip?: string; sofor?: string | null; aktif?: boolean };
type PersonelSnapshot = { ad: string; telefon?: string | null; gorev?: string; tckn?: string | null; aktif?: boolean };
type SezonSnapshot = { ad: string; baslangic: string; bitis: string; aktif?: boolean };
type KullaniciSnapshot = { ad: string; telefon?: string | null; rol?: "PATRON" | "MUHASEBE" | "KANTAR" | "SAHA" | "SALT_OKUNUR" | null; aktif?: boolean };
type KullaniciRolSnapshot = { rolIds: string[] };
type YetkiRoluIzinSnapshot = { izinler: Izin[] };
type AktiflikSnapshot = { aktif: boolean };
type CariKartSnapshot = { ad: string; tur: "URETICI" | "TUCCAR" | "FABRIKA"; tckn?: string | null; vergiNo?: string | null; telefon?: string | null; bolge?: string | null; notAlani?: string | null; favori?: boolean; aktif?: boolean };
function firmaSnapshot(value: unknown): value is FirmaSnapshot { return typeof value === "object" && value !== null && typeof (value as FirmaSnapshot).unvan === "string"; }
function depoSnapshot(value: unknown): value is DepoSnapshot { return typeof value === "object" && value !== null && typeof (value as DepoSnapshot).ad === "string"; }
function hesapSnapshot(value: unknown): value is HesapSnapshot { return typeof value === "object" && value !== null && typeof (value as HesapSnapshot).ad === "string" && typeof (value as HesapSnapshot).tip === "string" && typeof (value as HesapSnapshot).bakiyeTuru === "string"; }
function aracSnapshot(value: unknown): value is AracSnapshot { return typeof value === "object" && value !== null && typeof (value as AracSnapshot).plaka === "string"; }
function personelSnapshot(value: unknown): value is PersonelSnapshot { return typeof value === "object" && value !== null && typeof (value as PersonelSnapshot).ad === "string"; }
function sezonSnapshot(value: unknown): value is SezonSnapshot { return typeof value === "object" && value !== null && typeof (value as SezonSnapshot).ad === "string" && typeof (value as SezonSnapshot).baslangic === "string" && typeof (value as SezonSnapshot).bitis === "string"; }
function kullaniciSnapshot(value: unknown): value is KullaniciSnapshot { return typeof value === "object" && value !== null && typeof (value as KullaniciSnapshot).ad === "string"; }
function kullaniciRolSnapshot(value: unknown): value is KullaniciRolSnapshot { return typeof value === "object" && value !== null && Array.isArray((value as KullaniciRolSnapshot).rolIds) && (value as KullaniciRolSnapshot).rolIds.every((id) => typeof id === "string" && id.length > 0); }
function yetkiRoluIzinSnapshot(value: unknown): value is YetkiRoluIzinSnapshot { return typeof value === "object" && value !== null && izinlerGecerli((value as YetkiRoluIzinSnapshot).izinler); }
function aktiflikSnapshot(value: unknown): value is AktiflikSnapshot { return typeof value === "object" && value !== null && typeof (value as AktiflikSnapshot).aktif === "boolean"; }
function cariKartSnapshot(value: unknown): value is CariKartSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as CariKartSnapshot;
  return typeof snapshot.ad === "string"
    && snapshot.ad.trim().length >= 2
    && ["URETICI", "TUCCAR", "FABRIKA"].includes(snapshot.tur)
    && (snapshot.favori === undefined || typeof snapshot.favori === "boolean")
    && (snapshot.aktif === undefined || typeof snapshot.aktif === "boolean");
}

export async function auditGeriYukle(auditId: string): Promise<{ ok: boolean; hata?: string }> {
  try {
    return await auditGeriYukleDahili(auditId);
  } catch (error) {
    console.error("auditGeriYukle", error);
    return { ok: false, hata: "Kayıt geri yüklenemedi. Kayıt değişmiş veya artık kullanılamıyor olabilir." };
  }
}

async function auditGeriYukleDahili(auditId: string): Promise<{ ok: boolean; hata?: string }> {
  const actor = await requirePermission("AYARLAR", "YONET");
  const audit = await prisma.auditKaydi.findFirst({ where: { id: auditId, firmaId: actor.firmaId } });
  if (!audit?.oncekiVeri) return { ok: false, hata: "Bu audit kaydında geri yüklenecek önceki sürüm yok" };
  if (!audit.hedefId) return { ok: false, hata: "Kurtarma hedefi eksik" };
  if (!["Firma", "Depo", "KasaHesap", "Arac", "Personel", "Sezon", "Kullanici", "KullaniciRol", "YetkiRolu", "CariKart"].includes(audit.hedefTipi ?? "")) return { ok: false, hata: "Bu kayıt için otomatik geri yükleme henüz desteklenmiyor" };
  const targetId = audit.hedefId;
  if (!targetId) return { ok: false, hata: "Kurtarma hedefi eksik" };
  const snapshot = audit.oncekiVeri;
  if (audit.hedefTipi === "KullaniciRol") {
    if (!kullaniciRolSnapshot(snapshot) || !snapshot.rolIds.length) return { ok: false, hata: "Kullanıcı rol snapshot geçersiz" };
    try {
      await prisma.$transaction(async (tx) => {
        const kullanici = await tx.kullanici.findFirst({ where: { id: targetId, firmaId: actor.firmaId }, include: { roller: { include: { rol: true } } } });
        if (!kullanici) throw new Error("KULLANICI_YOK");
        const roller = await tx.yetkiRolu.findMany({ where: { id: { in: snapshot.rolIds }, firmaId: actor.firmaId, aktif: true }, select: { id: true } });
        if (roller.length !== new Set(snapshot.rolIds).size) throw new Error("GECERSIZ_ROL");
        const sahipRolu = kullanici.roller.find((atama) => atama.rol.sistemRolu && atama.rol.kod === "FIRMA_SAHIBI");
        if (sahipRolu && !snapshot.rolIds.includes(sahipRolu.rolId)) throw new Error("SAHIP_ROLU");
        await tx.kullaniciRol.deleteMany({ where: { kullaniciId: kullanici.id } });
        await tx.kullaniciRol.createMany({ data: roller.map((rol) => ({ kullaniciId: kullanici.id, rolId: rol.id })) });
        await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "GUNCELLE", hedefTipi: "KullaniciRol", hedefId: kullanici.id, oncekiVeri: { rolIds: kullanici.roller.map((atama) => atama.rolId) }, sonrakiVeri: { rolIds: snapshot.rolIds }, aciklama: `Audit kaydı ${audit.id} üzerinden kullanıcı yetkileri geri yüklendi` } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const kod = error instanceof Error ? error.message : "";
      if (kod === "KULLANICI_YOK") return { ok: false, hata: "Kullanıcı bulunamadı" };
      if (kod === "GECERSIZ_ROL") return { ok: false, hata: "Snapshot içindeki rol pasif veya firma kapsamı dışında" };
      if (kod === "SAHIP_ROLU") return { ok: false, hata: "Firma Sahibi rolü geri yükleme ile kaldırılamaz" };
      return { ok: false, hata: "Kullanıcı yetkileri geri yüklenemedi" };
    }
    return { ok: true };
  }
  if (audit.hedefTipi === "YetkiRolu") {
    if (yetkiRoluIzinSnapshot(snapshot)) {
      try {
        await prisma.$transaction(async (tx) => {
          const rol = await tx.yetkiRolu.findFirst({ where: { id: targetId, firmaId: actor.firmaId }, include: { izinler: true } });
          if (!rol) throw new Error("ROL_YOK");
          await tx.rolIzni.deleteMany({ where: { rolId: rol.id } });
          if (snapshot.izinler.length) await tx.rolIzni.createMany({ data: snapshot.izinler.map((izin) => ({ rolId: rol.id, ...izin })) });
          await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "YETKILENDIR", hedefTipi: "YetkiRolu", hedefId: rol.id, oncekiVeri: { izinler: rol.izinler.map((izin) => ({ modul: izin.modul, eylem: izin.eylem })) }, sonrakiVeri: { izinler: snapshot.izinler }, aciklama: `Audit kaydı ${audit.id} üzerinden rol izinleri geri yüklendi` } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        return { ok: false, hata: error instanceof Error && error.message === "ROL_YOK" ? "Rol bulunamadı" : "Rol izinleri geri yüklenemedi" };
      }
      return { ok: true };
    }
    if (aktiflikSnapshot(snapshot)) {
      try {
        await prisma.$transaction(async (tx) => {
          const rol = await tx.yetkiRolu.findFirst({ where: { id: targetId, firmaId: actor.firmaId }, include: { kullanicilar: { include: { kullanici: { include: { roller: { include: { rol: true } } } } } } } });
          if (!rol) throw new Error("ROL_YOK");
          if (rol.sistemRolu && snapshot.aktif === false) throw new Error("SISTEM_ROLU");
          if (rol.aktif && snapshot.aktif === false) {
            const korumasiz = rol.kullanicilar.some((atama) => atama.kullanici.aktif && !atama.kullanici.roller.some((diger) => diger.rolId !== rol.id && diger.rol.aktif));
            if (korumasiz) throw new Error("KORUMASIZ_KULLANICI");
          }
          await tx.yetkiRolu.update({ where: { id: rol.id }, data: { aktif: snapshot.aktif } });
          await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "GUNCELLE", hedefTipi: "YetkiRolu", hedefId: rol.id, oncekiVeri: { aktif: rol.aktif }, sonrakiVeri: { aktif: snapshot.aktif }, aciklama: `Audit kaydı ${audit.id} üzerinden rol aktifliği geri yüklendi` } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        const kod = error instanceof Error ? error.message : "";
        if (kod === "ROL_YOK") return { ok: false, hata: "Rol bulunamadı" };
        if (kod === "SISTEM_ROLU") return { ok: false, hata: "Firma Sahibi rolü pasifleştirilemez" };
        if (kod === "KORUMASIZ_KULLANICI") return { ok: false, hata: "Bu rol pasifleştirilirse yetkisiz kalacak aktif kullanıcılar var" };
        return { ok: false, hata: "Rol aktifliği geri yüklenemedi" };
      }
      return { ok: true };
    }
    return { ok: false, hata: "Rol snapshot geçersiz" };
  }
  if (audit.hedefTipi === "CariKart") {
    if (!cariKartSnapshot(snapshot)) return { ok: false, hata: "Cari kart snapshot geçersiz" };
    await prisma.$transaction(async (tx) => {
      const current = await tx.cariKart.findFirst({ where: { id: targetId, firmaId: actor.firmaId } });
      if (!current) throw new Error("Cari kart bulunamadı");
      const sonraki = {
        ad: snapshot.ad.trim(),
        tur: snapshot.tur,
        tckn: snapshot.tckn ?? null,
        vergiNo: snapshot.vergiNo ?? null,
        telefon: snapshot.telefon ?? null,
        bolge: snapshot.bolge ?? null,
        notAlani: snapshot.notAlani ?? null,
        favori: snapshot.favori ?? false,
        aktif: snapshot.aktif ?? true,
      };
      await tx.cariKart.update({ where: { id: current.id }, data: sonraki });
      await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "CARI", eylem: "GUNCELLE", hedefTipi: "CariKart", hedefId: current.id, oncekiVeri: { ad: current.ad, tur: current.tur, tckn: current.tckn, vergiNo: current.vergiNo, telefon: current.telefon, bolge: current.bolge, notAlani: current.notAlani, favori: current.favori, aktif: current.aktif }, sonrakiVeri: sonraki, aciklama: `Audit kaydı ${audit.id} üzerinden cari kart geri yüklendi` } });
    });
    return { ok: true };
  }
  if (audit.hedefTipi === "Depo") {
    if (!depoSnapshot(snapshot)) return { ok: false, hata: "Depo snapshot geçersiz" };
    await prisma.$transaction(async (tx) => { const current = await tx.depo.findFirst({ where: { id: targetId, firmaId: actor.firmaId } }); if (!current) throw new Error("Depo bulunamadı"); await tx.depo.update({ where: { id: current.id }, data: snapshot }); await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "Depo", hedefId: current.id, oncekiVeri: { ad: current.ad, subeId: current.subeId, aktif: current.aktif }, sonrakiVeri: snapshot, aciklama: `Audit kaydı ${audit.id} üzerinden geri yüklendi` } }); });
    return { ok: true };
  }
  if (audit.hedefTipi === "KasaHesap") {
    if (!hesapSnapshot(snapshot)) return { ok: false, hata: "Hesap snapshot geçersiz" };
    await prisma.$transaction(async (tx) => { const current = await tx.kasaHesap.findFirst({ where: { id: targetId, firmaId: actor.firmaId } }); if (!current) throw new Error("Hesap bulunamadı"); await tx.kasaHesap.update({ where: { id: current.id }, data: snapshot }); await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "TANIMLAR", eylem: "GUNCELLE", hedefTipi: "KasaHesap", hedefId: current.id, oncekiVeri: { ad: current.ad, tip: current.tip, bakiyeTuru: current.bakiyeTuru, bankaAdi: current.bankaAdi, iban: current.iban, aktif: current.aktif }, sonrakiVeri: snapshot, aciklama: `Audit kaydı ${audit.id} üzerinden geri yüklendi` } }); });
    return { ok: true };
  }
  if (audit.hedefTipi === "Arac") {
    if (!aracSnapshot(snapshot)) return { ok: false, hata: "Araç snapshot geçersiz" };
    await prisma.$transaction(async (tx) => { const current=await tx.arac.findFirst({where:{id:targetId,firmaId:actor.firmaId}}); if(!current)throw new Error("Araç bulunamadı"); await tx.arac.update({where:{id:current.id},data:snapshot}); await tx.auditKaydi.create({data:{firmaId:actor.firmaId,kullaniciId:actor.id,modul:"TANIMLAR",eylem:"GUNCELLE",hedefTipi:"Arac",hedefId:current.id,oncekiVeri:{plaka:current.plaka,marka:current.marka,tip:current.tip,sofor:current.sofor,aktif:current.aktif},sonrakiVeri:snapshot,aciklama:`Audit kaydı ${audit.id} üzerinden geri yüklendi`}}); });
    return { ok: true };
  }
  if (audit.hedefTipi === "Personel") { if(!personelSnapshot(snapshot))return {ok:false,hata:"Personel snapshot geçersiz"}; await prisma.$transaction(async tx=>{const current=await tx.personel.findFirst({where:{id:targetId,firmaId:actor.firmaId}});if(!current)throw new Error("Personel bulunamadı");await tx.personel.update({where:{id:current.id},data:snapshot});await tx.auditKaydi.create({data:{firmaId:actor.firmaId,kullaniciId:actor.id,modul:"TANIMLAR",eylem:"GUNCELLE",hedefTipi:"Personel",hedefId:current.id,oncekiVeri:{ad:current.ad,telefon:current.telefon,gorev:current.gorev,tckn:current.tckn,aktif:current.aktif},sonrakiVeri:snapshot,aciklama:`Audit kaydı ${audit.id} üzerinden geri yüklendi`}})});return {ok:true}; }
  if (audit.hedefTipi === "Sezon") { if(!sezonSnapshot(snapshot))return {ok:false,hata:"Sezon snapshot geçersiz"}; await prisma.$transaction(async tx=>{const current=await tx.sezon.findFirst({where:{id:targetId,firmaId:actor.firmaId}});if(!current)throw new Error("Sezon bulunamadı");if(snapshot.aktif){await tx.sezon.updateMany({where:{firmaId:actor.firmaId,aktif:true,id:{not:current.id}},data:{aktif:false}})}else if(current.aktif){const alternatif=await tx.sezon.count({where:{firmaId:actor.firmaId,aktif:true,id:{not:current.id}}});if(!alternatif)throw new Error("Tek aktif sezon geri yükleme ile pasifleştirilemez")};await tx.sezon.update({where:{id:current.id},data:{ad:snapshot.ad,baslangic:new Date(snapshot.baslangic),bitis:new Date(snapshot.bitis),aktif:snapshot.aktif}});await tx.auditKaydi.create({data:{firmaId:actor.firmaId,kullaniciId:actor.id,modul:"TANIMLAR",eylem:"GUNCELLE",hedefTipi:"Sezon",hedefId:current.id,oncekiVeri:{ad:current.ad,baslangic:current.baslangic.toISOString(),bitis:current.bitis.toISOString(),aktif:current.aktif},sonrakiVeri:snapshot,aciklama:`Audit kaydı ${audit.id} üzerinden geri yüklendi`}})},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});return {ok:true}; }
  if (audit.hedefTipi === "Kullanici") {
    if (!kullaniciSnapshot(snapshot)) return { ok: false, hata: "Kullanıcı snapshot geçersiz" };
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.kullanici.findFirst({ where: { id: targetId, firmaId: actor.firmaId }, include: { roller: { include: { rol: true } } } });
        if (!current) throw new Error("KULLANICI_YOK");
        if (current.id === actor.id && snapshot.aktif === false) throw new Error("KENDI_HESABI");
        if (current.aktif && snapshot.aktif === false && current.roller.some((atama) => atama.rol.sistemRolu && atama.rol.kod === "FIRMA_SAHIBI")) throw new Error("FIRMA_SAHIBI");
        await tx.kullanici.update({ where: { id: current.id }, data: snapshot });
        if (current.aktif && snapshot.aktif === false) await tx.oturum.updateMany({ where: { kullaniciId: current.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "KULLANICI_YONETIMI", eylem: "GUNCELLE", hedefTipi: "Kullanici", hedefId: current.id, oncekiVeri: { ad: current.ad, telefon: current.telefon, rol: current.rol, aktif: current.aktif }, sonrakiVeri: snapshot, aciklama: current.aktif && snapshot.aktif === false ? `Audit kaydı ${audit.id} üzerinden geri yüklendi; açık oturumlar kapatıldı` : `Audit kaydı ${audit.id} üzerinden geri yüklendi` } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const kod = error instanceof Error ? error.message : "";
      if (kod === "KULLANICI_YOK") return { ok: false, hata: "Kullanıcı bulunamadı" };
      if (kod === "KENDI_HESABI") return { ok: false, hata: "Kendi hesabınızı pasifleştiremezsiniz" };
      if (kod === "FIRMA_SAHIBI") return { ok: false, hata: "Firma Sahibi hesabı pasifleştirilemez" };
      return { ok: false, hata: "Kullanıcı geri yüklenemedi" };
    }
    return { ok: true };
  }
  if (!firmaSnapshot(snapshot) || targetId !== actor.firmaId) return { ok: false, hata: "Kurtarma hedefi firma kapsamı dışında" };
  await prisma.$transaction(async (tx) => {
    const current = await tx.firma.findUnique({ where: { id: targetId } });
    if (!current) throw new Error("Firma bulunamadı");
    await tx.firma.update({ where: { id: current.id }, data: snapshot });
    await tx.auditKaydi.create({ data: { firmaId: actor.firmaId, kullaniciId: actor.id, modul: "AYARLAR", eylem: "GUNCELLE", hedefTipi: "Firma", hedefId: current.id, oncekiVeri: current, sonrakiVeri: snapshot, aciklama: `Audit kaydı ${audit.id} üzerinden geri yüklendi` } });
  });
  return { ok: true };
}
