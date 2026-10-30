const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { test } = require("node:test");
const {
	getReleaseContext,
	validateRelease,
	getPublication,
	containerNotes,
} = require("../scripts/ci/release-container.cjs");

const sha = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;
const validRelease = {
	version: "1.3.0",
	manifestVersion: "1.3.0",
	headSha: sha,
	tagSha: sha,
	expectedSha: sha,
	release: { tagName: "1.3.0", isDraft: false, isPrerelease: false },
};

test("documenting an older release repairs notes without rolling back latest", () => {
	const directory = mkdtempSync(join(tmpdir(), "tskr-release-test-"));
	const script = resolve("scripts/ci/release-container.cjs");
	try {
		writeFileSync(join(directory, "package.json"), JSON.stringify({ version: "1.3.0" }));
		const stub = `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require('node:fs');
const { basename } = require('node:path');
const args = process.argv.slice(2);
const command = basename(process.argv[1]);
appendFileSync(process.env.CALLS_FILE, JSON.stringify({ command, args }) + '\\n');
if (command === 'gh' && args[0] === 'api') {
  process.stdout.write(JSON.stringify({ tag_name: process.env.LATEST_VERSION }));
} else if (command === 'gh' && args[1] === 'view') {
  process.stdout.write(JSON.stringify({ body: '## Features\\n\\nExisting changelog' }));
} else if (command === 'gh' && args[1] === 'edit') {
  appendFileSync(process.env.CALLS_FILE, JSON.stringify({ notes: readFileSync(args.at(-1), 'utf8') }) + '\\n');
}
`;
		for (const command of ["gh", "docker"]) {
			writeFileSync(join(directory, command), stub, { mode: 0o755 });
		}
		for (const latestVersion of ["1.3.0", "1.4.0"]) {
			const callsFile = join(directory, "calls");
			writeFileSync(callsFile, "");
			const result = spawnSync(process.execPath, [script, "document"], {
				cwd: directory,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${directory}:${process.env.PATH}`,
					GITHUB_REPOSITORY: "jonocairns/tskr",
					GITHUB_OUTPUT: join(directory, "output"),
					IMAGE_DIGEST: digest,
					LATEST_VERSION: latestVersion,
					CALLS_FILE: callsFile,
				},
			});
			assert.equal(result.status, 0, result.stderr);
			const calls = readFileSync(callsFile, "utf8").trim().split("\n").map(JSON.parse);
			const promotions = calls.filter((call) => call.command === "docker");
			assert.equal(promotions.length, latestVersion === "1.3.0" ? 1 : 0);
			if (promotions.length) {
				assert.deepEqual(promotions[0].args.slice(-3), [
					"--tag",
					"ghcr.io/jonocairns/tskr:latest",
					`ghcr.io/jonocairns/tskr@${digest}`,
				]);
			}
			const notes = calls.find((call) => call.notes).notes;
			assert.ok(notes.includes("Existing changelog"));
			assert.ok(notes.includes(`ghcr.io/jonocairns/tskr:1.3.0@${digest}`));
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publication requires the stable release, manifest and tested commit to agree", () => {
	assert.doesNotThrow(() => validateRelease(validRelease));
	for (const invalid of [
		{ manifestVersion: "1.2.0" },
		{ version: "1.3.0-rc.1" },
		{ tagSha: "c".repeat(40) },
		{ headSha: "c".repeat(40) },
		{ expectedSha: undefined },
		{ release: { ...validRelease.release, isDraft: true } },
		{ release: { ...validRelease.release, isPrerelease: true } },
		{ release: { ...validRelease.release, tagName: "1.2.0" } },
	]) {
		assert.throws(() => validateRelease({ ...validRelease, ...invalid }));
	}
});

test("retries reuse a complete multi-architecture image and fail closed on registry errors", () => {
	const manifest = {
		digest,
		manifests: [
			{ platform: { os: "linux", architecture: "amd64" } },
			{ platform: { os: "linux", architecture: "arm64" } },
		],
	};
	const result = (value) => ({ status: 0, stdout: JSON.stringify(value) });
	assert.deepEqual(getPublication(result(manifest)), { publish: false, digest });
	assert.deepEqual(getPublication({ status: 1, stderr: "manifest unknown" }), { publish: true });
	assert.throws(() => getPublication({ status: 1, stderr: "unauthorized" }));
	assert.throws(() => getPublication({ status: 1, stderr: "connection timed out" }));
	assert.throws(() => getPublication(result({ ...manifest, manifests: manifest.manifests.slice(0, 1) })));
	assert.throws(() => getPublication(result({ ...manifest, digest: "invalid" })));
});

test("release notes preserve the changelog and replace the container block on retries", () => {
	const body = "## Features\n\n* Household improvements\n";
	const imageRef = `ghcr.io/jonocairns/tskr:1.3.0@${digest}`;
	const notes = containerNotes(body, imageRef);
	assert.ok(notes.startsWith(body.trimEnd()));
	assert.ok(notes.includes(imageRef));
	assert.equal(containerNotes(notes, imageRef), notes);
	assert.ok(!containerNotes(notes, "new-image").includes(imageRef));
});

test("release context only accepts the exact merged release PR and recovers tagged releases", () => {
	const releasePr = {
		base: { ref: "main" },
		merge_commit_sha: sha,
		merged_at: "2026-09-27T00:00:00Z",
		labels: [{ name: "autorelease: pending" }],
	};
	const context = (pullRequests, mainSha = sha, expectedSha = sha) =>
		getReleaseContext({ expectedSha, mainSha, pullRequests });
	assert.deepEqual(context([releasePr]), {
		"update-pr": true,
		"create-release": true,
		"release-context": true,
	});
	assert.deepEqual(context([{ ...releasePr, labels: [{ name: "autorelease: tagged" }] }]), {
		"update-pr": true,
		"create-release": false,
		"release-context": true,
	});
	for (const prs of [
		[],
		[{ ...releasePr, merge_commit_sha: "c".repeat(40) }],
		[{ ...releasePr, base: { ref: "dev" } }],
		[{ ...releasePr, merged_at: null }],
		[{ ...releasePr, labels: [] }],
	]) {
		assert.deepEqual(context(prs), {
			"update-pr": true,
			"create-release": false,
			"release-context": false,
		});
	}
	assert.equal(context([], "c".repeat(40))["update-pr"], false);
	assert.equal(context([releasePr], "c".repeat(40))["release-context"], true);
	assert.throws(() => context([], sha, "invalid"));
});
