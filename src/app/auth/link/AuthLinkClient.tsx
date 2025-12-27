"use client";

import { Loader2Icon } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";

type Props = {
	googleEnabled: boolean;
};

const resolveReturnTo = (value: string | null) => {
	if (!value) {
		return "/";
	}

	try {
		const decoded = decodeURIComponent(value);
		if (decoded.startsWith("/")) {
			return decoded;
		}
	} catch {
		return "/";
	}

	return "/";
};

export const AuthLinkClient = ({ googleEnabled }: Props) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { update } = useSession();
	const returnTo = useMemo(
		() => resolveReturnTo(searchParams.get("returnTo")),
		[searchParams],
	);

	useEffect(() => {
		if (!googleEnabled) {
			return;
		}
		let isActive = true;

		const refreshSession = async () => {
			try {
				await update();
			} finally {
				if (isActive) {
					if (typeof window !== "undefined") {
						window.sessionStorage.setItem("googleLinkSuccess", "1");
					}
					router.replace(returnTo);
				}
			}
		};

		refreshSession();

		return () => {
			isActive = false;
		};
	}, [googleEnabled, returnTo, router, update]);

	if (!googleEnabled) {
		return (
			<PageShell layout="centered" size="sm">
				<Card>
					<CardHeader>
						<CardTitle>Google OAuth disabled</CardTitle>
						<CardDescription>
							This instance is not configured for Google account linking.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild variant="secondary">
							<Link href="/">Back to home</Link>
						</Button>
					</CardContent>
				</Card>
			</PageShell>
		);
	}

	return (
		<PageShell layout="centered" size="sm">
			<Card>
				<CardHeader>
					<CardTitle>Linking account</CardTitle>
					<CardDescription>Syncing your Google profile details.</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
					<Loader2Icon className="h-4 w-4 animate-spin" />
					<span>Please wait...</span>
				</CardContent>
			</Card>
		</PageShell>
	);
};
