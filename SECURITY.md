# Security Policy

## Supported versions

This project is developed on the `main` branch and has no long-term support
branches. Security fixes are made on `main` and shipped in the next release
(`v*` tag) and in the container images published from it.

| Version | Supported |
|---------|-----------|
| `main` (latest commit) | ✅ |
| Latest `v*` release | ✅ |
| Older releases | ❌ — please upgrade |

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for security
problems.**

Report vulnerabilities privately through GitHub's
**[Private Vulnerability Reporting](../../security/advisories/new)**:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected component (backend API, frontend,
   container images, CI/CD workflows), steps to reproduce and the impact.
   A proof of concept is welcome but not required.

Please do not include real user data or credentials in your report.

## What to expect

| Step | Target time |
|------|-------------|
| Acknowledgement of your report | within 3 business days |
| Initial assessment (validity, severity) | within 7 business days |
| Fix or mitigation for critical/high issues | as soon as possible, typically within 30 days |

We will keep you informed through the private advisory, coordinate a
disclosure date with you, and credit you in the published advisory unless you
prefer to stay anonymous. This is a volunteer-maintained project, so these
are goals rather than guarantees.

## Scope

In scope:

- The backend REST API (`backend/`) and the frontend SPA (`frontend/`).
- The container images built from this repository and published to GHCR.
- The GitHub Actions workflows in `.github/workflows/`.

Out of scope:

- Vulnerabilities in third-party dependencies that are already publicly
  known (these are tracked by Dependabot and our CI scanners; a report is
  still welcome if this project is exploitable in a way the upstream
  advisory does not cover).
- The TMDB API and other third-party services.
- Findings that require a compromised host, a malicious browser extension or
  physical access.
- Missing best-practice headers or rate limits without a demonstrated impact.
- Denial-of-service through volumetric traffic, spam or social engineering.

## Safe harbor

We will not pursue legal action against researchers who act in good faith:
test only against your own local deployment (see the README), avoid
accessing or modifying other users' data, and give us reasonable time to fix
the issue before any public disclosure.
