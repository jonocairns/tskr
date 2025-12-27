import "server-only";

export const getProfileEmail = (profile: unknown) => {
	if (!profile || typeof profile !== "object") {
		return null;
	}

	const maybeEmail = (profile as { email?: unknown }).email;
	return typeof maybeEmail === "string" ? maybeEmail : null;
};

export const getProfileName = (profile: unknown) => {
	if (!profile || typeof profile !== "object") {
		return null;
	}

	const maybeName = (profile as { name?: unknown }).name;
	return typeof maybeName === "string" ? maybeName : null;
};

export const getProfileImage = (profile: unknown) => {
	if (!profile || typeof profile !== "object") {
		return null;
	}

	const maybeImage = (profile as { picture?: unknown }).picture;
	return typeof maybeImage === "string" ? maybeImage : null;
};
