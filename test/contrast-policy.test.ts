import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("yüksek kontrast politikası gri ikincil metni ve native select uyumsuzluğunu engeller", () => {
  const css = readFileSync(path.resolve("src/app/globals.css"), "utf8");
  assert.match(css, /html\.dark select option/);
  assert.match(css, /background-color: #0a1830/);
  assert.match(css, /html\.dark \.text-slate-400/);
  assert.match(css, /color: #e2e8f0 !important/);
  assert.match(css, /\.light \.tr-label \{ color: #1e3a8a; \}/);
  assert.match(css, /\.light \.tr-muted \{ color: #172554; \}/);
  assert.match(css, /\.light \.desktop-taskbar \.tray-date \{\s+color: #1e3a8a;/);
  assert.doesNotMatch(css, /\.light \.tr-label \{ color: #6b7280; \}/);
  assert.doesNotMatch(css, /\.light \.tr-muted \{ color: #9ca3af; \}/);
  assert.match(css, /:focus-visible/);

  const kaynaklar = readdirSync(path.resolve("src"), { recursive: true })
    .filter((dosya): dosya is string => typeof dosya === "string" && /\.(ts|tsx)$/.test(dosya))
    .map((dosya) => readFileSync(path.resolve("src", dosya), "utf8"))
    .join("\n");
  assert.doesNotMatch(kaynaklar, /(?:text|placeholder:text)-slate-/);
});

test("görsel sınıflarda geçersiz Tailwind opaklık değeri kullanılmaz", () => {
  const kaynak = readdirSync(path.resolve("src"), { recursive: true })
    .filter((dosya): dosya is string => typeof dosya === "string" && dosya.endsWith(".tsx"))
    .map((dosya) => readFileSync(path.resolve("src", dosya), "utf8"))
    .join("\n");
  assert.doesNotMatch(kaynak, /(?:bg|text|border|shadow)-[a-z]+-[0-9]+\/[0-9]{3,}/);
});
