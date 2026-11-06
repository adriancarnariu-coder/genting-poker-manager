import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {testDeploymentErrors,runTestDeployment} from '../scripts/netlify-test-gate.mjs';
const commit='a'.repeat(40),site='740fcf16-1309-4052-932f-ad16414dde00';
function environment(){return {NETLIFY:'true',CONTEXT:'branch-deploy',BRANCH:'test/v49-netlify',HEAD:'test/v49-netlify',PULL_REQUEST:'false',SITE_NAME:'genting-poker-manager-private',SITE_ID:site,COMMIT_REF:commit,TEST_APPROVED_COMMIT:commit,TEST_DEPLOYMENT_APPROVED:'synthetic-only-v49',APP_ORIGIN:'https://test-v49-netlify--genting-poker-manager-private.netlify.app',DEPLOY_PRIME_URL:'https://test-v49-netlify--genting-poker-manager-private.netlify.app',URL:'https://genting-poker-manager-private.netlify.app',ADMIN_USER_ID:'synthetic-admin-id',AUTH_SESSION_KEY:'b'.repeat(64)};}

test('test gate permits only the fully approved isolated synthetic branch checkout',()=>{
 assert.deepEqual(testDeploymentErrors(environment(),commit),[]);
 for(const key of Object.keys(environment())){const env=environment();delete env[key];assert(testDeploymentErrors(env,commit).length,key);}
});
test('production, preview, local, pull request and preview server contexts cannot pass',()=>{
 for(const context of ['production','deploy-preview','dev','',undefined])assert(testDeploymentErrors({...environment(),CONTEXT:context},commit).length);
 for(const patch of [{NETLIFY:'false'},{NETLIFY_PREVIEW_SERVER:'true'},{BRANCH:'main'},{HEAD:'main'},{PULL_REQUEST:'true'},{REVIEW_ID:'3'}])assert(testDeploymentErrors({...environment(),...patch},commit).length);
});
test('project name and immutable ID both have to match the approved project',()=>{
 for(const patch of [{SITE_NAME:'another-project'},{SITE_ID:'22345678-1234-1234-1234-123456789abc'},{SITE_ID:'invalid'},{SITE_ID:undefined}])assert(testDeploymentErrors({...environment(),...patch},commit).length);
});
test('changing the commit, approval or actual checkout blocks deployment',()=>{
 for(const patch of [{COMMIT_REF:'c'.repeat(40)},{TEST_APPROVED_COMMIT:'c'.repeat(40)},{TEST_APPROVED_COMMIT:'main'},{TEST_DEPLOYMENT_APPROVED:'true'},{TEST_DEPLOYMENT_APPROVED:''}])assert(testDeploymentErrors({...environment(),...patch},commit).length);
 assert(testDeploymentErrors(environment(),'d'.repeat(40)).length);
 assert(testDeploymentErrors(environment(),'').length);
});
test('production origin, mismatched branch origin, HTTP, paths and missing auth configuration fail closed',()=>{
 for(const patch of [{APP_ORIGIN:environment().URL},{APP_ORIGIN:'https://unapproved.example'},{APP_ORIGIN:'http://test.example'},{APP_ORIGIN:environment().APP_ORIGIN+'/'},{URL:'not-a-url'},{DEPLOY_PRIME_URL:'https://other.example'},{ADMIN_USER_ID:'two ids'},{AUTH_SESSION_KEY:'not-a-key'}])assert(testDeploymentErrors({...environment(),...patch},commit).length);
});
test('real fixture configuration blocks even an otherwise approved test build',()=>{
 assert(testDeploymentErrors({...environment(),GENTING_REAL_FIXTURES:'private/player/files'},commit).length);
});
test('failed gate never runs build steps and does not log secret values',()=>{
 let called=false;const old=console.error,logs=[];console.error=s=>logs.push(s);try{assert.equal(runTestDeployment({env:{...environment(),CONTEXT:'production'},checkout:()=>commit,run:()=>{called=true;}}),1);}finally{console.error=old;}
 assert(!called);assert(!logs.join('').includes(environment().AUTH_SESSION_KEY));assert(!logs.join('').includes(environment().ADMIN_USER_ID));
});
test('approved gate runs integrity, function build and synthetic tests in order; any failed step stops',()=>{
 const calls=[],old=console.log;console.log=()=>{};try{
 assert.equal(runTestDeployment({env:environment(),checkout:()=>commit,run:(args,env)=>{calls.push(args);assert(!env.GENTING_REAL_FIXTURES);return {status:0};}}),0);
 assert.deepEqual(calls,[['scripts/verify-build.mjs'],['scripts/build-auth.mjs'],['--test','test/*.test.js']]);
 for(const failure of [0,1,2]){let count=0;assert.equal(runTestDeployment({env:environment(),checkout:()=>commit,run:()=>({status:count++===failure?1:0})}),1);assert.equal(count,failure+1);}
 }finally{console.log=old;}
});
test('default Netlify command and original production guard are unchanged and fail under every context',async()=>{
 const config=await readFile('netlify.toml','utf8'),guard=await readFile('scripts/netlify-review-guard.mjs');
 // Fixed from PR #3; works with a shallow GitHub Actions checkout too.
 assert.equal(createHash('sha256').update(guard.toString().replace(/\r\n/g,'\n')).digest('hex'),'4794677c71b7c6a2797075ceb59cc0c47ed98cb14915f5d35142bf3593a6bb76');
 assert.match(config,/\[build\][\s\S]*?command = "npm run build:netlify"/);
 assert.match(config,/\[context\."test\/v49-netlify"\]\s*command = "node scripts\/netlify-test-gate.mjs"/);
 assert.equal((config.match(/\[context\./g)||[]).length,1);
 assert.match(config,/publish = "private-publish"/);
 for(const CONTEXT of ['production','deploy-preview','branch-deploy']){const r=spawnSync(process.execPath,['scripts/netlify-review-guard.mjs'],{env:{...process.env,...environment(),CONTEXT},encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/DEPLOYMENT BLOCKED/);}
});
test('direct CLI invocation without approval fails closed',()=>{
 const r=spawnSync(process.execPath,['scripts/netlify-test-gate.mjs'],{env:{PATH:process.env.PATH},encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/TEST DEPLOYMENT BLOCKED/);
});
