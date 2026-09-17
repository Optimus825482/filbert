"server only";

const PENCERE_MS = 15 * 60 * 1000;
const EN_COK_DENEME = 5;
const EN_COK_KAYIT = 10_000;
const denemeler = new Map<string, { adet: number; baslangic: number }>();

function anahtar(eposta: string) { return eposta.trim().toLowerCase().slice(0, 320); }

function suresiDolanlariTemizle(simdi: number) {
  for (const [key, kayit] of denemeler) {
    if (simdi - kayit.baslangic >= PENCERE_MS) denemeler.delete(key);
  }
}

function kapasiteyiKoru() {
  while (denemeler.size >= EN_COK_KAYIT) {
    const enEski = denemeler.keys().next().value;
    if (!enEski) return;
    denemeler.delete(enEski);
  }
}

export function girisEngelliMi(eposta: string, simdi = Date.now()) {
  const kayit = denemeler.get(anahtar(eposta));
  if (!kayit) return false;
  if (simdi - kayit.baslangic >= PENCERE_MS) { denemeler.delete(anahtar(eposta)); return false; }
  return kayit.adet >= EN_COK_DENEME;
}

export function basarisizGirisKaydet(eposta: string, simdi = Date.now()) {
  const key = anahtar(eposta); const kayit = denemeler.get(key);
  if (!kayit || simdi - kayit.baslangic >= PENCERE_MS) {
    suresiDolanlariTemizle(simdi);
    kapasiteyiKoru();
    denemeler.set(key, { adet: 1, baslangic: simdi });
    return;
  }
  kayit.adet += 1;
}

export function basariliGirisTemizle(eposta: string) { denemeler.delete(anahtar(eposta)); }

export function girisSinirlayiciyiSifirla() { denemeler.clear(); }
export function girisDenemeKayitSayisi() { return denemeler.size; }
