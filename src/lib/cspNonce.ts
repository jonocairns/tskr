import "server-only";

const NONCE_REGEX = /'nonce-([^']+)'/;

export const getCspNonce = (cspHeader: string | null) => {
	if (!cspHeader) {
		return undefined;
	}

	const match = cspHeader.match(NONCE_REGEX);
	return match?.[1];
};
