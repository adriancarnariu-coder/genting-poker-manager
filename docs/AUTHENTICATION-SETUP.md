# Single-administrator authentication — review only

## Choice verified on 6 November 2026

Netlify's current documentation supports Identity on all credit-based plans, including
new projects, invite-only email/password and Functions integration. Therefore Identity
is the simplest appropriate choice here. Auth0 is a supported alternative if Identity
is unavailable on the chosen account, but needs a separate tenant and callback setup.
No account or provider configuration has been changed by this work.

Sources:
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/registration-login/
- https://docs.netlify.com/build/functions/configuration/

## What you need to do (no deployment yet)

1. Choose the Netlify project and its final HTTPS address. Keep builds blocked.
2. In that project's Identity settings, enable Identity. Set registration to Invite only.
   Disable external login providers; keep email/password enabled. Configure a strong
   provider password policy. The application also refuses login if these settings are unsafe.
3. Invite only your administrator email. Copy that user's immutable Identity user ID
   from the Identity user details/API. If the dashboard does not show it, ask for help
   retrieving the ID; do not send passwords, API tokens or invitation links in chat.
4. Set the Identity Site URL/allowed invitation destination to your final address plus
   /auth/login. Invitation links use the provider invite_token fragment. The login page
   exchanges it on the server and removes it from browser history. Set the password
   yourself through the invitation flow after an explicitly approved test deployment.
5. In Netlify environment variables, add the following with Functions/runtime scope:
   APP_ORIGIN = exact HTTPS origin, for example https://your-project.netlify.app
   ADMIN_USER_ID = the one invited Identity user ID (not an email address)
   AUTH_SESSION_KEY = a fresh random 32-byte key, encoded as 64 hexadecimal characters
   Generate the key locally: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   Paste it directly into Netlify; never put it in GitHub, a frontend variable or chat.
   Node 24 is already configured in netlify.toml. Netlify supplies Blobs credentials;
   no personal Netlify API token is embedded or required in the application.
6. Review the authentication PR and this checklist. Ask explicitly for a private test
   deployment when ready. Do not merge PR #2 or remove the guard as a setup shortcut.

APP_ORIGIN is intentionally exact: alternate domains/preview origins fail closed.
Use isolated configuration and synthetic data for any approved preview test.

## Architecture and limits

Functions protect the HTML and every manifest-listed static asset. Only the login page,
its styles/client, the provider's own Identity service and a generic 404 are public.
Original dist files stay outside the publish directory. Custom function paths disable
Netlify's default function URLs; validate this on the hosted deployment before approval.
An immutable user-ID allowlist grants app access to exactly one confirmed account,
even if someone accidentally invites a second user. Do not create extra provider accounts.
There is no app signup route and no frontend-only authorisation.

The server uses the provider REST endpoints verified against official @netlify/identity
2.0.0/GoTrue implementations. It avoids SDK browser-readable token cookies and offline
claim fallbacks. Every protected request validates the current Identity user online;
provider/storage errors fail closed. Credentials are sent over HTTPS to Identity by the
server, never logged or saved. The browser receives only a random opaque session cookie:
Secure, HttpOnly, SameSite=Strict, host-only. The corresponding access token is AES-GCM
encrypted in strongly consistent Netlify Blobs, keyed by a hash of the session ID.
No refresh token is stored. Sessions have a fixed maximum 30-minute lifetime (or less
if the provider token expires sooner), are rotated on login and revoked server-side on logout.
Changing the session key invalidates every stored session. Expired records are unusable
and deleted when presented; abandoned expired records may remain encrypted in Blobs.
Periodically remove expired auth records using an administrator maintenance process.
Netlify request-rate limits are configured for login and authenticated assets; provider
password throttling and actual platform enforcement must be verified in hosted testing.

POSTs require the configured Origin and JSON; cross-site requests are refused.
Responses are no-store and carry framing/content restrictions. Provider responses and
secrets are not echoed. Authentication endpoints accept only bounded credential data;
there is no player upload endpoint. Excel, imported records, JPEG and session backups
stay browser-local. Auth metadata is the only new server storage.

Logout/expiry navigates to login and clears V49 IndexedDB/tournament storage. Other tabs
are notified; blocked deletion prevents another sign-in until those tabs are closed.
Previously saved backups/images remain on the user's device. Save a private backup
before logout if needed. Browser storage cannot protect against someone controlling an
already unlocked browser/device; lock the device and sign out when finished.
The existing app design, data model, JPEG, import and backup format are unchanged.
Only a matching login page and a Log out button are added. Android help links use the
new protected origin rather than sending users back to the old unprotected Site.

## Tests and release gate

Local tests cover wrong user/unconfirmed account, expiry, cookie rotation/tampering,
logout replay, CSRF, fail-closed outages/configuration, invitation restriction, direct
asset allowlists and preservation of the deployment guard. Synthetic credentials only.
The full existing suite covers import/GDPR/model/export contracts and real private workbooks
when GENTING_REAL_FIXTURES is set. Original V49 asset hashes are checked during build.

Not yet verified: a real Netlify Identity account, invitation email acceptance, Functions
packaging/included files, strong Blobs consistency, default-function URL blocking,
platform rate limits, browser CSP, logout/back-button/tab storage clearing, actual phone
login and full Excel/JPEG UI flow behind the gate. These require an approved hosted test.
Do not call this production-ready until all are checked. Test an unauthenticated direct
URL for every app asset, second-user login, session expiry/logout replay, blocked storage,
Chrome/Android interaction, and JPEG download with synthetic player data only.

No PR merge, guard removal or deployment is authorised by this implementation.
