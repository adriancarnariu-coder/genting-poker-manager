// This recovery PR is review-only. Do not auto-publish an unauthenticated staff app.
console.error('DEPLOYMENT BLOCKED: administrator authentication is not implemented or approved. Review docs/AUTHENTICATION-PROPOSAL.md before enabling Netlify deployment. Local verification: npm run build && npm test.');
process.exit(1);
