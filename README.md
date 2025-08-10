Architecture Overview

You’re basically adding a Test Identity Manager into the runner’s collection phase:

    1.	Collect tests (Vitest/Jest/pytest style) into an in-memory list.

    2.	Derive a test “fingerprint” from its body, not its path/name.

    3.	Match fingerprints against a persistent registry.

    4.	Assign a persistent UUID to each test.

    5.	Emit results keyed by UUID to CI analytics.

⸻

Step-by-step Implementation

1. Persistent Registry

Keep a JSON file or SQLite DB in the repo root:

// .test-ids.json

{

"bb3a7f34-8a1c-4e4b-94f0-3b6349cbcb5a": {

    "hash": "7e32a88d…",

    "lastNodeId": "src/tests/checkout.test.js::checkout_flow"

}

}

The key is your UUID.

The hash is the stable fingerprint (see below).

The lastNodeId is for human debugging.

⸻

2. Fingerprinting a Test

You don’t want just a raw source code hash — that breaks too easily.

Instead:

    •	Parse the source into an AST.

    •	Extract only the body of the test callback.

    •	Remove:

    •	Comments

    •	Whitespace

    •	Non-semantic renames (like function name changes)

    •	Serialize back to a normalized minimal form.

    •	Hash it (SHA1 or SHA256).

Example in pseudo-code:

import { parse } from 'acorn';

import { createHash } from 'crypto';

function fingerprintTest(testSource) {

const ast = parse(testSource, { ecmaVersion: 'latest', sourceType: 'module' });

const testFnNode = findTestFunction(ast); // your own logic

const bodyAst = testFnNode.body;

const normalized = normalizeAst(bodyAst);

return createHash('sha1').update(JSON.stringify(normalized)).digest('hex');

}

⸻

3. Matching Old Tests to New Tests

During collection:

function assignUuidToTest(test, registry) {

const hash = fingerprintTest(test.source);

const entry = registry.findByHash(hash);

if (entry) {

    return entry.uuid;

} else {

    const uuid = crypto.randomUUID();

    registry.add({ uuid, hash, lastNodeId: test.nodeid });

    return uuid;

}

}

If you want tolerant matching:

    •	For each unmatched hash, compare to existing hashes with AST similarity (e.g., Levenshtein distance of normalized AST strings).

    •	If similarity > threshold (say 85%), treat it as a match and update the registry.

⸻

4. Integration into a Vitest-like Runner

You hook into the test collection phase before execution:

runner.on('collect', (tests) => {

const registry = loadRegistry();

for (const test of tests) {

    test.uuid = assignUuidToTest(test, registry);

}

saveRegistry(registry);

});

When you emit results to reporters or CI:

reporter.onTestResult = (test) => {

ciEmitter.send({

    uuid: test.uuid,

    status: test.status,

    duration: test.duration

});

};

⸻

5. Benefits

   • Rename-proof: changing "checkout flow" to "happy checkout path" won’t break history.

   • Move-proof: file path changes don’t matter.

   • Analytics-ready: CI can now track flakiness by UUID.

   • Debuggable: still store the last known nodeid in the registry so humans can find it.

⸻

6. Optional Enhancements

   • Add branch-awareness so a UUID tracks across feature branches.

   • Store version history in registry for when a test’s body changes significantly.

   • Build a CLI:

myrunner test-id status bb3a7f34

# → Flaky (3/10 failures in last 14 days)
