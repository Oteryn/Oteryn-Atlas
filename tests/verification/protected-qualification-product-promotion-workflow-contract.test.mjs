import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {buildQualificationWorld} from '../../tools/verification/qualification-world.mjs';
import {verifyQualificationWorld,qualificationTrustDescriptor} from '../../tools/verification/protected-qualification-oracle.mjs';
import {resolveFullWorldTrust} from '../../src/browser/fullworld-trust.mjs';
test('qualification product is independently verified before its exact roots reach browser trust',async t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-promoted-product-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const root=path.join(temp,'world');const built=await buildQualificationWorld(root);
 const verified=await verifyQualificationWorld(root);assert.deepEqual(verified,built);
 const trust=resolveFullWorldTrust({__OTERYN_ATLAS_QUALIFICATION_TRUST__:qualificationTrustDescriptor(verified)});
 assert.equal(trust.qualificationProductDigest,verified.productDigest);
 fs.appendFileSync(path.join(root,'publication/publication.json'),'candidate mutation');
 await assert.rejects(verifyQualificationWorld(root),/digest|bytes|JSON/);
});
