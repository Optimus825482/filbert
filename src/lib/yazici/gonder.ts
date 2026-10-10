/**
 * ESC/POS baytlarını fiziksel yazıcıya ulaştıran sunucu tarafı taşıma katmanı.
 *
 * İki hedef desteklenir:
 *   1) WINDOWS_KUYRUK — Windows yazıcı kuyruğuna "RAW" veri tipiyle yazılır.
 *      Sürücünün sayfa görüntüsü üretmesi atlanır; baytlar doğrudan yazıcıya
 *      gider. (Nimbot B1 USB bağlıyken tipik kurulum budur.)
 *   2) AG_9100 — Ağ üzerindeki ESC/POS yazıcıya ham TCP soketiyle (genelde
 *      9100 portu) gönderilir.
 *
 * Bu dosya yalnızca sunucuda çalışır; istemci bileşenlerinden içe aktarılmaz.
 *
 * Windows kuyruk baskısı winspool.drv P/Invoke çağrılarıyla yapılır ve
 * PowerShell üzerinden çalıştırılır; böylece derlenmiş yerel modül (node-gyp)
 * gerekmez.
 */

import { spawn } from "node:child_process";
import { Socket } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type YaziciAyarlari } from "@/lib/findik-isleme";

export type GonderimSonucu = { ok: true; hedef: string } | { ok: false; hata: string };

/** Windows yazıcı kuyruğu adları; ayarlar ekranındaki liste buradan gelir. */
export async function windowsYazicilariniListele(): Promise<
  { ok: true; adlar: string[] } | { ok: false; hata: string }
> {
  if (process.platform !== "win32") {
    return { ok: false, hata: "Yazıcı listesi yalnızca Windows sunucuda okunabilir" };
  }
  const sonuc = await powershellCalistir("Get-Printer | Select-Object -ExpandProperty Name", 20_000);
  if (!sonuc.ok) return { ok: false, hata: sonuc.hata };
  const adlar = sonuc.cikti
    .split(/\r?\n/)
    .map((satir) => satir.trim())
    .filter(Boolean);
  return { ok: true, adlar };
}

/** Ayar bloğundaki hedefe göre ham ESC/POS verisini yazıcıya gönderir. */
export async function escposGonder(
  yazici: YaziciAyarlari,
  veri: Uint8Array
): Promise<GonderimSonucu> {
  if (yazici.hedef === "YOK") {
    return {
      ok: false,
      hata: "Doğrudan yazıcı hedefi tanımlı değil. Ayarlar → Fındık İşleme bölümünden seçin.",
    };
  }

  if (yazici.hedef === "WINDOWS_KUYRUK") {
    const kuyrukAdi = yazici.kuyrukAdi?.trim();
    if (!kuyrukAdi) return { ok: false, hata: "Windows yazıcı kuyruğu seçilmemiş" };
    if (process.platform !== "win32") {
      return { ok: false, hata: "Windows kuyruğuna baskı yalnızca Windows sunucuda çalışır" };
    }
    return windowsKuyrugunaGonder(kuyrukAdi, veri);
  }

  if (yazici.hedef === "AG_9100") {
    const ip = yazici.ip?.trim();
    if (!ip) return { ok: false, hata: "Ağ yazıcısı IP adresi girilmemiş" };
    return agUzerindenGonder(ip, yazici.port, veri);
  }

  return { ok: false, hata: "Tanımsız yazıcı hedefi" };
}

// ─── Windows kuyruğu (RAW) ──────────────────────────────────

async function windowsKuyrugunaGonder(
  kuyrukAdi: string,
  veri: Uint8Array
): Promise<GonderimSonucu> {
  let klasor: string | null = null;
  try {
    klasor = await mkdtemp(join(tmpdir(), "filbert-etiket-"));
    const dosya = join(klasor, "etiket.bin");
    await writeFile(dosya, veri);

    const sonuc = await powershellCalistir(hamBaskiBetigi(kuyrukAdi, dosya), 45_000);
    if (!sonuc.ok) return { ok: false, hata: sonuc.hata };
    if (sonuc.cikti.includes("HATA:")) {
      const ayrinti = sonuc.cikti.split("HATA:")[1]?.trim() || "bilinmeyen hata";
      return { ok: false, hata: hamBaskiHataMesaji(ayrinti, kuyrukAdi) };
    }
    return { ok: true, hedef: kuyrukAdi };
  } catch (e) {
    return { ok: false, hata: `Yazıcıya gönderilemedi: ${(e as Error).message}` };
  } finally {
    if (klasor) await rm(klasor, { recursive: true, force: true }).catch(() => {});
  }
}

/** winspool hata kodlarını kullanıcıya anlaşılır Türkçe mesaja çevirir. */
function hamBaskiHataMesaji(ayrinti: string, kuyrukAdi: string): string {
  if (/OpenPrinter/.test(ayrinti)) {
    return `"${kuyrukAdi}" adlı yazıcı bulunamadı. Windows'a kurulu yazıcı adını Ayarlar → Fındık İşleme bölümünden seçin.`;
  }
  if (/WritePrinter/.test(ayrinti) || /Eksik yazildi/.test(ayrinti)) {
    return `Yazıcı veriyi kabul etmedi (${ayrinti}). Yazıcının açık, etiket takılı ve çevrimiçi olduğunu kontrol edin.`;
  }
  return `Yazıcı hatası: ${ayrinti}`;
}

function psKacis(deger: string): string {
  return deger.replace(/'/g, "''");
}

/**
 * Windows kuyruğuna ham bayt yazan PowerShell betiğini üretir. winspool.drv
 * P/Invoke tanımı Add-Type ile çalışma zamanında derlenir; harici bağımlılık
 * gerekmez. C# kaynağı here-string yerine satır dizisiyle kurulur.
 */
function hamBaskiBetigi(kuyrukAdi: string, dosya: string): string {
  const csharp = [
    "using System;",
    "using System.Runtime.InteropServices;",
    "public class FilbertHamYazici {",
    "  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]",
    "  public struct DOCINFOA {",
    "    public string pDocName;",
    "    public string pOutputFile;",
    "    public string pDataType;",
    "  }",
    '  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]',
    "  public static extern bool OpenPrinter(string ad, out IntPtr hYazici, IntPtr varsayilan);",
    '  [DllImport("winspool.drv", SetLastError = true)]',
    "  public static extern bool ClosePrinter(IntPtr hYazici);",
    '  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]',
    "  public static extern bool StartDocPrinter(IntPtr hYazici, int seviye, ref DOCINFOA bilgi);",
    '  [DllImport("winspool.drv", SetLastError = true)]',
    "  public static extern bool EndDocPrinter(IntPtr hYazici);",
    '  [DllImport("winspool.drv", SetLastError = true)]',
    "  public static extern bool StartPagePrinter(IntPtr hYazici);",
    '  [DllImport("winspool.drv", SetLastError = true)]',
    "  public static extern bool EndPagePrinter(IntPtr hYazici);",
    '  [DllImport("winspool.drv", SetLastError = true)]',
    "  public static extern bool WritePrinter(IntPtr hYazici, IntPtr veri, int uzunluk, out int yazilan);",
    "  public static string Gonder(string yazici, byte[] veri) {",
    "    IntPtr h;",
    '    if (!OpenPrinter(yazici, out h, IntPtr.Zero)) return "OpenPrinter kodu " + Marshal.GetLastWin32Error();',
    "    try {",
    "      DOCINFOA bilgi = new DOCINFOA();",
    '      bilgi.pDocName = "FILBERT Etiket";',
    '      bilgi.pDataType = "RAW";',
    '      if (!StartDocPrinter(h, 1, ref bilgi)) return "StartDocPrinter kodu " + Marshal.GetLastWin32Error();',
    "      try {",
    '        if (!StartPagePrinter(h)) return "StartPagePrinter kodu " + Marshal.GetLastWin32Error();',
    "        IntPtr p = Marshal.AllocCoTaskMem(veri.Length);",
    "        try {",
    "          Marshal.Copy(veri, 0, p, veri.Length);",
    "          int yazilan;",
    '          if (!WritePrinter(h, p, veri.Length, out yazilan)) return "WritePrinter kodu " + Marshal.GetLastWin32Error();',
    '          if (yazilan != veri.Length) return "Eksik yazildi " + yazilan + "/" + veri.Length;',
    "        } finally {",
    "          Marshal.FreeCoTaskMem(p);",
    "        }",
    "        EndPagePrinter(h);",
    "      } finally {",
    "        EndDocPrinter(h);",
    "      }",
    "    } finally {",
    "      ClosePrinter(h);",
    "    }",
    '    return "OK";',
    "  }",
    "}",
  ];

  return [
    "$ErrorActionPreference = 'Stop'",
    "$kaynak = @(",
    // PowerShell dizi değişmezlerinde sondaki virgül sözdizimi hatasıdır;
    // bu yüzden son satır virgülsüz eklenir.
    csharp.map((satir) => "  '" + psKacis(satir) + "'").join(",\n"),
    ") -join [Environment]::NewLine",
    "Add-Type -TypeDefinition $kaynak -Language CSharp | Out-Null",
    "$veri = [System.IO.File]::ReadAllBytes('" + psKacis(dosya) + "')",
    "$sonuc = [FilbertHamYazici]::Gonder('" + psKacis(kuyrukAdi) + "', $veri)",
    "if ($sonuc -eq 'OK') { Write-Output 'OK' } else { Write-Output ('HATA:' + $sonuc); exit 3 }",
    "",
  ].join("\n");
}

// ─── Ağ (IP:9100) ───────────────────────────────────────────

async function agUzerindenGonder(
  ip: string,
  port: number,
  veri: Uint8Array,
  zamanAsimiMs = 8000
): Promise<GonderimSonucu> {
  const hedef = ip + ":" + port;
  return new Promise<GonderimSonucu>((cozum) => {
    const soket = new Socket();
    let bitti = false;
    const bitir = (sonuc: GonderimSonucu) => {
      if (bitti) return;
      bitti = true;
      soket.destroy();
      cozum(sonuc);
    };

    soket.setTimeout(zamanAsimiMs);
    soket.once("timeout", () =>
      bitir({ ok: false, hata: "Yazıcı " + hedef + " yanıt vermedi (zaman aşımı)" })
    );
    soket.once("error", (hata: Error) =>
      bitir({ ok: false, hata: "Yazıcı " + hedef + " bağlantı hatası: " + hata.message })
    );
    soket.connect(port, ip, () => {
      soket.write(Buffer.from(veri), (hata) => {
        if (hata) {
          bitir({ ok: false, hata: "Yazıcıya yazılamadı: " + hata.message });
          return;
        }
        soket.end(() => {
          bitir({ ok: true, hedef });
        });
      });
    });
  });
}

/**
 * PowerShell hata çıktısını kullanıcıya gösterilebilir tek satıra indirir.
 * (`-EncodedCommand` ile çalışan betiklerde hatalar CLIXML olarak dönebilir.)
 */
function powershellHatasiniSadelestir(metin: string): string {
  const xmlDuz = metin
    .replace(/<S S="Error">/g, " ")
    .replace(/<\/S>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/_x000D__x000A_/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  const satirlar = xmlDuz
    .split(/\r?\n/)
    .map((satir) => satir.trim())
    .filter(Boolean);
  return satirlar.join(" ").replace(/\s{2,}/g, " ").trim();
}

// ─── PowerShell köprüsü ─────────────────────────────────────

async function powershellCalistir(
  betik: string,
  zamanAsimiMs: number
): Promise<{ ok: true; cikti: string } | { ok: false; hata: string }> {
  const kodlanmis = Buffer.from(betik, "utf16le").toString("base64");
  return new Promise((cozum) => {
    const cocuk = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", kodlanmis],
      { windowsHide: true }
    );

    let cikti = "";
    let hataCikti = "";
    let zamanAsimi = false;
    const zamanlayici = setTimeout(() => {
      zamanAsimi = true;
      cocuk.kill();
    }, zamanAsimiMs);

    cocuk.stdout.on("data", (parca) => {
      cikti += parca.toString("utf8");
    });
    cocuk.stderr.on("data", (parca) => {
      hataCikti += parca.toString("utf8");
    });
    cocuk.once("error", (hata) => {
      clearTimeout(zamanlayici);
      cozum({ ok: false, hata: "PowerShell çalıştırılamadı: " + hata.message });
    });
    cocuk.once("close", (kod) => {
      clearTimeout(zamanlayici);
      if (zamanAsimi) {
        cozum({ ok: false, hata: "Yazıcı işlemi zaman aşımına uğradı" });
        return;
      }
      if (kod !== 0 && !cikti.includes("HATA:")) {
        const ayrinti = powershellHatasiniSadelestir(hataCikti || cikti);
        cozum({ ok: false, hata: ayrinti || "PowerShell " + kod + " koduyla sonlandı" });
        return;
      }
      cozum({ ok: true, cikti });
    });
  });
}
