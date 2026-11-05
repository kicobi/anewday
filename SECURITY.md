# Security Policy

- **Data residency**: All data is stored locally (IndexedDB). No analytics or telemetry.
- **Content Security Policy**: `default-src 'self'; script-src 'self' 'strict-dynamic' 'nonce-anewday'; style-src 'self' 'nonce-anewday'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'`
- **Exports**: Optional passphrase-encrypted (AES-GCM). Passphrases are never persisted and cleared from memory after use.
- **Offline/PWA**: The service worker precaches the app shell and exposes a runtime cache entry for Google Fonts stylesheets (should they be requested); all other requests stay within the first-party origin.
- **Reporting**: Open a GitHub issue with a minimal reproduction. Do not include personal data in logs.
- **Verification logs**: See `docs/privacy-offline.md` for the most recent offline/telemetry audit steps.

## Dependency security maintenance

`npm run audit:dependencies` requires zero findings in both production and development dependencies. Security updates must also pass the normal CI build, lint, type, unit, browser and Lighthouse checks.

The November 2026 remediation updates Vite, Vitest, Lighthouse and vulnerable transitive packages. The `minimatch@>=7 <11` and `glob@>=9 <14.0.2` overrides use patched major versions because their consumers still request vulnerable versions. Older minimatch callers retain their original API. Recheck and remove these overrides when the consuming packages adopt patched versions themselves.

### Temporary deepmerge patch

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) has no published patched release as of 2026-11-05. Both the Svelte Vite plugin and Rollup's node resolver still depend on it. The root override therefore resolves `deepmerge` to the private local package `@anewday/deepmerge` in `vendor/deepmerge`; it does not suppress or allowlist the advisory.

The local package is based on the MIT-licensed CommonJS distribution and type declarations of `deepmerge@4.3.1`. The original `dist/cjs.js` SHA-256 is `2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d`. Apart from formatting, the only runtime change filters `__proto__` from enumerated keys on **both** inputs before any property is read or assigned. This prevents the inherited prototype setter from being invoked, including when the target has a null prototype or owns an enumerable `__proto__` key. The upstream license is retained.

`tests/unit/deepmerge-security.test.js` resolves the package through both actual consumers and exercises the exploit, nested cloning and supported merge options. The exploit tests fail against upstream 4.3.1. This fork is maintained locally and is not covered by registry advisories for the upstream package; review its patch and keep the regression tests until it can be removed. Replace the override with an upstream patched release (or remove it when both consumers remove deepmerge), then rerun these tests and the full audit.
