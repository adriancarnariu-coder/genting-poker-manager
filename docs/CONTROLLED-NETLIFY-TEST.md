# Controlled Version 49 Netlify test — preparation only

No deployment is authorised by this branch or pull request. Keep Netlify builds stopped
and do not enable TEST_DEPLOYMENT_APPROVED until the owner separately approves a test.
PRs #2 and #3 stay unmerged. The existing published Sites app is not changed.

## Source and isolation

Branch: test/v49-netlify, based on reviewed PR #3 commit
d5880c962c809832278d80b50a4a069f12f8a1f3. All original application assets and auth files
are unchanged. Only the test gate, its tests, this guide and a named-branch build-command
override are added. The existing production guard is unchanged and remains the default.

The new gate requires the exact Netlify project name AND immutable project ID, branch,
non-PR branch-deploy context, exact approved Git SHA matching the actual checkout,
test branch URL and explicit approval. Missing/mismatched settings stop the build.
Even if the test branch is accidentally selected as production, the test gate rejects it.
All gate failures stop before compiling or running the application tests. No credentials
or environment values are printed. No CLI deploy/build hook/API call exists in this gate.

The approved SHA is set outside Git after review; embedding a commit's own SHA in that
commit is impossible. A later code change requires a new review and new approval SHA.
The project ID supplied by the owner is pinned in the gate:
740fcf16-1309-4052-932f-ad16414dde00. It is not inferred from the display name.
The commit approval is an operator-controlled Netlify setting, not a credential.
Repository/Netlify editors remain trusted: build gates
cannot prevent an authorised editor from replacing commands or manually uploading files.

## Before pushing/opening the draft PR

Netlify: Project configuration > Developer settings > Continuous deployment > Build
settings > Configure > Build status > Stopped builds. This must stop all builds, not
merely auto-publishing. Confirm stopped before any branch push or PR creation; otherwise
Netlify can start automatic branch/preview builds without a manual Deploy click.
Keep builds stopped throughout review. Do not unlink/relink the repository (that can
reactivate builds). GitHub Actions verification contains no deployment command.

## Configuration for a future explicitly approved test

| Setting | Value |
|---|---|
| Project | genting-poker-manager-private |
| Production branch | restore/version-49-netlify-review (existing unconditional guard) |
| Enabled branch deploy | Only test/v49-netlify |
| Deploy Previews | Disabled |
| Base | Repository root (.) |
| Default build command | npm run build:netlify (unchanged; must fail) |
| Test branch command | node scripts/netlify-test-gate.mjs (named branch in netlify.toml) |
| Publish | private-publish; NEVER dist |
| Functions | netlify/functions |
| Node | 24; do not override Functions to an older runtime |

Set these values ONLY for the test branch/context. Where scoped variables are available,
include Builds for gate settings. Do not put secrets or approval defaults in netlify.toml.

| Variable | Value | Scope |
|---|---|---|
| TEST_APPROVED_COMMIT | Full 40-character SHA of the final reviewed test commit | Builds |
| TEST_DEPLOYMENT_APPROVED | Leave absent during preparation; synthetic-only-v49 only after separate approval | Builds |
| APP_ORIGIN | Exact stable branch deploy HTTPS origin shown by Netlify, no trailing slash | Builds and Functions |
| ADMIN_USER_ID | The verified single Identity user ID | Builds and Functions |
| AUTH_SESSION_KEY | The existing securely generated 64-hex-character key (never paste into Git/chat) | Builds and Functions |

The gate validates auth variable formats only; it does not authenticate to Identity or
prove provider configuration. Netlify supplies SITE_ID, SITE_NAME, CONTEXT, BRANCH,
HEAD, COMMIT_REF, PULL_REQUEST, URL and DEPLOY_PRIME_URL. Do not manually override them.
APP_ORIGIN must equal DEPLOY_PRIME_URL and differ from the production origin/hostname.
Read the actual branch URL from Netlify; do not assume slash-to-dash URL formatting.
Preview/per-deploy aliases intentionally fail runtime origin checks.

Leave GENTING_REAL_FIXTURES unset. Use invented players and synthetic XLS/XLSX files
only, including for local regression checks. The gate rejects a real-fixture directory.
Existing real-workbook tests skip when that variable is absent; no real workbooks belong
in the repository, Netlify, CI, screenshots, reports or backups for this test.

Identity: email/password on, Invite only, no external providers, one invited admin,
confirmation required. Invitation must reach /auth/login with #invite_token preserved.
Do not disable confirmation or create another real user merely to test rejection; use
mock tests for a second ID, or a separately approved temporary test identity if needed.
The app calls /.netlify/identity on APP_ORIGIN: verify Identity availability on this branch
hostname before accepting the invitation. If unsupported, stop and propose a reviewed
provider-origin adjustment; do not redirect to or deploy the unprotected old public app.
Do not change provider settings that affect another live app without reviewing the impact.
Invitation acceptance should be tested with a fresh invitation after the approved build.

## Controlled execution (requires separate approval)

1. Review the final commit/draft PR, passing tests and exact settings above. Record
   approved project ID, commit SHA, branch and stable URL. Do not merge PRs.
2. Confirm production and previews remain blocked, no real data is present, and the
   Netlify project supports Functions, Blobs and Identity. Runtime auth must remain intact.
3. Only after explicit owner approval, configure the test-only approval settings and
   activate builds for the controlled test. Trigger only the approved branch build.
   Any unrelated context/branch/commit must still fail. Re-stop builds after the test.
4. Inspect the resolved Netlify build configuration: correct branch/context, test gate,
   publish directory, Node runtime and included_files. Verify functions gateway/login
   package correctly and can read manifest/private assets. A failure is a stop, not a
   reason to publish dist directly or loosen authentication.

## Hosted acceptance checks — all synthetic data

- Identity invitation: correct login destination, token removed from history, password
  set through the invitation flow, only the approved confirmed ID gets an app session.
  Invalid/reused invitation tokens fail; do not publish or record invitation tokens.
- Login: administrator succeeds, incorrect password fails, no public signup, configured
  throttling applies. Missing config/provider outage fails closed. No password in logs.
- Protection: incognito root, index.html, every manifest asset, /.netlify/functions/*,
  /dist/* and alternate paths/aliases never expose app content without a session.
  Login/client styles can be public. No upload/player API is introduced.
- Sessions: Secure/HttpOnly/SameSite=Strict host cookie, private no-store headers,
  server-side rejection of missing/wrong Origin POSTs, encrypted Blobs auth metadata.
- Logout: saved cookie replay denied, other tabs lock, browser Back does not restore a
  staff view, local records/JPEG are cleared. Save only a synthetic backup if needed.
- Expiry: wait through the real 30-minute maximum; access remains denied until login.
  Repeated requests must not extend expiry. Test storage/provider failures safely.
- Imports: generated BIFF .xls and .xlsx, Entries/Re-Entries, mixed multi-file addition,
  replace/remove/undo, FLT/JPOT aliases, numeric chip order and duplicate flagging.
- GDPR: Y/YES only, N/NO, blank, missing and conflicting values; staff view preserves
  originals and JPEG uses the permitted display name only. No nationality in JPEG.
- Export: tournament/date/time/logo/header preserved, exactly one JPEG containing all
  qualifiers despite active filters, preview/download/share bytes match. Check totals
  1, 9, 29, 66, 79, 118 and 147 using synthetic players, including long names.
- Desktop and real Android: login, touch clock, Excel picker, generation, download,
  open/manual save and supported share. Report unavailable device checks as unverified.
- Network review: Excel bytes/player records/JPEG/backups never sent to a server.
  Authentication credentials/metadata are the only new server exchanges/storage.

Record passes/failures without secrets or real player data. Any failed protection check
stops testing. Production requires a separate review and approval even if every test passes.

## Stop/rollback

Stop builds and remove TEST_DEPLOYMENT_APPROVED after the test; this prevents future
approved builds but DOES NOT remove an already deployed branch. Disable/delete the
branch deploy in Netlify or use its supported unpublish/delete controls to withdraw access,
and revoke test sessions if required. Confirm the test URL is no longer serving the app.
Do not promote a branch deployment to production. Keep both original PRs unmerged.
Changing an origin/key requires new testing; never reuse a stale JPEG or real backup.

References:
- https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/
- https://docs.netlify.com/build/configure-builds/file-based-configuration/
- https://docs.netlify.com/build/configure-builds/environment-variables/
- https://docs.netlify.com/build/functions/environment-variables/
- https://docs.netlify.com/deploy/deploy-types/branch-deploys/
