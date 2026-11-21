# Backend (Express + Prisma) imajı.
# Build context repo köküdür:  docker build -f backend/Dockerfile .
#
# Taban imajlar FROM satırında digest ile sabitlenir (Dependabot ARG'leri
# güncelleyemez); güncellemeleri Dependabot (docker) açar.
# Builder (Debian 13 trixie) ile runtime (distroless Debian 13) aynı glibc/OpenSSL 3
# tabanını paylaşır: native modüller (bcrypt) ve Prisma query engine uyumlu kalır.

# ---------------------------------------------------------------------------
FROM node:24-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0 AS build

# Prisma engine'in OpenSSL sürümünü algılaması için openssl; bcrypt prebuilt
# binary indiremezse node-gyp ile derleyebilmek için python3/make/g++.
# apt paket sürümleri bilinçli olarak sabitlenmez: Debian güvenlik güncellemeleri
# eski sürümleri depodan kaldırdığı için sabit sürüm derlemeyi kırar. Bedeli: bu
# aşama bit-bit tekrarlanabilir değildir. Risk builder aşamasıyla sınırlıdır; bu
# paketler runtime (distroless) imajına girmez.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# pnpm sürümü kök package.json'daki "packageManager" alanından gelir (corepack).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
RUN corepack enable

WORKDIR /repo

# Önce yalnızca manifest'ler: bağımlılık katmanı kaynak değişince yeniden kurulmaz.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter ./backend...

COPY backend/ backend/
RUN pnpm --filter ./backend prisma:generate \
 && pnpm --filter ./backend build

# Yalnızca üretim bağımlılıklarıyla bağımsız bir dizin üret, ardından Prisma
# client'ını bu dizinin kendi @prisma/client kopyası için yeniden generate et.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter ./backend deploy --prod /out
WORKDIR /out
RUN /repo/backend/node_modules/.bin/prisma generate --schema prisma/schema.prisma \
 && rm -rf src tsconfig.json vitest.config.ts \
 && mkdir -p uploads/avatars

# ---------------------------------------------------------------------------
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:6abfcb367ebc291572c774c1592a986be2ab26a2486f73093401327495a5962a AS runtime

LABEL org.opencontainers.image.title="movie-tv-review-backend" \
      org.opencontainers.image.description="Cinephiles REST API (Express + Prisma)" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app
# distroless :nonroot kullanıcısı = 65532. Yalnızca uploads/ yazılabilir olmalı;
# uygulama dosyaları root'a ait ve salt-okur kalır.
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/prisma ./prisma
COPY --from=build /out/dist ./dist
COPY --from=build --chown=65532:65532 /out/uploads ./uploads

USER 65532:65532
EXPOSE 4000

# Liveness: /api/health DB/Redis'e dokunmaz. distroless'ta shell/curl yok; node kullanılır.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# distroless nodejs imajının ENTRYPOINT'i zaten "node"dur.
CMD ["dist/server.js"]
