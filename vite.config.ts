import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

import { muteWarningsPlugin } from "./muteWarningsPlugin";

export default defineConfig({
	plugins: [
		muteWarningsPlugin(["MODULE_LEVEL_DIRECTIVE"]),
		viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
		tanstackStart({ server: { entry: "server-entry" } }),
		viteReact(),
	],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules")) {
						if (id.includes("@tanstack")) return "tanstack";
						if (id.includes("framer-motion")) return "framer-motion";
						if (id.includes("radix-ui")) return "radix";
						if (id.includes("lucide-react")) return "icons";
						return "vendor";
					}
				},
			},
		},
	},
});
