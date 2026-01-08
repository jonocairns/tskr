import type { Plugin } from "vite";

export const muteWarningsPlugin = (warningCodes: string[]): Plugin => {
	const seenMutedCodes = new Set<string>();

	return {
		name: "mute-warnings",
		enforce: "pre",
		config: () => ({
			build: {
				rollupOptions: {
					onwarn(warning, defaultHandler) {
						const code = warning.code;

						if (code) {
							if (warningCodes.includes(code)) {
								seenMutedCodes.add(code);
								return;
							}
						}

						defaultHandler(warning);
					},
				},
			},
		}),
		closeBundle() {
			if (warningCodes.length === 0) return;
			if (seenMutedCodes.size === 0) {
				this.info("mute-warnings: configured warning codes were not encountered during build");
			}
		},
	};
};
