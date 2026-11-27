# Version 49 Identity 503 investigation and proposed fix

## Verified cause

Read-only, unauthenticated HTTPS GETs on 6 November 2026 returned:

- Test branch /.netlify/identity/settings: HTTP 401, Content-Type text/html,
  Netlify's "Login Redirect" page targeting app.netlify.com/edge-access for the
  approved site ID. This is Netlify private-project access protection, not an
  Identity JSON settings response and not a failed administrator-password check.
- The canonical production hostname's settings path: HTTP 404, Site not found.
  It is not a usable alternate provider host; no production deployment was attempted.

The previous server adapter made an unauthenticated fetch to its own protected branch
hostname. The owner's browser may have passed Netlify's outer access gate, but the
function's new fetch did not carry that access session. Both login and accept-invite
call inviteOnly() before sending credentials. An upstream non-2xx response threw a
generic error, which the gateway converted to HTTP 503. Automated tests reproduce
this chain for both endpoints. Function logs were not accessed, so other concurrent
misconfiguration/Blobs failures cannot be excluded by the public GET alone.

The settings route itself is correct: Netlify GoTrue registers GET /settings before
user authentication middleware and returns disable_signup, external and autoconfirm.
Netlify documents private-project requests being blocked unless the caller has access.
This evidence does not establish that Identity is generally unavailable on branch deploys.
It establishes that these unauthenticated requests never got past project protection.

## Fix and boundaries

- Forward the incoming request's existing cookies only to the validated HTTPS
  APP_ORIGIN's fixed /.netlify/identity endpoints. This authenticates the self-fetch
  through the same existing Netlify gate; it does not disable or bypass that gate.
- Exclude the app's __Host-genting-session cookie. Do not forward arbitrary incoming
  Authorization headers, add a Netlify admin/API token, or introduce a protection-bypass
  secret. Cookie values are never returned to the browser, stored or logged by this code.
- Reject unsafe/oversize cookie headers and non-origin/non-HTTPS provider addresses.
  Refuse redirects and alternate-host retries, use no-store, retain the five-second timeout.
- Keep mandatory invite-only settings validation, confirmed immutable administrator-ID
  verification on login/invitation and every private request, CSRF/origin checks,
  encrypted server sessions, fixed expiry and server-side logout revocation.
- Classify HTML protection responses, JSON settings denial and unavailable services
  as fail-closed 503 errors with fixed public codes. Invalid credentials/invitations
  return generic 401; a revoked user cannot use an existing session. Provider response
  bodies, passwords, invitation tokens and headers are not echoed.
- Show only allowlisted error descriptions on the existing login page. No app design,
  Excel processing, player records, JPEG logic or production deployment settings change.

No new environment variable is required. APP_ORIGIN remains the exact test origin;
ADMIN_USER_ID and AUTH_SESSION_KEY remain server-side. Do not change project visibility,
enable public registration, publish production or remove settings validation to fix this.
Netlify's direct settings URL will correctly keep returning 401 to unauthenticated callers.

## Verification

Synthetic regression tests cover the protection-page failure, both successful flows
when an existing synthetic outer-gate cookie is supplied, wrong/unconfirmed users,
mandatory settings denial, provider failures, revoked sessions, logout, redirect refusal,
cookie bounds, exclusion of the app cookie and secret-safe public error messages.
The full suite uses no real player files, credentials or recovery/invitation tokens.
All 18 original dist files are still verified against their V49 hashes.

Hosted success is NOT yet verified. The real Netlify access cookie must be available
to the function and accepted on its same-origin self-fetch. If Netlify strips it or
requires a different supported mechanism, stop and consult Netlify support; do not
disable protection, forward credentials to another hostname or loosen the admin checks.
Identity also must actually be enabled and configured once the outer gate is passed.

## Review and future test

The isolated source branch is fix/v49-identity-provider-503 (draft PR #5), based on test
commit be5f13ada2e8e6089ea56d23e1f0a05cc38b6de4. The owner subsequently authorised
applying its patch to test/v49-netlify as a separate commit without merging any PR.
This application retains the same authentication patch/tests and updates these notes.
No PR is merged. The test-only gate and original production guard are unchanged;
the fix source branch still cannot deploy via the allowed test path.

The newly prepared test HEAD must be recorded in TEST_APPROVED_COMMIT only after
separate owner approval to start a hosted test. Read the exact SHA from the final report
and GitHub branch, not the old be5f13a SHA or the source fix SHA. No Netlify variable,
visibility setting or Build status is changed by preparing this commit. Keep builds stopped.

Controlled test order (all hosted actions require separate approval):

1. Keep production on its guarded branch, Deploy Previews disabled and branch deploys
   restricted to test/v49-netlify. Review the prepared test commit and passing checks.
2. After approval, the owner updates only TEST_APPROVED_COMMIT to that test HEAD.
   Existing APP_ORIGIN must remain the exact stable test URL, not production. Retain
   ADMIN_USER_ID, AUTH_SESSION_KEY, invite-only registration and Netlify private visibility.
3. Start only the approved test branch deploy using the existing controlled instructions.
   Inspect branch-deploy context, commit, gate and Node 24 in the build results.
4. Privately sign in to the Netlify outer access gate; use a fresh valid administrator
   invitation at /auth/login with its invite_token fragment intact. Confirm invitation
   acceptance and password setup. Recovery tokens remain unsupported by this patch.
5. Verify correct administrator login and GET /auth/session succeeds. A wrong password,
   unconfirmed/unapproved identity, missing app session or failed settings check must
   not grant access. Never record Cookie/Authorization values when checking status.
6. Log out and confirm /auth/session is denied, previous session replay fails, other
   tabs lock and browser Back cannot restore the staff view. Re-login and check the
   fixed maximum 30-minute expiry without extending it through requests.
7. In a separate unauthenticated browser, confirm Netlify's outer gate remains active.
   After passing that gate but without an app login, direct app assets must still be
   denied. If an access cookie expires during login, a safe protection error is expected.
8. Test synthetic Excel import and consent-safe JPEG output on desktop/Android. Stop
   if a protection check fails. Stop builds/remove the test approval flag after testing;
   withdrawing an existing deploy is a separate action, as described in the main guide.

For an approved hosted test, use synthetic players and the owner privately signed into
the Netlify-protected test project. Validate invitation acceptance, administrator login,
missing/expired outer access, wrong credentials, blocked direct assets, logout replay,
30-minute expiry and unchanged Excel/JPEG behaviour. Never copy real Cookie, bearer,
invitation or password values into chat, screenshots, PRs or logs. Record only status,
fixed error code and pass/fail. If failure persists, collect redacted function diagnostics
without tokens and stop. Password recovery remains a separate unimplemented feature.

Sources:
- https://github.com/netlify/gotrue/blob/master/api/api.go
- https://github.com/netlify/gotrue/blob/master/api/settings.go
- https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/
