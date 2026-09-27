const { execFileSync, spawnSync } = require("node:child_process");
const { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const getReleaseContext = ({ expectedSha, mainSha, pullRequests }) => {
	if (!/^[0-9a-f]{40}$/.test(expectedSha || "")) {
		throw new Error("Expected a full commit SHA");
	}
	const merged = pullRequests.filter(
		(pr) => pr.base.ref === "main" && pr.merge_commit_sha === expectedSha && pr.merged_at,
	);
	const hasLabel = (name) => merged.some((pr) => pr.labels.some((label) => label.name === name));
	const pending = hasLabel("autorelease: pending");
	return {
		"update-pr": mainSha === expectedSha,
		"create-release": pending,
		"release-context": pending || hasLabel("autorelease: tagged"),
	};
};

const validateRelease = ({ version, manifestVersion, headSha, tagSha, expectedSha, release }) => {
	if (!/^\d+\.\d+\.\d+$/.test(version) || version !== manifestVersion) {
		throw new Error("package.json must contain a stable version matching the release manifest");
	}
	if (!/^[0-9a-f]{40}$/.test(expectedSha) || headSha !== expectedSha || tagSha !== expectedSha) {
		throw new Error("Release tag must point to the exact commit that passed CI");
	}
	if (release.tagName !== version || release.isDraft || release.isPrerelease) {
		throw new Error("Expected a published stable GitHub Release matching package.json");
	}
};

const getPublication = (result) => {
	if (result.status !== 0) {
		if (/manifest unknown|name unknown|not found/i.test(result.stderr || "")) {
			return { publish: true };
		}
		throw new Error(
			`Cannot determine whether release image exists: ${result.stderr || result.error || "unknown error"}`,
		);
	}
	const manifest = JSON.parse(result.stdout);
	const platforms = new Set(
		(manifest.manifests || []).map((entry) => `${entry.platform?.os}/${entry.platform?.architecture}`),
	);
	if (!platforms.has("linux/amd64") || !platforms.has("linux/arm64")) {
		throw new Error("Existing release image must include linux/amd64 and linux/arm64");
	}
	if (!/^sha256:[0-9a-f]{64}$/.test(manifest.digest || "")) {
		throw new Error("Registry returned an invalid image digest");
	}
	return { publish: false, digest: manifest.digest };
};

const containerNotes = (body, imageRef) => {
	const text = body.replace(/<!-- container-image:start -->[\s\S]*?<!-- container-image:end -->\s*/g, "").trimEnd();
	return `${text}\n\n<!-- container-image:start -->\n## Container image\n\n\`${imageRef}\`\n<!-- container-image:end -->\n`;
};

const main = () => {
	const repository = process.env.GITHUB_REPOSITORY;
	if (!repository || !process.env.GITHUB_OUTPUT) {
		throw new Error("GITHUB_REPOSITORY and GITHUB_OUTPUT must be set");
	}
	const version = JSON.parse(readFileSync("package.json", "utf8")).version;
	if (!/^\d+\.\d+\.\d+$/.test(version)) {
		throw new Error("Expected a stable package version");
	}
	const image = `ghcr.io/${repository.toLowerCase()}`;
	const run = (command, args) => execFileSync(command, args, { encoding: "utf8" }).trim();
	const output = (values) => {
		for (const [key, value] of Object.entries(values)) {
			appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
		}
	};

	switch (process.argv[2]) {
		case "context": {
			const expectedSha = process.env.EXPECTED_SHA;
			if (!/^[0-9a-f]{40}$/.test(expectedSha || "")) {
				throw new Error("EXPECTED_SHA must be a full commit SHA");
			}
			const mainSha = JSON.parse(run("gh", ["api", `repos/${repository}/git/ref/heads/main`])).object.sha;
			const pages = JSON.parse(
				run("gh", ["api", `repos/${repository}/commits/${expectedSha}/pulls`, "--paginate", "--slurp"]),
			);
			output(getReleaseContext({ expectedSha, mainSha, pullRequests: pages.flat() }));
			break;
		}
		case "verify": {
			const release = JSON.parse(
				run("gh", ["release", "view", version, "--repo", repository, "--json", "tagName,isDraft,isPrerelease"]),
			);
			validateRelease({
				version,
				manifestVersion: JSON.parse(readFileSync(".release-please-manifest.json", "utf8"))["."],
				headSha: run("git", ["rev-parse", "HEAD"]),
				tagSha: run("git", ["rev-parse", `refs/tags/${version}^{commit}`]),
				expectedSha: process.env.EXPECTED_SHA,
				release,
			});
			output({ tag_name: version });
			break;
		}
		case "publication": {
			const result = spawnSync(
				"docker",
				["buildx", "imagetools", "inspect", `${image}:${version}`, "--format", "{{json .Manifest}}"],
				{ encoding: "utf8" },
			);
			output(getPublication(result));
			break;
		}
		case "document": {
			const digest = process.env.IMAGE_DIGEST;
			if (!/^sha256:[0-9a-f]{64}$/.test(digest || "")) {
				throw new Error("IMAGE_DIGEST must be a valid SHA-256 image digest");
			}
			// Recheck latest immediately before promotion, including on retries.
			const latest = JSON.parse(run("gh", ["api", `repos/${repository}/releases/latest`])).tag_name;
			if (latest === version) {
				run("docker", ["buildx", "imagetools", "create", "--tag", `${image}:latest`, `${image}@${digest}`]);
			}
			const body =
				JSON.parse(run("gh", ["release", "view", version, "--repo", repository, "--json", "body"])).body || "";
			const directory = mkdtempSync(join(tmpdir(), "tskr-release-"));
			try {
				const path = join(directory, "notes.md");
				writeFileSync(path, containerNotes(body, `${image}:${version}@${digest}`));
				run("gh", ["release", "edit", version, "--repo", repository, "--notes-file", path]);
			} finally {
				rmSync(directory, { recursive: true, force: true });
			}
			break;
		}
		default:
			throw new Error("Usage: node scripts/ci/release-container.cjs context|verify|publication|document");
	}
};

module.exports = { getReleaseContext, validateRelease, getPublication, containerNotes };

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
