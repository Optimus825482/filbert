import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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
  ["/sesli-not", "SESLI_NOT", "GORUNTULE"],
  ["/hizmet", "HIZMET", "GORUNTULE"],
  ["/hizmet/yeni", "HIZMET", "OLUSTUR"],
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
              <MobileShell izinliRotalar={izinliRotalar} bekleyenRandiman={bekleyenRandiman}>{children}</MobileShell>
            )}
            <Toaster position="top-center" richColors closeButton />
          </AyarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
