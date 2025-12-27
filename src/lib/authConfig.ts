import "server-only";

import { config } from "@/server-config";

export const isGoogleAuthEnabled = Boolean(
	config.googleClientId && config.googleClientSecret,
);
