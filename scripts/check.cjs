const { spawnSync } = require("node:child_process");

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
};

const colorsEnabled = process.stdout.isTTY && process.env.NO_COLOR !== "1";

const withColor = (text, color) => (colorsEnabled ? `${color}${text}${colors.reset}` : text);

const formatMs = (ms) => `${(ms / 1000).toFixed(2)}s`;

const args = process.argv.slice(2);
const lintCommand = args.includes("--fix") ? "pnpm lint:fix" : "pnpm lint";

const steps = [
	{ label: "Sync i18n", command: "pnpm i18n:sync" },
	{ label: args.includes("--fix") ? "Lint (fix)" : "Lint", command: lintCommand },
	{ label: "Compile", command: "pnpm compile" },
	{ label: "Test", command: "pnpm test" },
];

console.log(withColor("tskr check", colors.bold));
console.log(withColor(`Mode: ${args.includes("--fix") ? "fix" : "verify"}`, colors.dim));

const startAll = Date.now();

for (const [index, step] of steps.entries()) {
	const stepStart = Date.now();

	const result = spawnSync(step.command, {
		shell: true,
		stdio: ["inherit", "pipe", "pipe"],
		encoding: "utf8",
	});

	const elapsed = Date.now() - stepStart;
	if (result.status !== 0) {
		const stepPrefix = `[${index + 1}/${steps.length}]`;
		console.log(
			`\n${withColor(stepPrefix, colors.cyan)} ${withColor(step.label, colors.bold)}  ${withColor(step.command, colors.dim)}`,
		);
		if (result.stdout && result.stdout.trim().length > 0) {
			process.stdout.write(result.stdout);
			if (!result.stdout.endsWith("\n")) {
				process.stdout.write("\n");
			}
		}
		if (result.stderr && result.stderr.trim().length > 0) {
			process.stderr.write(result.stderr);
			if (!result.stderr.endsWith("\n")) {
				process.stderr.write("\n");
			}
		}
		console.log(`${withColor("[FAIL]", colors.red)} ${step.label} ${withColor(`(${formatMs(elapsed)})`, colors.dim)}`);
		process.exit(result.status ?? 1);
	}

	console.log(`${withColor("[OK]", colors.green)} ${step.label} ${withColor(`(${formatMs(elapsed)})`, colors.dim)}`);
}

const totalElapsed = Date.now() - startAll;
console.log(
	`\n${withColor("[DONE]", colors.green)} All checks passed ${withColor(`(${formatMs(totalElapsed)})`, colors.dim)}`,
);
