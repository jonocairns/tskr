import Link from "next/link";

import { XIcon } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const errorCopy: Record<string, { title: string; description: string }> = {
	AccessDenied: {
		title: "Access denied",
		description:
			"This sign-in method is currently blocked. Ask a super admin to enable Google sign-ins or link your account.",
	},
	OAuthAccountNotLinked: {
		title: "Account not linked",
		description:
			"Sign in with the provider you used before, or ask a super admin to link your account.",
	},
	CredentialsSignin: {
		title: "Sign in failed",
		description: "Check your email and password, then try again.",
	},
	Configuration: {
		title: "Auth misconfigured",
		description: "Sign-in is not fully configured yet. Please try again later.",
	},
	Default: {
		title: "Sign-in error",
		description: "Something went wrong during sign-in. Please try again.",
	},
};

type Props = {
	searchParams: Promise<{ error?: string | string[] }>;
};

const normalizeError = (value?: string | string[]) => {
	if (!value) {
		return "Default";
	}
	return Array.isArray(value) ? (value[0] ?? "Default") : value;
};

export default async function AuthErrorPage({ searchParams }: Props) {
	const { error } = await searchParams;
	const errorKey = normalizeError(error);
	const message = errorCopy[errorKey] ?? errorCopy.Default;

	return (
		<PageShell layout="centered" size="md">
			<Card>
				<CardHeader className="space-y-4 text-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
						<XIcon className="h-6 w-6" />
					</div>
					<div className="space-y-1">
						<CardTitle>{message.title}</CardTitle>
						<CardDescription>{message.description}</CardDescription>
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Button asChild size="lg">
						<Link href="/">Back to sign in</Link>
					</Button>
					{errorKey !== "Default" ? (
						<p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
							Error code: {errorKey}
						</p>
					) : null}
				</CardContent>
			</Card>
		</PageShell>
	);
}
