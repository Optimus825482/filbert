# syntax=docker/dockerfile:1

# Filbert üretim imajı.
#   builder  → bağımlılıklar + Prisma istemcisi + Next.js derlemesi
#   migrator → tek seferlik "prisma migrate deploy" konteyneri
#   runner   → yalnız çalışma zamanı dosyalarını taşıyan ince imaj
#
# Prisma 7 Rust motoru kullanmaz: istemci saf TypeScript'e üretilir ve
# PostgreSQL bağlantısı pg sürücü adaptörüyle kurulur. Bu yüzden çalışma
# zamanı imajında motor ikilisi bulunmak zorunda değildir.

# ─── Ortak taban ─────────────────────────────────────────────
# Node 24 LTS zorunlu: pnpm 11 `node:sqlite` yerleşik modülünü kullanır ve bu
# modül Node 22.5+ ile gelir (pnpm 11 en az Node 22.13 ister). Prisma 7 de
# `>=24.0` bildirir. Node 20 ile `pnpm install` ERR_UNKNOWN_BUILTIN_MODULE
# hatasıyla çöker.
FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: Prisma CLI'ın platform/motor seçimi için gerekir.
# pnpm sürümü burada sabitlenir; corepack'e bağımlı kalınmaz.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@11.19.0
WORKDIR /app

# ─── Bağımlılıklar ───────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ─── Derleme ─────────────────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Bu adres yalnızca derleme sırasında geçerlidir: Next.js, sayfa modüllerini
# yüklerken Prisma istemcisini de başlatır ve prisma.config.ts geçerli bir DSN
# bekler. Tüm sayfalar dinamiktir (çerez okur), dolayısıyla derleme aşamasında
# veritabanına sorgu gitmez. Değer bilinçli olarak ENV ile imaja işlenmez;
# yalnızca aşağıdaki iki komuta verilir. Konteyner çalışırken gerçek adres
# Coolify ortam değişkeninden gelir.
ARG DERLEME_DATABASE_URL=postgresql://derleme:derleme@127.0.0.1:5432/derleme?schema=public

RUN DATABASE_URL="$DERLEME_DATABASE_URL" pnpm prisma generate \
 && DATABASE_URL="$DERLEME_DATABASE_URL" pnpm build

# ─── Tek seferlik göç (migration) imajı ──────────────────────
# Şemayı ve migration geçmişini içeren tam çalışma alanını devralır; böylece
# Prisma CLI, prisma.config.ts ve prisma/migrations birlikte bulunur.
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["pnpm", "prisma", "migrate", "deploy"]

# ─── Çalışma zamanı ──────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3066 \
    HOSTNAME=0.0.0.0

RUN groupadd --gid 1001 nodejs \
 && useradd --uid 1001 --gid nodejs --create-home nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Görüntü iyileştirme ve artımlı derleme önbelleği yazılabilir olmalıdır.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs
EXPOSE 3066
CMD ["node", "server.js"]
