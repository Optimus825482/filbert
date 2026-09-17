"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rolAktifliginiDegistir, rolIzinleriniGuncelle, rolOlustur, kullaniciRolleriniAta } from "@/lib/actions/roller";
import { EYLEM_ADLARI, IZIN_EYLEMLERI, MODUL_ADLARI, UYGULAMA_MODULLERI, type Izin } from "@/lib/rbac/permissions";

type Role = { id: string; ad: string; aktif: boolean; izinler: Izin[] };
type User = { id: string; ad: string; rolIds: string[] };

const secondaryButton = "rounded-lg border border-sky-300/60 bg-slate-900 px-3 py-2 text-sm font-bold text-sky-50 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60";

export function RolYonetimi({ roles, users }: { roles: Role[]; users: User[] }) {
  const router = useRouter();
  const [ad, setAd] = useState("");
  const [izinler, setIzinler] = useState<Izin[]>([]);
  const [duzenlenenRolId, setDuzenlenenRolId] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState("");
  const duzenlenenRol = roles.find((rol) => rol.id === duzenlenenRolId);

  function toggle(izin: Izin) {
    setIzinler((onceki) => onceki.some((x) => x.modul === izin.modul && x.eylem === izin.eylem)
      ? onceki.filter((x) => x.modul !== izin.modul || x.eylem !== izin.eylem)
      : [...onceki, izin]);
  }

  function hepsiSecili(modul: Izin["modul"]) {
    return IZIN_EYLEMLERI.every((eylem) => izinler.some((izin) => izin.modul === modul && izin.eylem === eylem));
  }

  function toggleHepsi(modul: Izin["modul"]) {
    setIzinler((onceki) => {
      const tumuSecili = IZIN_EYLEMLERI.every((eylem) => onceki.some((izin) => izin.modul === modul && izin.eylem === eylem));
      if (tumuSecili) return onceki.filter((izin) => izin.modul !== modul);
      return [...onceki.filter((izin) => izin.modul !== modul), ...IZIN_EYLEMLERI.map((eylem) => ({ modul, eylem }))];
    });
  }

  async function kaydet() {
    const sonuc = duzenlenenRolId ? await rolIzinleriniGuncelle(duzenlenenRolId, izinler) : await rolOlustur({ ad, izinler });
    setMesaj(sonuc.ok ? (duzenlenenRolId ? "Rol izinleri güncellendi." : "Rol oluşturuldu.") : sonuc.hata ?? "İşlem başarısız");
    if (sonuc.ok) { setAd(""); setIzinler([]); setDuzenlenenRolId(null); router.refresh(); }
  }

  function duzenle(rol: Role) { setDuzenlenenRolId(rol.id); setAd(rol.ad); setIzinler(rol.izinler); setMesaj(""); }

  async function aktiflikDegistir(rol: Role) {
    const sonuc = await rolAktifliginiDegistir(rol.id);
    setMesaj(sonuc.ok ? `${rol.ad} ${rol.aktif ? "pasifleştirildi" : "aktifleştirildi"}.` : sonuc.hata ?? "İşlem başarısız");
    if (sonuc.ok) router.refresh();
  }

  return <div className="mt-7 space-y-8 text-sky-50">
    <section className="rounded-xl border border-sky-300/35 bg-slate-950/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-extrabold text-white">{duzenlenenRol ? `${duzenlenenRol.ad} izinleri` : "Yeni rol"}</h2>{duzenlenenRol && <button type="button" onClick={() => { setDuzenlenenRolId(null); setAd(""); setIzinler([]); }} className={secondaryButton}>Yeni rol</button>}</div>
      {!duzenlenenRol && <input aria-label="Rol adı" value={ad} onChange={(event) => setAd(event.target.value)} className="saha-input mt-3 w-full" placeholder="Örn. Muhasebe" maxLength={80} />}
      <div className="mt-5 space-y-4">{UYGULAMA_MODULLERI.map((modul) => <fieldset key={modul} className="rounded-lg border border-sky-200/25 bg-slate-900/70 p-3"><legend className="px-1 text-sm font-extrabold text-white">{MODUL_ADLARI[modul]}</legend><div className="mt-2 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-950/80 px-3 py-2 text-xs font-extrabold text-cyan-100 hover:border-cyan-300"><input type="checkbox" checked={hepsiSecili(modul)} onChange={() => toggleHepsi(modul)} className="h-4 w-4 accent-cyan-400" />Hepsi</label>{IZIN_EYLEMLERI.map((eylem) => { const id = `izin-${modul}-${eylem}`; return <label key={eylem} htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-200/35 bg-slate-950 px-3 py-2 text-xs font-bold text-sky-50 hover:border-cyan-300"><input id={id} type="checkbox" checked={izinler.some((izin) => izin.modul === modul && izin.eylem === eylem)} onChange={() => toggle({ modul, eylem })} className="h-4 w-4 accent-cyan-400" />{EYLEM_ADLARI[eylem]}</label>; })}</div></fieldset>)}</div>
      <button type="button" onClick={() => void kaydet()} disabled={(!duzenlenenRol && !ad.trim()) || !izinler.length} className="mt-5 rounded-lg bg-emerald-500 px-4 py-2.5 font-extrabold text-[#031a13] shadow-[0_2px_0_#047857] transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">{duzenlenenRol ? "İzinleri güncelle" : "Rolü kaydet"}</button>
      {mesaj && <p role="status" className="mt-3 text-sm font-bold text-cyan-100">{mesaj}</p>}
    </section>
    <section><h2 className="text-lg font-extrabold text-white">Tanımlı roller</h2><div className="mt-3 space-y-2">{roles.map((rol) => <article key={rol.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200/30 bg-slate-950/60 p-3 text-sky-50"><div><b className="text-white">{rol.ad}</b><p className="mt-1 text-xs font-semibold text-cyan-100">{rol.izinler.length} izin · {rol.aktif ? "Aktif" : "Pasif"}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => duzenle(rol)} className={secondaryButton}>İzinleri düzenle</button><button type="button" onClick={() => void aktiflikDegistir(rol)} className={secondaryButton}>{rol.aktif ? "Pasifleştir" : "Aktifleştir"}</button></div></article>)}</div></section>
    <section><h2 className="text-lg font-extrabold text-white">Kullanıcı rol atamaları</h2><div className="mt-3 space-y-3">{users.map((user) => <UserRoles key={user.id} user={user} roles={roles} onSaved={() => router.refresh()} />)}</div></section>
  </div>;
}

function UserRoles({ user, roles, onSaved }: { user: User; roles: Role[]; onSaved: () => void }) {
  const [selected, setSelected] = useState(user.rolIds);
  const [mesaj, setMesaj] = useState("");
  async function save() { const sonuc = await kullaniciRolleriniAta(user.id, selected); setMesaj(sonuc.ok ? "Kaydedildi" : sonuc.hata ?? "İşlem başarısız"); if (sonuc.ok) onSaved(); }
  return <div className="rounded-xl border border-sky-200/30 bg-slate-950/60 p-3 text-sky-50"><b className="text-white">{user.ad}</b><div className="mt-3 flex flex-wrap gap-2">{roles.filter((rol) => rol.aktif).map((rol) => { const id = `user-${user.id}-rol-${rol.id}`; return <label key={rol.id} htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-200/35 bg-slate-900 px-3 py-2 text-sm font-bold text-sky-50 hover:border-cyan-300"><input id={id} type="checkbox" checked={selected.includes(rol.id)} onChange={() => setSelected((onceki) => onceki.includes(rol.id) ? onceki.filter((id) => id !== rol.id) : [...onceki, rol.id])} className="h-4 w-4 accent-cyan-400" />{rol.ad}</label>; })}</div><button type="button" onClick={() => void save()} className={`mt-3 ${secondaryButton}`}>Rolleri kaydet</button>{mesaj && <span role="status" className="ml-3 text-xs font-bold text-cyan-100">{mesaj}</span>}</div>;
}
