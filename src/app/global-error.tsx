"use client";

import { RefreshCw, ShieldAlert } from "lucide-react";

export default function GenelHataSiniri({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#071126", color: "#fff", fontFamily: "Arial, sans-serif" }}>
        <main style={{ width: "min(420px, calc(100% - 48px))", border: "1px solid rgba(186,230,253,.2)", borderRadius: 24, background: "#0a1830", padding: 32, textAlign: "center" }}>
          <div style={{ color: "#fcd34d" }}><ShieldAlert size={36} /></div>
          <h1 style={{ margin: "18px 0 0", fontSize: 24 }}>Filbert yeniden başlatılıyor</h1>
          <p style={{ color: "#dbeafe", lineHeight: 1.6 }}>Beklenmeyen bir sorun oluştu. İşleminizi tekrar deneyin.</p>
          <button type="button" onClick={retry} style={{ border: 0, borderRadius: 12, background: "#16a34a", color: "#fff", fontWeight: 700, padding: "12px 18px", cursor: "pointer" }}><RefreshCw size={16} style={{ display: "inline", marginRight: 8, verticalAlign: "text-bottom" }} />Yeniden dene</button>
        </main>
      </body>
    </html>
  );
}
