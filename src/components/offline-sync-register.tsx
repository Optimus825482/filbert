"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { offlineKuyruguEsitle } from "@/lib/offline/sync";

export function OfflineSyncRegister({ kullaniciId }: { kullaniciId?: string }) {
  useEffect(() => {
    if (!kullaniciId) return;
    let calisiyor = false;
    const sync = async () => {
      if (calisiyor) return;
      calisiyor = true;
      try { await offlineKuyruguEsitle(kullaniciId); }
      finally { calisiyor = false; }
    };
    const gorunurlukDegisti = () => { if (document.visibilityState === "visible") void sync(); };
    // Kalıcı reddedilen bir offline taslak olduğunda kullanıcıya bildirilir;
    // aksi halde komut sessizce kaybolur ve ne olduğu anlaşılmazdı.
    const hataDinleyicisi = (event: Event) => {
      const mesaj = (event as CustomEvent<{ mesaj?: string }>).detail?.mesaj ?? "İşlem sunucu tarafından kabul edilmedi.";
      toast.error("Çevrimdışı taslak onaylanmadı", { description: mesaj });
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", gorunurlukDegisti);
    window.addEventListener("filbert:offline-hata", hataDinleyicisi);
    void sync();
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", gorunurlukDegisti);
      window.removeEventListener("filbert:offline-hata", hataDinleyicisi);
    };
  }, [kullaniciId]);
  return null;
}