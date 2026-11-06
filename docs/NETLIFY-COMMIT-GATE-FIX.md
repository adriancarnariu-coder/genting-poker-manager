# Controlled test commit gate: manual/hook metadata fix

## Verified investigation

The test branch was inspected at ff26f8fba94dc160aa4b2039338d786a5804f434.
Its approved checkout guard combined three conditions into one message:

1. TEST_APPROVED_COMMIT must be a 40-character lower-case Git SHA.
2. COMMIT_REF must equal that SHA.
3. git rev-parse HEAD must equal that SHA.

Thus a correct approval and exact matching checkout still failed when COMMIT_REF was
HEAD, missing or empty. This was reproduced locally with synthetic SHA values, without
reading or changing Netlify settings. The variable name COMMIT_REF is correct, but it
was incorrectly treated as an invariably populated full SHA. Netlify support documents
manual/non-Git builds using HEAD and build hooks omitting Git metadata. The hook API
selects a branch with trigger_branch; that is not itself a pinned commit approval.

The branch still points to the reported approved commit; it has not drifted in GitHub.
GitHub has no linked Netlify commit status identifying this failed build. The supplied
single error line cannot distinguish missing/HEAD platform metadata, an unreadable Git
checkout, or a genuinely different checked-out SHA. The exact values in that specific
Netlify execution were not available; this report does not invent them or blame the
owner's verified environment value. No environment-variable recheck is requested.

netlify.toml correctly runs the test gate for test/v49-netlify and keeps the unchanged
production blocker as its default. It does not override TEST_APPROVED_COMMIT or
COMMIT_REF. The old tests used matching SHA strings only, missing the manual/hook case.

## Secure fix

- Resolve actual source using git rev-parse --verify HEAD^{commit}, anchored to the
  gate's own repository root rather than an inherited current working directory.
- Always require that resolved full SHA to match the operator-approved full SHA exactly.
  Unavailable Git, unreadable checkout, invalid approval or different code still blocks.
- Treat absent/empty COMMIT_REF and its documented HEAD marker as non-authoritative
  metadata, never as proof or as a substitute for successful Git verification.
- If Netlify supplies a full COMMIT_REF SHA, require it to match the approval too.
  Reject conflicting SHAs, abbreviated hashes, arbitrary refs and malformed metadata.
- Do not use CACHED_COMMIT_REF, branch tips, an approval value copied into a fallback,
  environment HEAD, remote API requests or a synthetic PR merge as the source proof.
- Report separate failure reasons and only three allowlisted source identifiers:
  approved SHA, actual checkout SHA, and Netlify SHA/HEAD/missing/invalid classification.
  Never print raw malformed values, the environment, private Git stderr or credentials.

All other project, branch, context, origin, explicit approval and synthetic-data gates
remain in force. Production guard, netlify.toml, authentication, V49 assets, dependencies
and player processing remain unchanged. This is not permission to deploy an unreviewed SHA.

## Tests

Regressions cover matching Git-triggered metadata, manual HEAD, missing/empty hook
metadata, missing/different actual checkout, conflicting platform SHA, malformed refs,
missing approval and secret-safe diagnostics. A subprocess test launches the gate from
a temporary directory outside the repository to exercise real anchored Git resolution,
with deployment approval disabled so no build steps execute. Existing production,
project, context, CSRF/session, synthetic Excel and JPEG tests remain in the full suite.
No Netlify build or real player fixture is used to reproduce the failure.

## Review and new commit approval

This is a separate fix branch and draft PR, not an update/deployment of test/v49-netlify.
No Netlify settings are changed; builds were confirmed stopped before publishing the PR.
After review, applying this patch to the test branch creates a new test HEAD. That final
SHA, not ff26f8f and not a guessed SHA, needs separate owner approval before deployment.
No setting update or build trigger is performed during preparation.

On a later approved build, any remaining failure will identify the exact failing
comparison. If the actual checkout differs, stop; do not approve whatever code happens
to be present. If Git cannot be verified, stop; do not replace it with environment-only
validation. Netlify's runtime metadata for the failed historical build remains unverified.

Primary references:
- https://docs.netlify.com/build/configure-builds/environment-variables/
- https://docs.netlify.com/build/configure-builds/build-hooks/
- https://answers.netlify.com/t/commit-ref-is-null-if-the-deploy-was-via-a-build-hook/12228/3
- https://answers.netlify.com/t/deploys-how-to-find-the-exact-commit-sha-when-commited-from-head/18020
