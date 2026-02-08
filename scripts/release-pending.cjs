const { spawnSync } = require("node:child_process");

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
};

const colorsEnabled = process.stdout.isTTY && process.env.NO_COLOR !== "1";
const withColor = (text, color) => (colorsEnabled ? `${color}${text}${colors.reset}` : text);
const args = process.argv.slice(2);
const skipFetch = args.includes("--no-fetch");
const scopeValueIndex = args.indexOf("--scope");
const requestedScope = scopeValueIndex >= 0 ? args[scopeValueIndex + 1] : null;

const run = (command, options = {}) => {
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

const hasOriginRemote = () => {
	const result = spawnSync("git remote get-url origin", {
		shell: true,
		encoding: "utf8",
		stdio: ["inherit", "pipe", "pipe"],
	});
	return result.status === 0;
};

const syncRemoteRefs = () => {
	if (skipFetch) {
		return;
	}
	if (!hasOriginRemote()) {
		throw new Error("No origin remote configured. Use --no-fetch only if you intentionally want local-only release state.");
	}
	run("git fetch origin main --tags");
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

const getLatestReleaseTag = () => {
	const rawTags = run("git tag --list", { capture: true });
	if (rawTags.length === 0) {
		return null;
	}

	const versions = rawTags
		.split("\n")
		.map((tag) => parseVersionTag(tag))
		.filter((tag) => tag !== null)
		.sort(compareVersions);

	return versions.length > 0 ? versions[versions.length - 1].raw : null;
};

const getPendingCommits = (latestTag, ref) => {
	const range = latestTag ? `${latestTag}..${ref}` : ref;
	const output = run(`git log ${range} --pretty=format:%h%x09%s%x09%an`, { capture: true });
	if (output.length === 0) {
		return [];
	}

	return output.split("\n").map((line) => {
		const [hash, subject, author] = line.split("\t");
		return { hash, subject, author };
	});
};

const getCurrentBranch = () => run("git rev-parse --abbrev-ref HEAD", { capture: true });

const getPendingCount = (latestTag, ref) => {
	const range = latestTag ? `${latestTag}..${ref}` : ref;
	const output = run(`git rev-list --count ${range}`, { capture: true });
	return Number(output);
};

try {
	if (requestedScope && requestedScope !== "main" && requestedScope !== "branch") {
		throw new Error(`Invalid --scope value "${requestedScope}". Use "main" or "branch".`);
	}
	syncRemoteRefs();

	const latestTag = getLatestReleaseTag();
	const currentBranch = getCurrentBranch();
	const hasOrigin = hasOriginRemote();
	const mainRef = hasOrigin ? "origin/main" : "main";
	const scope = requestedScope ?? "main";
	const selectedRef = scope === "branch" ? "HEAD" : mainRef;
	const scopeLabel = scope === "branch" ? currentBranch : mainRef;
	const pendingCommits = getPendingCommits(latestTag, selectedRef);
	const pendingCountSelected = getPendingCount(latestTag, selectedRef);

	console.log(withColor("Release pending check", colors.bold));
	console.log(
		`${withColor("Latest release:", colors.dim)} ${
			latestTag ? withColor(latestTag, colors.green) : withColor("none", colors.yellow)
		}`,
	);
	console.log(`${withColor("Scope:", colors.dim)} ${scopeLabel}`);
	console.log(`${withColor("Unreleased commits:", colors.dim)} ${pendingCountSelected}`);

	if (currentBranch !== "main") {
		const branchCount = getPendingCount(latestTag, "HEAD");
		const mainCount = getPendingCount(latestTag, mainRef);
		console.log(`${withColor(`Unreleased commits (${currentBranch}):`, colors.dim)} ${branchCount}`);
		console.log(`${withColor(`Unreleased commits (${mainRef}):`, colors.dim)} ${mainCount}`);
	}

	if (pendingCommits.length === 0) {
		console.log(withColor("No unreleased commits.", colors.green));
		process.exit(0);
	}

	for (const commit of pendingCommits) {
		console.log(
			`- ${withColor(commit.hash, colors.dim)} ${commit.subject} ${withColor(`(${commit.author})`, colors.dim)}`,
		);
	}
} catch (error) {
	console.error(withColor("release:pending failed", colors.red));
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
