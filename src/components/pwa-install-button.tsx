"use client";

import { Bell, CheckCircle2, Download, Mic, MonitorDown } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type InstallOutcome = "accepted" | "dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: InstallOutcome }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function subscribeToInstallState(onStoreChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  window.addEventListener("appinstalled", onStoreChange);
  media.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener("appinstalled", onStoreChange);
    media.removeEventListener("change", onStoreChange);
  };
}

async function izinleriIste() {
  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission();
  }

  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // Kullanıcının izin vermemesi kurulumu veya normal kullanımı engellemez.
    }
  }
}

export function PwaInstallButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [durum, setDurum] = useState<string | null>(null);
  const installed = useSyncExternalStore(subscribeToInstallState, isStandalone, () => false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallEvent(null);
      setDurum("Filbert Windows uygulaması olarak yüklendi.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const yukle = useCallback(async () => {
    setDurum(null);
    void izinleriIste().catch(() => { /* izin reddi girişi engellemez */ });

    if (!installEvent) {
      setDurum("Tarayıcı henüz kurulum seçeneğini sunmadı. Birkaç saniye sonra yeniden deneyin.");
      return;
    }

    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      setInstallEvent(null);
      setDurum(outcome === "accepted" ? "Kurulum isteği onaylandı. İzin tercihlerinizi tarayıcı penceresinden belirleyin." : "Kurulum iptal edildi. İsterseniz daha sonra tekrar deneyebilirsiniz.");
    } catch {
      setInstallEvent(null);
      setDurum("Kurulum isteği tarafından iptal edildi. Daha sonra yeniden deneyebilirsiniz.");
    }
  }, [installEvent]);

  if (installed) {
    return <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100"><CheckCircle2 className="h-4 w-4 shrink-0" /> Windows uygulaması olarak kullanıyorsunuz.</div>;
  }

  return <div className="mt-6 border-t border-white/10 pt-6"><button type="button" onClick={yukle} className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/30 bg-cyan-300/10 px-4 py-3 text-sm font-extrabold text-white transition hover:border-cyan-200/60 hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"><MonitorDown className="h-5 w-5 text-cyan-100" /><span>Windows uygulaması olarak yükle</span><Download className="h-4 w-4 text-cyan-100" /></button><div className="mt-3 flex items-start gap-2 text-xs font-semibold leading-5 text-sky-100"><Mic className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" /><span>Yükleme tıklamasında sesli not için mikrofon ve hatırlatmalar için bildirim izni sorulur. İzin vermemeniz girişinizi engellemez.</span><Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#f5c518]" /></div>{durum ? <p role="status" className="mt-3 text-xs font-bold leading-5 text-white">{durum}</p> : null}</div>;
}
