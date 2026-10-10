import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AyarProvider } from "@/lib/ayar-store";
import { MobileShell } from "./mobile-shell";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { OfflineSyncRegister } from "@/components/offline-sync-register";
import { getCurrentOturum } from "@/lib/auth";
import { bekleyenRandimanSayisi } from "@/lib/queries";
import { izinVar } from "@/lib/rbac/guard";
import { MODUL_BASLIGI, MODUL_CEREZI, MODULLER, aktifModulBelirle } from "@/lib/modul";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: "Filbert — Fındığın Dijital Aklı", template: "%s | Filbert" },
  description: "Fındık tüccarları için saha odaklı ticaret ve ön muhasebe uygulaması",
  applicationName: "Filbert",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Filbert" },
};

export const viewport: Viewport = {
  themeColor: "#081226",
  width: "device-width",
  initialScale: 1,
  // maximumScale sınırı kaldırıldı: saha kullanıcıları ve düşük görüşlü
  // kullanıcılar tarayıcı yakınlaştırmasını kullanabilmelidir.
  viewportFit: "cover",
};

const MASAUSTU_ROTA_IZINLERI = [
  ["/", "DASHBOARD", "GORUNTULE"],
  ["/arama", "DASHBOARD", "GORUNTULE"],
  ["/alim", "ALIM", "GORUNTULE"],
  ["/alim/yeni", "ALIM", "OLUSTUR"],
  ["/randiman", "RANDIMAN", "GORUNTULE"],
  ["/emanet", "EMANET", "GORUNTULE"],
  ["/virman", "FINANS", "GORUNTULE"],
  ["/sevkiyat", "SEVKIYAT", "GORUNTULE"],
  ["/kasa", "FINANS", "GORUNTULE"],
  ["/banka", "FINANS", "GORUNTULE"],
  ["/tahsilat", "FINANS", "GORUNTULE"],
  ["/finans", "FINANS", "GORUNTULE"],
  ["/finans/odeme", "FINANS", "GORUNTULE"],
  ["/avans", "AVANS", "GORUNTULE"],
  ["/masraf", "MASRAF", "GORUNTULE"],
  ["/cari/hesaplar", "CARI", "GORUNTULE"],
  ["/satis", "SATIS", "GORUNTULE"],
  ["/raporlar", "RAPORLAR", "GORUNTULE"],
  ["/stok", "STOK", "GORUNTULE"],
  ["/kar-zarar", "RAPORLAR", "GORUNTULE"],
  ["/ayarlar", "AYARLAR", "GORUNTULE"],
  // Modül seçimi Ayarlar → Modül sekmesindedir. Yalnızca modül yetkisi olan
  // (ör. sadece fındık işleme) kullanıcı da modül değiştirebilmelidir.
  ["/ayarlar", "ALIM", "GORUNTULE"],
  ["/ayarlar", "HIZMET", "GORUNTULE"],
  ["/sesli-not", "SESLI_NOT", "GORUNTULE"],
  ["/hizmet", "HIZMET", "GORUNTULE"],
  ["/hizmet/yeni", "HIZMET", "OLUSTUR"],
  ["/hizmet/raporlar", "HIZMET", "GORUNTULE"],
  ["/hizmet/ayarlar", "HIZMET", "GORUNTULE"],
  ["/hizmet/kasa", "HIZMET", "GORUNTULE"],
] as const;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hdrs = await headers();
  const isWindow = hdrs.get("x-is-window") === "1";
  const isPublicPage = hdrs.get("x-filbert-public-page") === "true";
  // `w=1` yalnızca pencere görünümünü belirtir; oturum denetimini asla devre
  // dışı bırakmamalıdır. Aksi halde bu pencerede sayfa izin koruması 500
  // üretirken normal tarayıcıda girişe yönlendirme yapılabiliyordu.
  const oturum = isPublicPage ? null : await getCurrentOturum();
  const user = oturum?.kullanici;
  const sistemYoneticisi = oturum?.sistemYoneticisi;
  const firmaOturumu = Boolean(user?.aktif && user.firma.aktif);
  const sistemYoneticiOturumu = Boolean(sistemYoneticisi?.aktif);
  if (!isPublicPage && !firmaOturumu && !sistemYoneticiOturumu) redirect("/giris");
  const izinliRotalar = user?.aktif && user.firma.aktif
    ? (() => {
      const rotalar = MASAUSTU_ROTA_IZINLERI.filter(([, modul, eylem]) => izinVar(user, modul, eylem)).map(([rota]) => rota);
      const yonetimAlaniYetkisi = izinVar(user, "TANIMLAR", "GORUNTULE") || izinVar(user, "KULLANICI_YONETIMI", "YONET");
      return yonetimAlaniYetkisi && !rotalar.includes("/ayarlar") ? [...rotalar, "/ayarlar"] : rotalar;
    })()
    : [];

  // Aktif modül: istek yolu → çerez tercihi → kullanıcının varsayılan modülü.
  // Yol en güçlü sinyaldir; modüle özel olmayan ekranlarda (ör. /ayarlar)
  // kullanıcının son tercihi korunur.
  const aktifModul = firmaOturumu && user
    ? aktifModulBelirle({
        yol: hdrs.get(MODUL_BASLIGI),
        cerez: (await cookies()).get(MODUL_CEREZI)?.value,
        varsayilan: user.varsayilanModul,
      })
    : null;
  const digerModul = aktifModul ? MODULLER[MODULLER[aktifModul].karsiModul] : null;
  const digerModulYetkisi = Boolean(user && digerModul && izinVar(user, digerModul.izinModulu, "GORUNTULE"));

  const bekleyenRandiman = user?.aktif && user.firma.aktif
    ? await bekleyenRandimanSayisi(user.firmaId)
    : 0;

  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-[var(--app-bg)] text-[var(--app-fg)]">
        {/* Tema sıçramasını (FOUC) önler: SSR varsayılan olarak dark boyar; bu
            betik boyamadan önce saklı light tercihini uygular. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("filbert-theme");if(t==="light"){var d=document.documentElement;d.classList.remove("dark");d.classList.add("light");d.style.colorScheme="light";}}catch(e){}})();` }} />
        <ThemeProvider>
          <ServiceWorkerRegister />
          <OfflineSyncRegister kullaniciId={user?.id} />
          <AyarProvider>
            {isWindow || isPublicPage || sistemYoneticiOturumu ? (
              <main className="p-4">{children}</main>
            ) : (
              <MobileShell izinliRotalar={izinliRotalar} bekleyenRandiman={bekleyenRandiman} aktifModul={aktifModul} digerModul={digerModul ? { id: digerModul.id, ad: digerModul.ad, izinli: digerModulYetkisi } : null}>{children}</MobileShell>
            )}
            <Toaster position="top-center" richColors closeButton />
          </AyarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
