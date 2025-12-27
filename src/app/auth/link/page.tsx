"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import { Loader2Icon } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";

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

export default function AuthLinkPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { update } = useSession();
	const returnTo = useMemo(
		() => resolveReturnTo(searchParams.get("returnTo")),
		[searchParams],
	);

	useEffect(() => {
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
	}, [returnTo, router, update]);

	return (
		<PageShell layout="centered" size="sm">
			<Card>
				<CardHeader>
					<CardTitle>Linking account</CardTitle>
					<CardDescription>Syncing your Google profile details.</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
					<Loader2Icon className="h-4 w-4 animate-spin" />
					<span>Please wait…</span>
				</CardContent>
			</Card>
		</PageShell>
	);
}
