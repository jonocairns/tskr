const { spawnSync } = require("node:child_process");
const readline = require("node:readline");

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
};

const colorsEnabled = process.stdout.isTTY && process.env.NO_COLOR !== "1";
const withColor = (text, color) => (colorsEnabled ? `${color}${text}${colors.reset}` : text);

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const skipCheck = args.includes("--no-check");
const shouldPush = args.includes("--push");
const skipPrompt = args.includes("--yes") || isDryRun;

const getOptionValue = (option) => {
	const index = args.indexOf(option);
	if (index === -1 || index === args.length - 1) {
		return null;
	}
	return args[index + 1];
};

const requestedVersion = getOptionValue("--version");
const bumpType = args.find((value) => ["patch", "minor", "major"].includes(value)) ?? null;
const hasLegacyModeFlag = args.includes("--prepare") || args.includes("--publish");

const usage = () => {
	console.log("Usage:");
	console.log("  pnpm release patch|minor|major [--dry-run] [--no-check] [--push] [--yes]");
	console.log("  pnpm release --version <x.y.z> [--dry-run] [--no-check] [--push] [--yes]");
	process.exit(1);
};

if (hasLegacyModeFlag) {
	console.error(withColor("Legacy --prepare/--publish modes were removed. Use pnpm release ...", colors.red));
	process.exit(1);
}

if (!requestedVersion && !bumpType) {
	usage();
}

if (requestedVersion && bumpType) {
	console.error(withColor("Provide either bump type or --version, not both.", colors.red));
	process.exit(1);
}

const run = (command) => {
	if (isDryRun) {
		console.log(`${withColor("[dry-run]", colors.cyan)} ${command}`);
		return;
	}

	const result = spawnSync(command, {
		shell: true,
		encoding: "utf8",
		stdio: "inherit",
	});

	if (result.status !== 0) {
		throw new Error(`Command failed: ${command}`);
	}
};

const runCaptured = (command) => {
	const result = spawnSync(command, {
		shell: true,
		encoding: "utf8",
		stdio: ["inherit", "pipe", "pipe"],
	});

	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
		throw new Error(output.length > 0 ? output : `Command failed: ${command}`);
	}

	return result.stdout.trim();
};

const hasOriginRemote = () => {
	const result = spawnSync("git remote get-url origin", {
		shell: true,
		encoding: "utf8",
		stdio: ["inherit", "pipe", "pipe"],
	});
	return result.status === 0;
};

const getStatusLines = () => {
	const status = runCaptured("git status --porcelain");
	if (status.length === 0) {
		return [];
	}
	return status.split("\n").filter((line) => line.trim().length > 0);
};

const formatStatusLines = (lines) => lines.map((line) => line.trim()).join("\n");

const parseVersionTag = (tag) => {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
	if (!match) {
		return null;
	}

	return {
		raw: tag.trim(),
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
};

const compareVersions = (a, b) => {
	if (a.major !== b.major) {
		return a.major - b.major;
	}
	if (a.minor !== b.minor) {
		return a.minor - b.minor;
	}
	return a.patch - b.patch;
};

const versionToString = (version) => `${version.major}.${version.minor}.${version.patch}`;

const getLatestReleaseVersion = () => {
	const rawTags = runCaptured("git tag --list");
	if (rawTags.length === 0) {
		return null;
	}

	const versions = rawTags
		.split("\n")
		.map((tag) => parseVersionTag(tag))
		.filter((tag) => tag !== null)
		.sort(compareVersions);

	return versions.length > 0 ? versions[versions.length - 1] : null;
};

const bumpVersion = (version, type) => {
	if (type === "major") {
		return { major: version.major + 1, minor: 0, patch: 0 };
	}
	if (type === "minor") {
		return { major: version.major, minor: version.minor + 1, patch: 0 };
	}
	return { major: version.major, minor: version.minor, patch: version.patch + 1 };
};

const parseAndValidateVersion = (candidateVersion, latestVersion) => {
	const parsedVersion = parseVersionTag(candidateVersion);
	if (!parsedVersion) {
		throw new Error(`Invalid version: ${candidateVersion}. Expected x.y.z`);
	}
	if (compareVersions(parsedVersion, latestVersion) <= 0) {
		throw new Error(`Version ${parsedVersion.raw} must be greater than latest tag ${latestVersion.raw}`);
	}
	return parsedVersion;
};

const getPendingCount = (fromTag, toRef) => {
	const range = fromTag === "0.0.0" ? toRef : `${fromTag}..${toRef}`;
	const pendingCountRaw = runCaptured(`git rev-list --count ${range}`);
	return Number(pendingCountRaw);
};

const confirm = (question) =>
	new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
		});
	});

const release = async () => {
	console.log(withColor("tskr release", colors.bold));
	if (isDryRun) {
		console.log(withColor("Mode: dry-run", colors.dim));
	}

	const currentBranch = runCaptured("git rev-parse --abbrev-ref HEAD");
	if (currentBranch !== "main" && !isDryRun) {
		throw new Error(`Release must run from main branch. Current branch: ${currentBranch}`);
	}
	if (currentBranch !== "main" && isDryRun) {
		console.log(withColor(`Warning: running dry-run on branch ${currentBranch}`, colors.yellow));
	}

	const statusLines = getStatusLines();
	if (statusLines.length > 0 && !isDryRun) {
		throw new Error(`Working tree is not clean. Commit or stash changes first.\n\n${formatStatusLines(statusLines)}`);
	}
	if (statusLines.length > 0 && isDryRun) {
		console.log(withColor("Warning: working tree is not clean (allowed in dry-run).", colors.yellow));
	}

	if (!hasOriginRemote()) {
		throw new Error("No origin remote configured.");
	}

	run("git fetch origin main --tags");

	const latestVersion = getLatestReleaseVersion() ?? { major: 0, minor: 0, patch: 0, raw: "0.0.0" };
	const nextVersion = requestedVersion
		? parseAndValidateVersion(requestedVersion, latestVersion)
		: bumpVersion(latestVersion, bumpType);
	const nextVersionString = versionToString(nextVersion);

	console.log(`${withColor("Latest tag:", colors.dim)} ${latestVersion.raw}`);
	console.log(`${withColor("Next release:", colors.dim)} ${withColor(nextVersionString, colors.green)}`);

	const pendingCount = getPendingCount(latestVersion.raw, "HEAD");
	console.log(`${withColor("Unreleased commits:", colors.dim)} ${pendingCount}`);
	if (pendingCount === 0) {
		throw new Error(`No commits since latest tag ${latestVersion.raw}`);
	}

	if (!skipPrompt) {
		const accepted = await confirm(`Continue with release ${nextVersionString}? [y/N] `);
		if (!accepted) {
			console.log("Release cancelled.");
			process.exit(0);
		}
	}

	if (!skipCheck) {
		run("pnpm check");
	}

	if (!isDryRun) {
		const postCheckStatusLines = getStatusLines();
		if (postCheckStatusLines.length > 0) {
			throw new Error(`Release aborted: checks changed working tree.\n\n${formatStatusLines(postCheckStatusLines)}`);
		}

		const headSha = runCaptured("git rev-parse HEAD");
		const originMainSha = runCaptured("git rev-parse origin/main");
		if (headSha !== originMainSha) {
			throw new Error("Local main is not synced with origin/main. Pull/rebase main before releasing.");
		}
	}

	run(`git tag -a ${nextVersionString} -m "Release ${nextVersionString}"`);

	if (shouldPush) {
		run(`git push origin ${nextVersionString}`);
	}

	console.log(withColor(`Release ${nextVersionString} created.`, colors.green));
	if (!shouldPush) {
		console.log(withColor("Tag is local only. Use --push to trigger deployment.", colors.yellow));
	}
};

release().catch((error) => {
	console.error(withColor("release failed", colors.red));
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
