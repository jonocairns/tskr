import { isGoogleAuthEnabled } from "@/lib/authConfig";

import { AuthLinkClient } from "./AuthLinkClient";

export default function AuthLinkPage() {
	return <AuthLinkClient googleEnabled={isGoogleAuthEnabled} />;
}
