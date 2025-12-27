export const resolveReturnTo = (value: string | null) => {
	if (!value) {
		return "/";
	}

	try {
		const decoded = decodeURIComponent(value);
		if (
			decoded.startsWith("/") &&
			!decoded.startsWith("//") &&
			!decoded.startsWith("/\\") &&
			!decoded.startsWith("\\") &&
			!decoded.includes("\0") &&
			!decoded.includes("\r") &&
			!decoded.includes("\n")
		) {
			return decoded;
		}
	} catch {
		return "/";
	}

	return "/";
};
