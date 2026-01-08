"use client";

import { useRouter, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";

import { useToast } from "@/hooks/useToast";

const householdErrorMessages: Record<string, { title: string; description: string }> = {
	HouseholdAccessDenied: {
		title: "Access denied",
		description: "You don't have access to that household. Redirected to your active household.",
	},
	NoHouseholdMembership: {
		title: "No household found",
		description: "You need to create or join a household first.",
	},
};

export const HouseholdErrorToast = () => {
	const search = useSearch({ strict: false }) as { error?: string };
	const router = useRouter();
	const { toast } = useToast();

	useEffect(() => {
		const error = search?.error;
		if (error && householdErrorMessages[error]) {
			const message = householdErrorMessages[error];
			toast({
				title: message.title,
				description: message.description,
				variant: "destructive",
			});

			const url = new URL(window.location.href);
			url.searchParams.delete("error");
			router.navigate({ to: url.pathname + url.search, replace: true });
		}
	}, [search, router, toast]);

	return null;
};
