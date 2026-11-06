# Genting Poker Manager — recovered Version 49 + authentication review

Existing Version 49, not a rewrite: all 18 dist assets remain byte-for-byte unchanged.
Source commit: 953f8b7253b49e355642cc148f7fe19f030406bf. Hashes are verified during build.
The authentication branch is stacked on recovery PR #2. Neither PR is authorised to merge or deploy.

## Deployment remains blocked

The existing build:netlify guard is unchanged and intentionally fails. Never publish dist directly.
Only private-publish/404.html is public; Netlify Functions serve app assets after server checks.
Authentication is implemented for review, not configured or verified on a live Netlify project.
See docs/AUTHENTICATION-SETUP.md for operator setup and the required hosted acceptance checks.

## Verification

Use Node >=22.12 (CI uses 24), then npm ci, npm run build and npm test.
Build verifies V49 hashes and compiles both authentication function entry points.
The inherited npm start serves the original app UNPROTECTED for local regression checks only.
Do not expose that development server to the internet or use it for private production access.

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


## Review configuration

- Base: repository root (.)
- Build: npm run build:netlify — still intentionally blocked
- Publish: private-publish (never dist)
- Functions: netlify/functions
- Runtime: Node 24
- Function environment: APP_ORIGIN, ADMIN_USER_ID, AUTH_SESSION_KEY (see setup guide)

Only auth metadata and an encrypted, short-lived Identity access token enter Netlify Blobs.
No player upload API exists. Logout/session expiry clears the app's local data on the login page;
save a private backup before signing out if you need to restore your session later.
The old public Sites application is unchanged and is not protected by this GitHub branch.

Private workbook checks use GENTING_REAL_FIXTURES outside the repository; never commit fixtures.
The original main is preserved on backup/main-before-version-49-2026-11-06.
