# ZAP baseline hook: the backend is a JSON API without an OpenAPI document, so the
# spider finds no links from the target URL. This hook requests the public
# (unauthenticated) GET endpoints once so ZAP's passive rules inspect real
# responses. Usernames come from backend/prisma/seed.ts. No authenticated or
# state-changing requests are made (baseline = passive scan only).

PUBLIC_PATHS = [
    "/api/health",
    "/api/health/ready",
    "/api/reviews/popular",
    "/api/lists/popular",
    "/api/lists/users/demo",
    "/api/users/demo",
    "/api/users/demo/reviews",
    "/api/users/demo/favorites",
    "/api/users/demo/followers",
    "/api/users/demo/following",
    "/api/users/elifyilmaz",
    "/api/users/search?q=demo",
    # TMDB proxy routes: with the throwaway key these return upstream errors,
    # which exercises the error handler (no stack traces may leak).
    "/api/content/trending",
    "/api/content/genres",
    # Unknown route -> notFoundHandler
    "/api/does-not-exist",
]


def zap_started(zap, target):
    base = target.split("/api/", 1)[0]
    for path in PUBLIC_PATHS:
        zap.core.access_url(url=base + path, followredirects=True)
