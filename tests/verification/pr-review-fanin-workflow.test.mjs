import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {fixture} from './fixtures/protected-review-fixture.mjs';
import {validateProtectedVisualCapture,validateProtectedReviewEvidence,selectLatestProtectedReview} from '../../tools/verification/protected-review-evidence.mjs';
test('review fan-in retains complete passing machine evidence as an independent prerequisite',()=>{
 const valid=fixture();assert.equal(validateProtectedVisualCapture(valid).accepted,true);assert.equal(validateProtectedReviewEvidence(valid).accepted,true);
 for(const status of ['failed','cancelled','skipped']){
  const f=fixture(),summary=JSON.parse(f.files[0].bytes);summary.scenarios[0].status=status;
  f.files[0].bytes=Buffer.from(JSON.stringify(summary));
  const capture=JSON.parse(f.captureBytes);capture.summary.digest=`sha256:${createHash('sha256').update(f.files[0].bytes).digest('hex')}`;f.captureBytes=Buffer.from(JSON.stringify(capture));
  assert.throws(()=>validateProtectedVisualCapture(f),status);
 }
 const missing=fixture();missing.files=[];assert.throws(()=>validateProtectedVisualCapture(missing));
});
test('latest exact review revocation supersedes old approval and machine pass cannot discharge it',()=>{
 const f=fixture();assert.equal(validateProtectedVisualCapture(f).accepted,true);
 const revoked={...f.review,id:f.review.id+1,state:'DISMISSED',submitted_at:'2026-09-06T10:11:00Z'};
 const latest=selectLatestProtectedReview([f.review,revoked],f.currentCandidate);assert.equal(latest.id,revoked.id);
 assert.throws(()=>validateProtectedReviewEvidence({...f,review:latest}));
 assert.throws(()=>validateProtectedReviewEvidence({...f,review:undefined}));
 assert.throws(()=>validateProtectedReviewEvidence({...f,review:{...f.review,commit_id:'f'.repeat(40)}}));
});
