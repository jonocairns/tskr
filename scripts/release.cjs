const { spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
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
const isPrepareMode = args.includes("--prepare");
const isPublishMode = args.includes("--publish");

const getOptionValue = (option) => {
	const index = args.indexOf(option);
	if (index === -1 || index === args.length - 1) {
		return null;
	}
	return args[index + 1];
};

const requestedVersion = getOptionValue("--version");
const bumpType = args.find((value) => ["patch", "minor", "major"].includes(value)) ?? null;

const usage = () => {
	console.log("Usage:");
	console.log("  pnpm release patch|minor|major [--dry-run] [--no-check] [--push] [--yes]");
	console.log("  pnpm release --version <x.y.z> [--dry-run] [--no-check] [--push] [--yes]");
	console.log("  pnpm release patch|minor|major --prepare [--dry-run] [--no-check] [--push] [--yes]");
	console.log("  pnpm release --version <x.y.z> --prepare [--dry-run] [--no-check] [--push] [--yes]");
	console.log("  pnpm release --publish [--version <x.y.z>] [--dry-run] [--push] [--yes]");
	process.exit(1);
};

if (isPrepareMode && isPublishMode) {
	console.error(withColor("Use either --prepare or --publish, not both.", colors.red));
	process.exit(1);
}

if (!isPublishMode && !requestedVersion && !bumpType) {
	usage();
}

if (requestedVersion && bumpType) {
	console.error(withColor("Provide either bump type or --version, not both.", colors.red));
	process.exit(1);
}

if (isPublishMode && bumpType) {
	console.error(
		withColor("--publish does not support patch/minor/major. Use --version or package.json version.", colors.red),
	);
	process.exit(1);
}

const run = (command, options = {}) => {
	if (isDryRun) {
		console.log(`${withColor("[dry-run]", colors.cyan)} ${command}`);
		return "";
	}

	const result = spawnSync(command, {
		shell: true,
		encoding: "utf8",
		stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit",
	});

	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
		throw new Error(output.length > 0 ? output : `Command failed: ${command}`);
	}

	return options.capture ? result.stdout.trim() : "";
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

const getStatusLines = () => {
	const status = runCaptured("git status --porcelain");
	if (status.length === 0) {
		return [];
	}
	return status.split("\n").filter((line) => line.trim().length > 0);
};

const formatStatusLines = (lines) => lines.map((line) => line.trim()).join("\n");

const getLinePath = (line) => {
	const normalized = line.trimStart();
	const rawPath =
		normalized.length > 3 && normalized[2] === " "
			? normalized.slice(3).trim()
			: normalized.split(/\s+/).slice(1).join(" ").trim();
	if (rawPath.includes(" -> ")) {
		return rawPath.split(" -> ").at(-1)?.trim() ?? rawPath;
	}
	return rawPath;
};

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
	const mode = isPublishMode ? "publish" : isPrepareMode ? "prepare" : "full";
	if (mode !== "full") {
		console.log(`${withColor("Release mode:", colors.dim)} ${mode}`);
	}

	const currentBranch = runCaptured("git rev-parse --abbrev-ref HEAD");
	if ((mode === "full" || mode === "publish") && currentBranch !== "main" && !isDryRun) {
		throw new Error(`Release mode "${mode}" must run from main branch. Current branch: ${currentBranch}`);
	}
	if ((mode === "full" || mode === "publish") && currentBranch !== "main" && isDryRun) {
		console.log(withColor(`Warning: running ${mode} dry-run on branch ${currentBranch}`, colors.yellow));
	}
	if (mode === "prepare" && currentBranch === "main") {
		console.log(withColor("Warning: prepare mode on main may not be pushable on protected branches.", colors.yellow));
	}

	const statusLines = getStatusLines();
	if (statusLines.length > 0 && !isDryRun) {
		const dirtyFiles = formatStatusLines(statusLines);
		throw new Error(`Working tree is not clean. Commit or stash changes first.\n\n${dirtyFiles}`);
	}
	if (statusLines.length > 0 && isDryRun) {
		console.log(withColor("Warning: working tree is not clean (allowed in dry-run).", colors.yellow));
	}

	const latestVersion = getLatestReleaseVersion() ?? { major: 0, minor: 0, patch: 0, raw: "0.0.0" };
	const packageJsonPath = path.resolve(process.cwd(), "package.json");
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

	let nextVersionString;
	if (mode === "publish") {
		const publishVersion = requestedVersion ?? packageJson.version;
		const parsedPublishVersion = parseVersionTag(publishVersion);
		if (!parsedPublishVersion) {
			throw new Error(`Invalid publish version: ${publishVersion}. Expected x.y.z`);
		}
		if (compareVersions(parsedPublishVersion, latestVersion) <= 0) {
			throw new Error(`Version ${parsedPublishVersion.raw} must be greater than latest tag ${latestVersion.raw}`);
		}
		if (requestedVersion && packageJson.version !== requestedVersion && !isDryRun) {
			throw new Error(
				`package.json version (${packageJson.version}) does not match requested publish version (${requestedVersion}).`,
			);
		}
		nextVersionString = versionToString(parsedPublishVersion);
	} else {
		let nextVersion;
		if (requestedVersion) {
			const parsed = parseVersionTag(requestedVersion);
			if (!parsed) {
				throw new Error(`Invalid version format: ${requestedVersion}. Expected x.y.z`);
			}
			if (compareVersions(parsed, latestVersion) <= 0) {
				throw new Error(`Version ${parsed.raw} must be greater than latest tag ${latestVersion.raw}`);
			}
			nextVersion = parsed;
		} else {
			nextVersion = bumpVersion(latestVersion, bumpType);
		}
		nextVersionString = versionToString(nextVersion);
	}

	console.log(`${withColor("Latest tag:", colors.dim)} ${latestVersion.raw}`);
	console.log(`${withColor("Next release:", colors.dim)} ${withColor(nextVersionString, colors.green)}`);

	const pendingCountRaw = runCaptured(
		`git rev-list --count ${latestVersion.raw === "0.0.0" ? "HEAD" : `${latestVersion.raw}..HEAD`}`,
	);
	const pendingCount = Number(pendingCountRaw);
	if (pendingCount === 0) {
		throw new Error(`No commits since latest tag ${latestVersion.raw}`);
	}
	console.log(`${withColor("Unreleased commits:", colors.dim)} ${pendingCount}`);

	if (!skipPrompt) {
		const accepted = await confirm(`Continue with release ${nextVersionString}? [y/N] `);
		if (!accepted) {
			console.log("Release cancelled.");
			process.exit(0);
		}
	}

	if (mode === "publish") {
		if (!isDryRun && packageJson.version !== nextVersionString) {
			throw new Error(
				`package.json version (${packageJson.version}) does not match publish version ${nextVersionString}.`,
			);
		}

		run(`git tag -a ${nextVersionString} -m "Release ${nextVersionString}"`);
		if (shouldPush) {
			run(`git push origin ${nextVersionString}`);
		}

		console.log(withColor(`Release ${nextVersionString} published.`, colors.green));
		if (!shouldPush) {
			console.log(withColor("Tag is local only. Use --push to trigger deployment.", colors.yellow));
		}
		return;
	}

	if (packageJson.version === nextVersionString && !isDryRun) {
		throw new Error(
			`package.json is already at ${nextVersionString}. This usually means a previous release attempt was interrupted before commit/tag.`,
		);
	}
	packageJson.version = nextVersionString;

	if (isDryRun) {
		console.log(`${withColor("[dry-run]", colors.cyan)} update package.json version -> ${nextVersionString}`);
	} else {
		writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, "\t")}\n`);
	}

	if (!skipCheck) {
		run("pnpm check");
	}

	if (!isDryRun) {
		const postCheckStatusLines = getStatusLines();
		const unexpectedPostCheckChanges = postCheckStatusLines.filter((line) => getLinePath(line) !== "package.json");
		if (unexpectedPostCheckChanges.length > 0) {
			throw new Error(
				`Release aborted: checks changed files besides package.json.\n\n${formatStatusLines(unexpectedPostCheckChanges)}`,
			);
		}
		if (postCheckStatusLines.length === 0) {
			throw new Error("Release aborted: expected package.json version update was not detected.");
		}
	} else {
		console.log(withColor("[dry-run] verify only package.json changed after checks", colors.cyan));
	}

	run("git add package.json");
	run(`git commit -m "chore(release): ${nextVersionString}"`);

	if (!isDryRun) {
		const postCommitStatusLines = getStatusLines();
		if (postCommitStatusLines.length > 0) {
			throw new Error(
				`Release aborted: working tree must be clean after release commit.\n\n${formatStatusLines(postCommitStatusLines)}`,
			);
		}
	} else {
		console.log(withColor("[dry-run] verify clean working tree after release commit", colors.cyan));
	}

	if (mode === "prepare") {
		if (shouldPush) {
			if (currentBranch === "main" && !isDryRun) {
				throw new Error("Prepare mode with --push must run on a feature branch, not main.");
			}
			run("git push -u origin HEAD");
		}
		console.log(withColor(`Release ${nextVersionString} prepared.`, colors.green));
		console.log(withColor("Open a PR, merge to main, then run: pnpm release --publish --push", colors.dim));
		return;
	}

	run(`git tag -a ${nextVersionString} -m "Release ${nextVersionString}"`);

	if (shouldPush) {
		try {
			run("git push origin main");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes("GH013") || message.toLowerCase().includes("pull request")) {
				throw new Error(
					`${message}\n\nDirect pushes to main are blocked. Use PR flow:\n` +
						`1) pnpm release ${requestedVersion ? `--version ${nextVersionString}` : bumpType} --prepare\n` +
						"2) open and merge a PR\n" +
						"3) on updated main: pnpm release --publish --push",
				);
			}
			throw error;
		}
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
