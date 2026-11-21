# Frontend (Vite + React SPA) imajı: statik çıktı, root olmayan nginx ile sunulur.
# Build context repo köküdür:  docker build -f frontend/Dockerfile .
#
# VITE_* değişkenleri derleme anında pakete gömülür (secret DEĞİLDİR, tarayıcıya gider).

# ---------------------------------------------------------------------------
FROM node:24-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0 AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
RUN corepack enable

WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter ./frontend...

COPY frontend/ frontend/

ARG VITE_API_URL=/api
ARG VITE_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
ARG VITE_DEFAULT_LANGUAGE=tr
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_TMDB_IMAGE_BASE=${VITE_TMDB_IMAGE_BASE} \
    VITE_DEFAULT_LANGUAGE=${VITE_DEFAULT_LANGUAGE}
RUN pnpm --filter ./frontend build

# ---------------------------------------------------------------------------
# nginx sürüm politikası: mainline (1.31) alpine-slim. Upstream 1.30 (stable) imajı
# /etc/apk/world içinde nginx paketini belirli bir sürüme kilitlediği için
# "apk upgrade" nginx güvenlik düzeltmelerini alamıyordu (1.30.6 → kritik CVE'ler).
# Mainline imajları güvenlik düzeltmelerini daha hızlı yayımlar; slim varyant
# yalnızca nginx çekirdeğini içerir (njs/xslt/geoip/image-filter modülleri yok,
# bu yapılandırma da kullanmaz) ve saldırı yüzeyini küçültür.
FROM nginxinc/nginx-unprivileged:1.31-alpine-slim@sha256:a8cb0f33d51fa107c96fd2bd3a71aaf564ec131e9d2bdf8700944f0ed8b170d7 AS runtime

LABEL org.opencontainers.image.title="movie-tv-review-frontend" \
      org.opencontainers.image.description="Cinephiles web SPA (static, nginx-unprivileged)" \
      org.opencontainers.image.licenses="MIT"

# Upstream imaj Alpine güvenlik yamalarının (ör. musl, zlib) gerisinde kalabiliyor;
# derleme anında düzeltilmiş paketler alınır (nginx paketi upstream'de kilitli
# olduğundan onu taban imaj sürümü belirler). Trivy kapısı her imajı yine tarar.
# Ardından root olmayan kullanıcıya geri dönülür.
USER 0
RUN apk upgrade --no-cache

COPY frontend/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY frontend/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf

# API ayrı bir origin'de sunuluyorsa (ör. VITE_API_URL=https://api.example.com/api)
# o origin CSP'nin connect-src/img-src listesine eklenmelidir. Değer yalnızca
# "scheme://host[:port]" biçiminde olabilir; başka bir şey CSP'ye enjekte edilemez.
ARG CSP_API_ORIGIN=""
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
RUN if [ -n "$CSP_API_ORIGIN" ] && ! printf '%s' "$CSP_API_ORIGIN" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$'; then \
      echo "Invalid CSP_API_ORIGIN: $CSP_API_ORIGIN" >&2; exit 1; \
    fi \
 && sed -i "s#__CSP_API_ORIGIN__#${CSP_API_ORIGIN}#g" /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html

# nginx-unprivileged taban imajı zaten uid 101 ile ve 8080 portunda çalışır;
# açıkça belirtmek, ileride taban imaj değişirse root'a düşmeyi engeller.
USER 101
# Config testi root olmayan kullanıcıyla yapılır; root ile çalışsa /tmp altında
# root'a ait pid/temp dosyaları kalır ve nginx açılamaz.
RUN nginx -t && rm -f /tmp/nginx.pid
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
