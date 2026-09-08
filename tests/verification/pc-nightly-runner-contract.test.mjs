import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {resolveBrowserExecution} from '../../tools/verification/browser-execution.mjs';
import {deriveVerificationMetadata} from '../../tools/verification/verification-metadata.mjs';
const registry=deriveVerificationMetadata(JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json',import.meta.url)))).browser;
import {createPublicationProofFixtures} from './helpers/publication-proof-fixture.mjs';
const input={protectedRegistry:registry,requiredGroups:['fullworld.animation-census','e2e.bounded-stress'],atlasRevision:'a'.repeat(40),environmentDigest:'b'.repeat(64),protectedBaseSha:'f'.repeat(40),...createPublicationProofFixtures()};
test('complete-product placement remains specialist-only and cannot run without authenticated proof',()=>{
 const full=registry.catalog.groups['fullworld.animation-census'];
 assert.equal(full.capabilities.dataCapability,'real_fullworld');
 assert.equal(full.capabilities.hosted,false);
 assert.equal(full.capabilities.specialistReason,'real-fullworld-product');
 assert.throws(()=>resolveBrowserExecution(input),/raw publication proof for real_fullworld/);
 const result=resolveBrowserExecution({...input,requiredGroups:['e2e.bounded-stress']});
 assert(result.commands.length>0);
 for(const command of result.commands)assert(result.partitions.hostedPlaywright.includes(command.executionKey));
 assert(result.commands.every(command=>!command.argv.some(arg=>/synology|192\.168\./i.test(arg))));
});
test('specialist capacity cannot be substituted by absent source identity or candidate command changes',()=>{
 const changed=structuredClone(input);delete changed.publicationProofs.real_fullworld;
 assert.throws(()=>resolveBrowserExecution(changed),/publication|proof/);
 const injected=structuredClone(input);injected.protectedRegistry.specs.find(row=>row.minimumDataCapability==='real_fullworld').execution.argv=['synology','run'];
 assert.throws(()=>resolveBrowserExecution(injected),/argv/);
});
