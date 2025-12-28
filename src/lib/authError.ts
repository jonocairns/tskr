type AuthErrorMessage = {
	title: string;
	description: string;
};

export type AuthErrorInfo = AuthErrorMessage & {
	key: string;
};

const authErrorCopy: Record<string, AuthErrorMessage> = {
	AccessDenied: {
		title: "Access denied",
		description:
			"This sign-in method is currently blocked. Ask a super admin to enable Google sign-ins or link your account.",
	},
	OAuthAccountNotLinked: {
		title: "Account not linked",
		description: "Sign in with the provider you used before, or ask a super admin to link your account.",
	},
	CredentialsSignin: {
		title: "Sign in failed",
		description: "Check your email and password, then try again.",
	},
	Configuration: {
		title: "Auth misconfigured",
		description: "Sign-in is not fully configured yet. Please try again later.",
	},
	Callback: {
		title: "Sign in failed",
		description: "We couldn't complete the sign-in. Please try again.",
	},
	Default: {
		title: "Sign-in error",
		description: "Something went wrong during sign-in. Please try again.",
	},
};

export const normalizeAuthError = (value?: string | string[]) => {
	if (!value) {
		return "Default";
	}
	return Array.isArray(value) ? (value[0] ?? "Default") : value;
};

export const getAuthErrorMessage = (value?: string | string[]): AuthErrorInfo => {
	const key = normalizeAuthError(value);
	const message = authErrorCopy[key] ?? authErrorCopy.Default;
	return { key, ...message };
};
