"use client";

import { useEffect } from "react";

/** Registers the app-shell worker only in browsers that support it. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Derleme kimliği önbellek sürümünü belirler; her dağıtımda eski statikler
    // otomatik olarak geçersiz kılınır.
    const surum = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
    void navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(surum)}`, { scope: "/", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error: unknown) => console.warn("Service worker kaydı yapılamadı:", error));
  }, []);

  return null;
}
