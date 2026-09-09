import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {deriveVerificationMetadata} from '../../tools/verification/verification-metadata.mjs';
import {resolveBrowserExecution} from '../../tools/verification/browser-execution.mjs';
import {createPublicationProofFixtures} from './helpers/publication-proof-fixture.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json',import.meta.url)));
const registry=deriveVerificationMetadata(catalog).browser;
const resolve=groups=>resolveBrowserExecution({protectedRegistry:registry,requiredGroups:groups,atlasRevision:'a'.repeat(40),environmentDigest:'b'.repeat(64),protectedBaseSha:'c'.repeat(40),...createPublicationProofFixtures()});
test('full fixture obligation does not imply complete-product capability',()=>{
 const full=catalog.groups['e2e.full'];
 assert.equal(full.executionRole,'aggregate');
 const result=resolve(full.dependsOnGroups);
 assert(result.commands.length>0);
 assert(result.commands.every(command=>command.dataCapability==='qualification_fixture'));
 assert.deepEqual(result.partitions.specialistPlaywright,[]);
});
test('bounded source contracts retain hosted request-only and browser execution',()=>{
 const result=resolve(['integration.source-contract-http','integration.source-contract-browser']);
 assert(result.commands.length>0);
 assert(result.commands.every(command=>command.dataCapability==='bounded_real_world'));
 assert.deepEqual(result.partitions.specialistPlaywright,[]);
 assert.equal(result.partitions.hostedPlaywright.length,result.commands.length);
});
test('complete FullWorld placement stays specialist and missing execution proof fails closed',()=>{
 const group=catalog.groups['fullworld.animation-census'];
 assert.equal(group.capabilities.dataCapability,'real_fullworld');
 assert.equal(group.capabilities.hosted,false);
 assert.equal(group.capabilities.specialistReason,'real-fullworld-product');
 assert.throws(()=>resolve(['fullworld.animation-census']),/raw publication proof for real_fullworld/);
});
