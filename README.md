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

## V50 audit fixes (branch claude/v50-audit-improvements)

- Chrome/help links use the current address; no link to the old public copy remains.
- Uploading a file whose name is already loaded asks: replace it, or keep both (the new one becomes "name (2).xlsx").
- Duplicate review: each group shows name, Player ID, flight, chips and source. KEEP HIGHEST STACK removes the lower stacks;
  DIFFERENT PLAYERS keeps all. Decisions are stored with the exact group, so a later file change re-opens review.
- Session expiry or a network problem no longer clears local data: the app returns to sign-in and the files are still there.
  Only LOG OUT clears local player data. A notice appears 5 minutes before the session ends.

## Tournament branding (branch claude/v50-tournament-branding, local review)

- Tournament settings card: UPLOAD TOURNAMENT LOGO (PNG, JPEG, WebP, max 10 MB) with thumbnail, REPLACE LOGO and REMOVE LOGO.
- The logo is saved in this browser per tournament name (recurring series); "Only for this date" overrides it for one edition.
- JPEG: Genting top-left and the tournament logo top-right in two equal zones with symmetric margins, framed by their visible
  (non-transparent) part and drawn from the original image. Without a tournament logo the right zone stays empty.
- Tournament name centred below the header (max two lines), then date and 24-hour time on one line, e.g. "24 Nov 2026 · 18:15".
- Download name: <Tournament>_<YYYY-MM-DD>_Day2_Leaderboard_<W>x<H>.jpg. Logos are not part of session backups.

## V51 leaderboard pages and social formats (branch claude/v51-multi-page)

- **Pages:** at most 20 players per column and 40 per JPEG. Longer leaderboards are split into full pages of 40 in rank order (120 players = 3 pages; up to 160 = 4 pages; more still export). Every page has the same size and type; a page with 20 or fewer players uses one centred column.
- **Formats:** Full leaderboard, Post 1080 x 1080 (15 per page) and Story 1080 x 1920 (20 per page, 250 px top and bottom left clear for Instagram).
- **Header:** "<name> · Day 2", date and time, "N qualified · £X prize pool", and optionally "1st place £X · min cash £Y". Page number small at the bottom right.
- **Frame:** equal visible gaps above the header, between header and table, between table and the responsible gambling band, and under the band. A thin line marks the end of the table.
- **Table:** chip leader row framed in gold; ranks 1-3 in gold, silver and bronze discs; optional Day 2 big blind shows each stack in BB; places paid draws a gold line under the last paid place.
- **Export:** page switcher, DOWNLOAD ALL PAGES, SAVE & SHARE ALL PAGES, numbered filenames (`..._1of3_...jpg`).
- **Checks before export:** plain warnings above GENERATE (missing name or date, invalid amounts, prizes that do not add up, places paid not below the qualified count, stacks under 1 BB). They never block the export.
- **Fields:** tournament details in rows across the page (two columns on phones). Session backups keep the new fields; older backups still restore.
- Tests: `npm test` (138 pass, 6 skipped because they need the real fixtures).
