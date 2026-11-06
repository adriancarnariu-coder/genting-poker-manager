# Authentication proposal — approval required, not implemented

Version 49 is a browser-local static app with no login, sessions, logout or backend.
A frontend-only gate cannot provide secure administrator-only access. This recovery
PR preserves the application; a build guard blocks automatic Netlify publication.

## Options evaluated

1. **Netlify Identity + server-side enforcement (recommended).** Email/password,
   invite-only registration and server-side user verification integrate with Netlify.
   Invite-only must be explicitly enabled: open registration is the default. Invite
   only one administrator and enforce that immutable user ID server-side, even if
   another user is accidentally invited. Do not trust an email or browser flag alone.
2. **Auth0 Universal Login + server session layer.** Suitable if an external managed
   identity tenant is preferred. Disable database sign-ups and allow one verified
   subject ID. Adds separate tenant/callback/session configuration.
3. **Supabase Auth + server session layer.** Suitable if a database is planned later.
   Disable new sign-ups, pre-provision one admin and enforce their verified ID.
   Adds an otherwise unnecessary service for the current local-only app.

## Proposed architecture change

- Public email/password login page only. No public registration; provider settings
  enforce invite-only and external providers are disabled.
- Netlify Functions for login/session/logout with provider-supported server validation
  and CSRF/origin validation on state-changing endpoints.
- Secure, HttpOnly, SameSite server-managed session cookie, bounded idle/absolute
  lifetime, sign-in rotation, expiry handling, server logout/revocation. Never store
  passwords or long-lived tokens in code, browser config or localStorage.
- Server/edge enforcement for application routes/assets and all future backend APIs.
  Direct URLs, alternate asset paths and direct function URLs must not bypass checks.
  Missing identity configuration or validation errors must fail closed.
- Exactly one immutable administrator ID in server-only configuration; provider
  secrets, if required, belong in Netlify runtime secrets, never the static bundle.
- Excel/JPEG processing stays local. No player upload or server database is needed.
  Preserve existing import/export and backup schema.
- Define/test logout clearing of local private records, cached staff views and JPEG
  previews on shared devices. Explain re-import/backup restoration after logout.
- Test unauthenticated, wrong-user, expired/revoked sessions, CSRF, logout, direct
  routes/assets and caches before removing the deployment guard.

## Approval and setup needed

Approve this architecture (or choose another provider). Then select the Netlify
project/domain and administrator email through the provider setup flow. Choose the
password in the provider, not in chat. Exact runtime configuration will be documented
after integration is selected. No accounts/secrets/provider settings were changed.
Approval of the architecture does not authorise merging or deployment.

## Primary references checked

- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/registration-login/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/
- https://support.auth0.com/center/s/article/disable-sign-ups-for-a-specific-application
- https://supabase.com/docs/guides/auth/general-configuration
- https://supabase.com/docs/guides/auth/server-side
