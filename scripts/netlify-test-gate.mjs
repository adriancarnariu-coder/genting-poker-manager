import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const TEST_BRANCH='test/v49-netlify';
export const TEST_PROJECT='genting-poker-manager-private';
export const TEST_SITE_ID='740fcf16-1309-4052-932f-ad16414dde00';
const sha=/^[0-9a-f]{40}$/;
const origin=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value?u.origin:null;}catch{return null;}};

// Operator approvals are set in Netlify after review, never committed with an enabled default.
// This is a release gate, not a substitute for runtime authentication or Git/Netlify access control.
export function testDeploymentErrors(env,checkoutCommit){
 const errors=[];
 if(env.NETLIFY!=='true'||env.NETLIFY_PREVIEW_SERVER)errors.push('Netlify build metadata is required; preview servers are not allowed.');
 if(env.CONTEXT!=='branch-deploy')errors.push('Only branch-deploy context is allowed; production and previews remain blocked.');
 if(env.BRANCH!==TEST_BRANCH||env.HEAD!==TEST_BRANCH)errors.push('The isolated test branch is required.');
 if(env.PULL_REQUEST!=='false'||env.REVIEW_ID)errors.push('Pull request builds are not allowed.');
 if(env.SITE_NAME!==TEST_PROJECT)errors.push('The approved Netlify project is required.');
 if(env.SITE_ID!==TEST_SITE_ID)errors.push('Netlify SITE_ID must match the pinned approved project ID.');
 if(!sha.test(env.TEST_APPROVED_COMMIT||'')||env.COMMIT_REF!==env.TEST_APPROVED_COMMIT||checkoutCommit!==env.TEST_APPROVED_COMMIT)errors.push('The exact reviewed checkout commit must be approved.');
 if(env.TEST_DEPLOYMENT_APPROVED!=='synthetic-only-v49')errors.push('Separate test deployment approval is not enabled.');
 const app=origin(env.APP_ORIGIN),prime=origin(env.DEPLOY_PRIME_URL),production=origin(env.URL);
 if(!app||!prime||app!==prime||!production||app===production||new URL(app).hostname===new URL(production).hostname)errors.push('APP_ORIGIN must match the isolated branch URL, not the production address.');
 if(!/^\S{1,128}$/.test(env.ADMIN_USER_ID||''))errors.push('A single administrator user ID is required.');
 if(!/^[a-f0-9]{64}$/i.test(env.AUTH_SESSION_KEY||''))errors.push('A valid server session key is required.');
 if(env.GENTING_REAL_FIXTURES)errors.push('Real player fixtures are forbidden in the test deployment.');
 return errors;
}

export function runTestDeployment({env=process.env,checkout,run}={}){
 let commit='';try{commit=checkout?checkout():execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
 const errors=testDeploymentErrors(env,commit);
 if(errors.length){console.error('TEST DEPLOYMENT BLOCKED:\n'+errors.map(e=>' - '+e).join('\n'));return 1;}
 // No CLI deploy, build hook, provider setup or uploads are performed by this script.
 const childEnv={...env};delete childEnv.GENTING_REAL_FIXTURES;
 for(const args of [['scripts/verify-build.mjs'],['scripts/build-auth.mjs'],['--test','test/*.test.js']]){
  const result=run?run(args,childEnv):spawnSync(process.execPath,args,{stdio:'inherit',env:childEnv});
  if(result.error||result.status!==0)return 1;
 }
 console.log('Approved synthetic-only branch build verified. Production guard is unchanged.');
 return 0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=runTestDeployment();
