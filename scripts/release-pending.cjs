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

const getPendingCommits = (latestTag) => {
	const range = latestTag ? `${latestTag}..HEAD` : "HEAD";
	const output = run(`git log ${range} --pretty=format:%h%x09%s%x09%an`, { capture: true });
	if (output.length === 0) {
		return [];
	}

	return output.split("\n").map((line) => {
		const [hash, subject, author] = line.split("\t");
		return { hash, subject, author };
	});
};

try {
	const latestTag = getLatestReleaseTag();
	const pendingCommits = getPendingCommits(latestTag);

	console.log(withColor("Release pending check", colors.bold));
	console.log(
		`${withColor("Latest release:", colors.dim)} ${
			latestTag ? withColor(latestTag, colors.green) : withColor("none", colors.yellow)
		}`,
	);
	console.log(`${withColor("Unreleased commits:", colors.dim)} ${pendingCommits.length}`);

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
