import crypto from 'node:crypto';

import { canonicalJson } from './verification-plan-schema.mjs';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function exactSha(value, label) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new TypeError(`${label} must be an exact lowercase SHA`);
  return value;
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${label} must be sha256:<64 lowercase hex>`);
  return value;
}

const PROTECTED_PROMOTION_QUALIFICATIONS = freeze({
  'fix/issue-179-bounded-real-row-framing': {
    id: 'bounded-real-row-framing-v1',
    headRef: 'fix/issue-179-bounded-real-row-framing',
    changedFiles: [
      'tests/verification/bounded-real-world.test.mjs',
      'tests/verification/protected-hosted-product-identities.test.mjs',
      'tools/verification/bounded-real-world.mjs',
      'tools/verification/protected-hosted-product-identities.json',
    ],
    expectedProductDigest: 'sha256:a19f0371eb5afcdf8c40156d732d5602e970400ec9369607f901e2f0a58c92b6',
  },
  'fix/issue-179-qualification-trust-descriptor': {
    id: 'qualification-trust-descriptor-v1',
    headRef: 'fix/issue-179-qualification-trust-descriptor',
    changedFiles: [
      '.github/workflows/protected-hosted-executor.yml',
      'tests/verification/protected-hosted-compose-promotion.test.mjs',
      'tests/verification/qualification-world.test.mjs',
      'tools/verification/qualification-world.mjs',
    ],
    expectedProductDigest: 'sha256:f53f1dcb8961c42e82191644b7628cfb4f30641344c8876f4178d37a94dd4cd5',
  },

  'fix/issue-179-qualification-functional-fixture': {
    id: 'qualification-functional-fixture-v1',
    headRef: 'fix/issue-179-qualification-functional-fixture',
    changedFiles: [
      'e2e/support/creature-presentation-fixtures.mjs',
      'e2e/tests/audit-desktop.spec.mjs',
      'e2e/tests/creature-interaction-desktop.spec.mjs',
      'e2e/tests/creature-presentation-desktop.spec.mjs',
      'e2e/tests/creatures-desktop.spec.mjs',
      'e2e/tests/desktop.spec.mjs',
      'e2e/tests/farm-explorer-desktop.spec.mjs',
      'e2e/tests/farm-explorer-mobile.spec.mjs',
      'e2e/tests/geometry-desktop.spec.mjs',
      'e2e/tests/geometry-mobile.spec.mjs',
      'e2e/tests/mobile.spec.mjs',
      'e2e/tests/performance-desktop.spec.mjs',
      'e2e/tests/race-desktop.spec.mjs',
      'e2e/tests/runtime.mjs',
      'e2e/tests/soak-desktop.spec.mjs',
      'e2e/tests/state-desktop.spec.mjs',
      'e2e/tests/stress-desktop.spec.mjs',
      'e2e/tests/visual-desktop.spec.mjs',
      'e2e/tests/visual-mobile.spec.mjs',
      'src/browser/semantic-search.mjs',
      'tests/verification/protected-hosted-product-identities.test.mjs',
      'tests/verification/qualification-semantic-source-trust.test.mjs',
      'tests/verification/qualification-world.test.mjs',
      'tools/verification/protected-hosted-product-identities.json',
      'tools/verification/qualification-fixture-definition.mjs',
      'tools/verification/qualification-world.mjs',
      'web/fullworld-farm-explorer.mjs',
      'web/fullworld-search.mjs',
    ],
    expectedProductDigest: 'sha256:3ab3472677e95e30795015869c73e54e6422c2b6144b01cccfbbbbaeafa98de9',
    candidateCensusMount: {
      sourceTree: 'exact-candidate-checkout',
      containerRoot: '/candidate',
      readOnly: true,
      dependencySource: '/protected-e2e-node-modules/node_modules',
      dependencyTarget: 'e2e/node_modules',
      dependencyLinkPhase: 'host-before-readonly-mount',
    },
    deterministicRuntimeShim: {
      command: 'python',
      target: '/usr/bin/python3',
      shimRoot: '/tmp/atlas-python-bin',
      pycacheRoot: '/tmp/atlas-python-pycache',
      network: 'none',
      rootFilesystem: 'read-only',
    },
    gateProof: {
      kind: 'complete-hosted-browser-v1',
      workflowPath: '.github/workflows/protected-execution-promotion-qualification.yml',
      event: 'pull_request_target',
      jobName: 'Publish functional qualification fixture compatibility evidence',
      statusContext: 'atlas-protected-product-qualification',
      statusDescription: 'Protected GitHub-hosted complete qualification functional safety net',
    },
  },
});

export function resolveProtectedPromotionQualification(headRef) {
  if (typeof headRef !== 'string' || headRef.length === 0) {
    throw new TypeError('protected promotion head ref must be non-empty');
  }
  const qualification = PROTECTED_PROMOTION_QUALIFICATIONS[headRef];
  if (!qualification) throw new TypeError(`unsupported protected promotion qualification: ${headRef}`);
  exactDigest(qualification.expectedProductDigest, 'protected promotion product digest');
  return qualification;
}

function exactStableIds(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must contain stable IDs`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicate stable IDs`);
  return [...value].sort();
}

function coordinates(id) {
  const first = id.indexOf('::');
  const second = first < 0 ? -1 : id.indexOf('::', first + 2);
  if (first <= 0 || second <= first + 2 || second >= id.length - 2) throw new TypeError(`stable ID is malformed: ${id}`);
  return { project: id.slice(0, first), spec: id.slice(first + 2, second) };
}

function matchesSpecPattern(pattern, spec) {
  const expression = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*');
  return new RegExp(`^${expression}$`).test(spec);
}

function isSpecialistGroup(group) {
  return group.capabilities.browser
    && !group.capabilities.hosted
    && group.capabilities.dataCapability === 'real_fullworld'
    && group.capabilities.specialistReason === 'real-fullworld-product';
}

function isReviewGroup(group) {
  return group.capabilities.browser
    && !group.capabilities.hosted
    && group.capabilities.dataCapability !== 'real_fullworld'
    && group.capabilities.visualReview === true
    && group.capabilities.specialistReason === 'private-visual';
}

function validateGroup(group, requiredIds) {
  if (!group || typeof group !== 'object' || Array.isArray(group) || typeof group.id !== 'string' || !requiredIds.has(group.id)) {
    throw new TypeError('selected execution group is invalid');
  }
  if (!Array.isArray(group.specs) || !Array.isArray(group.projects) || !group.capabilities || typeof group.capabilities !== 'object') {
    throw new TypeError(`selected execution group ${group.id} is malformed`);
  }
  const capabilities = group.capabilities;
  if (typeof capabilities.browser !== 'boolean' || typeof capabilities.hosted !== 'boolean'
    || typeof capabilities.requiresPublication !== 'boolean' || typeof capabilities.dataCapability !== 'string'
    || typeof capabilities.visualReview !== 'boolean') {
    throw new TypeError(`selected execution group ${group.id} capabilities are malformed`);
  }
  if (!capabilities.browser && group.projects.length) throw new TypeError(`selected execution group ${group.id} browser capability conflicts with projects`);
  if (capabilities.browser && !capabilities.hosted && !isSpecialistGroup(group) && !isReviewGroup(group)) {
    throw new TypeError(`non-hosted browser group ${group.id} must be explicit real_fullworld specialist work or bounded visual review`);
  }
  return group;
}

function groupMatchesStableId(group, id) {
  if (!group.capabilities.browser) return false;
  const { project, spec } = coordinates(id);
  return group.projects.includes(project) && group.specs.some((pattern) => matchesSpecPattern(pattern, spec));
}

function partitionByCandidateAdditions(stableTestIds, candidateAdditionSet) {
  const protectedStableTestIds = stableTestIds.filter((id) => !candidateAdditionSet.has(id));
  const candidateAdditionalStableTestIds = stableTestIds.filter((id) => candidateAdditionSet.has(id));
  return { protectedStableTestIds, candidateAdditionalStableTestIds };
}

function partitionHostedByDataCapability(hostedGroups, hostedStableTestIds, candidateAdditionSet, candidateModificationSet) {
  const stableIdCapability = new Map();
  for (const id of hostedStableTestIds) {
    const capabilities = [...new Set(hostedGroups
      .filter((group) => groupMatchesStableId(group, id))
      .map((group) => group.capabilities.dataCapability))]
      .sort();
    if (capabilities.length !== 1) {
      throw new TypeError(`planned stable ID has ambiguous hosted data capability: ${id}`);
    }
    stableIdCapability.set(id, capabilities[0]);
  }

  return [...new Set(hostedGroups.map((group) => group.capabilities.dataCapability))]
    .sort()
    .map((dataCapability) => {
      const stableTestIds = hostedStableTestIds.filter((id) => stableIdCapability.get(id) === dataCapability);
      const candidateModifiedStableTestIds = stableTestIds.filter((id) => candidateModificationSet.has(id));
      return {
        dataCapability,
        groupIds: hostedGroups.filter((group) => group.capabilities.dataCapability === dataCapability).map((group) => group.id).sort(),
        stableTestIds,
        ...partitionByCandidateAdditions(stableTestIds, candidateAdditionSet),
        ...(candidateModifiedStableTestIds.length ? { candidateModifiedStableTestIds } : {}),
      };
    });
}

export function buildProtectedHostedExecutionContract(plan, { currentHeadSha } = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.schemaVersion !== 3) {
    throw new TypeErroЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€™\]Z\™\И[€ШЪ[XU™\њЪ[Ы€ЙКNВ€B€Y€
[‹ЫЫќ›Ы\ЏЛљYOOH	Ш]\Л\›ЭXЭYZЬЭYXЫЫќ›Ы\‹]ЊЙИ[‹ЫЫќ›Ы\ЏЛќ™\њЪ[Ы€OOHКHВ€›ЭИ™]И\Q\њ›ЬЉ›ЭXЭYЬЭY^XЭ][Ы€ЫЫќ›Ы\€Y[ќ]H\И[ќ[Y	КNВ€B€ЫЫњЭЫЫќ›Ы\”ЫЭ\ЩTЪHH^XЭЪJ[‹ЫЫќ›Ы\‹њЫЭ\ЩTЪK	ШЫЫќ›Ы\€ЫЭ\ЩHТIКNВ€ЫЫњЭШ[™Y]RXYЪHH^XЭЪJ[‹Ш[™Y]RXYЪK	ШШ[™Y]HXYТIКNВ€Y€
^XЭЪJЭ\њ™[ќXYЪK	ШЭ\њ™[ќ€XY	КHOOHШ[™Y]RXYЪJHВ€›ЭИ™]И\Q\њ›ЬЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€Э\њ™[ќ€XY\ИЭ[IКNВ€B€ЫЫњЭ[”Щ[X[ќXСYЩ\ЭH^XЭYЩ\Э
[‹њ[”Щ[X[ќXСYЩ\Э	Ь[€Щ[X[ќXИYЩ\Э	КNВ€ЫЫњЭ[’[њЭ[ЩQYЩ\ЭH^XЭYЩ\Э
[‹њ[’[њЭ[ЩQYЩ\Э	Ь[€[њЭ[ЩHYЩ\Э	КNВ€ЫЫњЭ]]Ьљ]QYЩ\ЭH^XЭYЩ\Э
[‹]]Ьљ]QYЩ\Э	Ь[€]]Ьљ]HYЩ\Э	КNВ€ЫЫњЭ[ќљ\›Ы›Y[ќYЩ\ЭH^XЭYЩ\Э
[‹™[ќљ\›Ы›Y[ќYЩ\Э	Ь[€[ќљ\›Ы›Y[ќYЩ\Э	КNВ€ЫЫњЭ^XЭYЭX›U\ЭYСYЩ\ЭH^XЭYЩ\Э
[‹™^XЭYЭX›U\ЭYСYЩ\Э	Щ^XЭYЭX›KRQYЩ\Э	КNВ€ЫЫњЭ›ЩXЭY[ќ]Y\СYЩ\ЭH^XЭYЩ\Э
[‹њ›ЩXЭY[ќ]Y\СYЩ\Э	Ь›ЩXЭY[ќ]Y\ИYЩ\Э	КNВ€ЫЫњЭЫЬљЩ\”ЫXЮQYЩ\ЭH^XЭYЩ\Э
[‹ќЫЬљЩ\”ЫXЮQYЩ\Э	ЭЫЬљЩ\€ЫXЮHYЩ\Э	КNВ€ЫЫњЭ^XЭ][Ы”ЫXЮQYЩ\ЭH^XЭYЩ\Э
[‹™^XЭ][Ы”ЫXЮQYЩ\Э	Щ^XЭ][Ы€ЫXЮHYЩ\Э	КNВ€Y€
[‹њ™]ћTЫXЮOЛњ™]љY\ИOOH
H›ЭИ™]И\Q\њ›ЬЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€™]љY\И]\Э™H™\›ЙКNВ€Y€
[‹њЩ[XЭ]™Q^XЭ][Ы€OOH[ЩJH›ЭИ™]И\Q\њ›ЬЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€Щ[XЭ]™H^XЭ][Ы€]\Э™[XZ[€\ШX›Y	КNВ€Y€
P\њ^Kљ\Р\њ^J[‹њ™\]Z\™YЬ›Э\YКH™]ИЩ]
[‹њ™\]Z\™YЬ›Э\YКKњЪ^™HOOH[‹њ™\]Z\™YЬ›Э\YЛ›[™Э
HВ€›ЭИ™]И\Q\њ›ЬЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€™\]Z\™YЬ›Э\QИ\™H[ќ[Y	КNВ€B€ЫЫњЭ™\›ХЫЬљИH[‹њ™\]Z\™YЬ›Э\YЛ›[™ЭOOHВ€Y€
™\›ХЫЬљИ	‰€[‹њ›Щљ[HOOH	Ы›Ы™IКHВ€›ЭИ™]И\Q\њ›ЬЉ›ЭXЭYЬЭY^XЭ][Ы€™\›Л]ЫЬљИ[€]\Э™H›Щљ[H›Ы™IКNВ€B€Y€
P\њ^Kљ\Р\њ^J[‹™Ь›Э\КH[‹™Ь›Э\Л›[™ЭOOH[‹њ™\]Z\™YЬ›Э\YЛ›[™Э
HВ€›ЭИ™]И\Q\њ›ЬЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€Щ[XЭYЬ›Э\И]\Э^XЭHX]Ъ™\]Z\™YЬ›Э\QЙКNВ€B‚€ЫЫњЭ™\]Z\™YYИH™]ИЩ]
[‹њ™\]Z\™YЬ›Э\YКNВ€ЫЫњЭЬ›Э\ИH[‹™Ь›Э\Л›X\

Ь›Э\
HO€[Y]QЬ›Э\
Ь›Э\™\]Z\™YYКJNВ€Y€
™]ИЩ]
Ь›Э\Л›X\

Ь›Э\
HO€Ь›Э\љY
JKњЪ^™HOOHЬ›Э\Л›[™Э€Ь›Э\ЛњЫЫYJ
Ь›Э\
HO€\™\]Z\™YYЛљ\КЬ›Э\љY
JB€[‹њ™\]Z\™YЬ›Э\YЛњЫЫYJ
Y
HO€YЬ›Э\ЛњЫЫYJ
Ь›Э\
HO€Ь›Э\љYOOHY
JJHВ€›ЭИ™]И\Q\њ›ЬЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€Щ[XЭYЬ›Э\ИИ›Э^XЭHX]Ъ™\]Z\™YЬ›Э\QЙКNВ€B‚€ЫЫњЭЬЭYЬ›Э\ИHЬ›Э\Л™љ[\Љ
Ь›Э\
HO€Ь›Э\Ш\Xљ[]Y\Лњ›ЭЬЩ\€	‰€Ь›Э\Ш\Xљ[]Y\ЛљЬЭY
NВ€ЫЫњЭЬXЪX[\ЭЬ›Э\ИHЬ›Э\Л™љ[\Љ\ФЬXЪX[\ЭЬ›Э\
NВ€ЫЫњЭ™]љY]СЬ›Э\ИHЬ›Э\Л™љ[\Љ\Ф™]љY]СЬ›Э\
NВ€ЫЫњЭ™\]Z\™\Ф™X[ќ[ЫЬ›HЬXЪX[\ЭЬ›Э\Л›[™Э€В€Y€
›ЫЫX[Љ[‹њ™\]Z\™\Ф™X[ќ[ЫЬ›
HOOH™\]Z\™\Ф™X[ќ[ЫЬ›
HВ€›ЭИ™]И\Q\њ›ЬЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€™X[Щќ[ЫЬ›XЩ[Y[ќЫЫ™›XЭИЪ][‰КNВ€B‚€ЫЫњЭЭX›U\ЭYИH^XЭЭX›RYК[‹њЭX›U\ЭYЛ	Ь[›™YЭX›HQЙЛИ[ЭС[\N€™\›ХЫЬљИJNВ€Y€
™\›ХЫЬљИ	‰€
ЭX›U\ЭYЛ›[™ЭOOH€
[‹Ш[™Y]TЭX›RYY][ЫњИПИЧJK›[™ЭOOH€
[‹Ш[™Y]TЭX›RY[ЩYљXШ][ЫњИПИЧJK›[™ЭOOH€
[‹њ™\]Z\™Y]PШ\Xљ[]Y\ИПИЧJK›[™ЭOOH€›ЫЫX[Љ[‹њ™\]Z\™\Ф™X[ќ[ЫЬ›
JJHВ€›ЭИ™]И\Q\њ›ЬЉ	Ь›ЭXЭYЬЭY^XЭ][Ы€™\›Л]ЫЬљИ[€ЫЫќZ[њИ^XЭ]X›HШ›YШ][ЫњЙКNВ€B€ЫЫњЭЭX›U\ЭYЩ]H™]ИЩ]
ЭX›U\ЭYКNВ€ЫЫњЭШ[™Y]TЭX›RYY][ЫњИH^XЭЭX›RYК[‹Ш[™Y]TЭX›RYY][ЫњИПИЧK	ШШ[™Y]HЭX›KRQY][ЫњЙЛИ[ЭС[\N€ќYHJNВ€ЫЫњЭШ[™Y]TЭX›RY[ЩYљXШ][ЫњИH^XЭЭX›RYК[‹Ш[™Y]TЭX›RY[ЩYљXШ][ЫњИПИЧK	ШШ[™Y]HЭX›KRQ[ЩYљXШ][ЫњЙЛИ[ЭС[\N€ќYHJNВ€›Ь€
ЫЫњЭYЩ€Ш[™Y]TЭX›RYY][ЫњКHВ€Y€
\ЭX›U\ЭYЩ]љ\КY
JH›ЭИ™]И\Q\њ›ЬЉШ[™Y]HЭX›KRQY][Ы€\И›Э[€H^XЭ[›™YЩ[њЭ\О€	ЪYX
NВ€B€ЫЫњЭШ[™Y]PY][Ы”Щ]H™]ИЩ]
Ш[™Y]TЭX›RYY][ЫњКNВ€›Ь€
ЫЫњЭYЩ€Ш[™Y]TЭX›RY[ЩYљXШ][ЫњКHВ€Y€
\ЭX›U\ЭYЩ]љ\КY
JH›ЭИ™]И\Q\њ›ЬЉШ[™Y]HЭX›KRQ[ЩYљXШ][Ы€\И›Э[€H^XЭ[›™YЩ[њЭ\О€	ЪYX
NВ€Y€
Ш[™Y]PY][Ы”Щ]љ\КY
JH›ЭИ™]И\Q\њ›ЬЉШ[™Y]HЭX›KRQ[ЩYљXШ][Ы€Ш[››Э[ЫИ™H[€Y][ЫЋ€	ЪYX
NВ€B€ЫЫњЭШ[™Y]S[ЩYљXШ][Ы”Щ]H™]ИЩ]
Ш[™Y]TЭX›RY[ЩYљXШ][ЫњКNВ‚€ЫЫњЭЬЭYЭX›U\ЭYИHЧNВ€ЫЫњЭЬXЪX[\ЭЭX›U\ЭYИHЧNВ€ЫЫњЭ™]љY]ФЭX›U\ЭYИHЧNВ€›Ь€
ЫЫњЭYЩ€ЭX›U\ЭYКHВ€ЫЫњЭXЩ[Y[ќИH™]ИЩ]

NВ€Y€
ЬЭYЬ›Э\ЛњЫЫYJ
Ь›Э\
HO€Ь›Э\X]Ъ\ФЭX›RY
Ь›Э\Y
JJHXЩ[Y[ќЛY
	ЪЬЭY	КNВ€Y€
ЬXЪX[\ЭЬ›Э\ЛњЫЫYJ
Ь›Э\
HO€Ь›Э\X]Ъ\ФЭX›RY
Ь›Э\Y
JJHXЩ[Y[ќЛY
	ЬЬXЪX[\Э	КNВ€Y€
™]љY]СЬ›Э\ЛњЫЫYJ
Ь›Э\
HO€Ь›Э\X]Ъ\ФЭX›RY
Ь›Э\Y
JJH™]љY]ФЭX›U\ЭYЛњ\Ъ
Y
NВ€Y€
XЩ[Y[ќЛњЪ^™HOOH
H›ЭИ™]И\Q\њ›ЬЉ[›™YЭX›HQ\И›ИЩ[XЭYXXЪ[™H^XЭ][Ы€XЩ[Y[ќ€	ЪYX
NВ€Y€
XЩ[Y[ќЛњЪ^™HOOHJH›ЭИ™]И\Q\њ›ЬЉ[›™YЭX›HQ\И[XљYЭ[Э\ИXXЪ[™H^XЭ][Ы€XЩ[Y[ќ€	ЪYX
NВ€Y€
XЩ[Y[ќЛљ\К	ЪЬЭY	КJHЬЭYЭX›U\ЭYЛњ\Ъ
Y
NВ€[ЩHЬXЪX[\ЭЭX›U\ЭYЛњ\Ъ
Y
NВ€B‚€ЬЭYЭX›U\ЭYЛњЫЬќ

NВ€ЬXЪX[\ЭЭX›U\ЭYЛњЫЬќ

NВ€™]љY]ФЭX›U\ЭYЛњЫЬќ

NВ€ЫЫњЭЬЭYЩ]H™]ИЩ]
ЬЭYЭX›U\ЭYКNВ€ЫЫњЭЬXЪX[\ЭЩ]H™]ИЩ]
ЬXЪX[\ЭЭX›U\ЭYКNВ€ЫЫњЭЬЭYШ[™Y]S[ЩYљYYЭX›U\ЭYИHШ[™Y]TЭX›RY[ЩYљXШ][ЫњЛ™љ[\Љ
Y
HO€ЬЭYЩ]љ\КY
JNВ€ЫЫњЭЬXЪX[\ЭШ[™Y]S[ЩYљYYЭX›U\ЭYИHШ[™Y]TЭX›RY[ЩYљXШ][ЫњЛ™љ[\Љ
Y
HO€ЬXЪX[\ЭЩ]љ\КY
JNВ€ЫЫњЭЬЭY^XЭYЭX›U\ЭYСYЩ\ЭHYЩ\Э
ЬЭYЭX›U\ЭYКNВ€ЫЫњЭЬXЪX[\Э^XЭYЭX›U\ЭYСYЩ\ЭHYЩ\Э
ЬXЪX[\ЭЭX›U\ЭYКNВ€ЫЫњЭЬЭYЫЭ\ЩT\ќ][Ы€H\ќ][ЫђћPШ[™Y]PY][ЫњКЬЭYЭX›U\ЭYЛШ[™Y]PY][Ы”Щ]
NВ€ЫЫњЭЬXЪX[\ЭЫЭ\ЩT\ќ][Ы€H\ќ][ЫђћPШ[™Y]PY][ЫњКЬXЪX[\ЭЭX›U\ЭYЛШ[™Y]PY][Ы”Щ]
NВ€ЫЫњЭЬЭY\ќ][ЫњИH\ќ][Ы’ЬЭYћQ]PШ\Xљ[]JЬЭYЬ›Э\ЛЬЭYЭX›U\ЭYЛШ[™Y]PY][Ы”Щ]Ш[™Y]S[ЩYљXШ][Ы”Щ]
NВ‚€™]\›€њ™Y^™JВ€ШЪ[XU™\њЪ[ЫЋ€‹€ЫЫќ›Ы\”ЫЭ\ЩTЪK€Ш[™Y]RXYЪK€[”Щ[X[ќXСYЩ\Э€[’[њЭ[ЩQYЩ\Э€]]Ьљ]QYЩ\Э€[ќљ\›Ы›Y[ќYЩ\Э€^XЭYЭX›U\ЭYСYЩ\Э€ЬЭY^XЭYЭX›U\ЭYСYЩ\Э€ЬXЪX[\Э^XЭYЭX›U\ЭYСYЩ\Э€›ЩXЭY[ќ]Y\СYЩ\Э€ЫЬљЩ\”ЫXЮQYЩ\Э€^XЭ][Ы”ЫXЮQYЩ\Э€™]љY\О€€Щ[XЭ]™Q^XЭ][ЫЋ€[ЩK€ЬЭY€В€Ь›Э\YО€ЬЭYЬ›Э\Л›X\

Ь›Э\
HO€Ь›Э\љY
KњЫЬќ

K€ЭX›U\ЭYО€ЬЭYЭX›U\ЭYЛ€‹‹љЬЭYЫЭ\ЩT\ќ][Ы‹€Ш[™Y]S[ЩYљYYЭX›U\ЭYО€ЬЭYШ[™Y]S[ЩYљYYЭX›U\ЭYЛ€\ќ][ЫњО€ЬЭY\ќ][ЫњЛ€K€ЬXЪX[\Э€В€Ь›Э\YО€ЬXЪX[\ЭЬ›Э\Л›X\

Ь›Э\
HO€Ь›Э\љY
KњЫЬќ

K€ЭX›U\ЭYО€ЬXЪX[\ЭЭX›U\ЭYЛ€‹‹њЬXЪX[\ЭЫЭ\ЩT\ќ][Ы‹€Ш[™Y]S[ЩYљYYЭX›U\ЭYО€ЬXЪX[\ЭШ[™Y]S[ЩYљYYЭX›U\ЭYЛ€K€™]љY]О€В€Ь›Э\YО€™]љY]СЬ›Э\Л›X\

Ь›Э\
HO€Ь›Э\љY
KњЫЬќ

K€ЭX›U\ЭYО€™]љY]ФЭX›U\ЭYЛ€K€JNВџB