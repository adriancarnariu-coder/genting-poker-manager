# Genting Poker Manager — recovered Version 49

Recovered from source commit `953f8b7253b49e355642cc148f7fe19f030406bf`.
This is the existing Rebuilt app, not a rewrite. All 18 `dist/` assets are preserved.
`docs/version49-manifest.json` records source and local deployment-asset SHA-256 hashes;
11 text files differ only in Windows line endings between Git and the deployment archive.
Previous historical notes are retained in `docs/LEGACY-REBUILT-NOTES.md`; this README
describes the final Version 49 behaviour and supersedes earlier contradictory notes.

## Review-only: not secured for deployment

No administrator authentication is implemented. `netlify.toml` intentionally uses
`npm run build:netlify`, which fails with an explicit security-review message.
This prevents automatic production/preview deployment of the unprotected staff app.
Do not bypass the guard or manually upload dist as a substitute for authentication.
See `docs/AUTHENTICATION-PROPOSAL.md` before approving the architecture changes.

## Local verification

Node.js >=22 (CI uses 24). No npm packages or API keys are needed.

```sh
npm run build
npm test
npm start
```

Open http://127.0.0.1:3001. The build verifies all recovered static asset hashes and
local HTML asset references. There is no compilation or bundling step. `dist/` is
tracked source. SheetJS 0.20.3 is vendored with its licence in `dist/vendor/`.

## Preserved functionality

- One multi-file upload for .xls/.xlsx, Entries/Re-Entries, including genuine Excel
  and safe HTML/XML reports named .xls. Replacement/removal/30-second undo.
- Qualified-record validation, duplicate review, Flight/FLT aliases, Day 1A–Day 1F.
- Staff table with original names/nationalities; presentation mode, combined filters,
  numeric descending chip sorting and complete-list ranks.
- JPEG uses only Y/YES consent without conflict for full names. GDPR/GDPR Consent
  has priority, JPOT is the specified fallback; all other values use first/last initials.
  Initials are pseudonymised, not guaranteed anonymous.
- One high-resolution JPEG with every qualifier independently of filters. Columns:
  RANK | PLAYER NAME | QUALIFIED FROM | CHIP COUNT. No nationality in JPEG.
- Tournament name/date/24-hour circular time picker, Genting Casino Stratford logo,
  responsible-gambling artwork, original layout and styles.
- Preview/download/manual save/supported sharing use the same JPEG; backup/restore.

Player files/records remain browser-local in IndexedDB/localStorage. No real player
data is included in this repository. Changing origin to Netlify does not transfer
browser data: save a private session backup on the old origin and restore on the new
one. Backups contain full staff data; protect them. Browser storage is not authentication.

## Netlify preparation (not authorised to deploy)

| Setting | Current review configuration |
|---|---|
| Base | Repository root (`.`) |
| Netlify build | `npm run build:netlify` — intentionally blocked pending authentication |
| Local build | `npm run build` — passes without network/dependencies |
| Publish | `dist` |
| Functions | None implemented; functions/edge authentication requires approval |
| Environment | `NODE_VERSION=24` is set in netlify.toml; no app secrets needed locally |

No SPA catch-all is needed for the current static one-page app. Relative assets,
worker and vendored parser are included. Login/callback routes and security headers
will be defined after approval. Do not use npm start as a Netlify build command.

Private real-workbook tests are opt-in via `GENTING_REAL_FIXTURES` outside the repo.
CI runs synthetic tests and skips private fixtures. Do not upload fixtures to CI.
The previous GitHub main is preserved on `backup/main-before-version-49-2026-11-06`.
This PR removes the old GitHub Pages auto-deploy workflow and adds verification only.
No merge or deployment is authorised by this migration PR.
