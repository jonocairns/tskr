import { createFileRoute, Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAuthErrorMessage } from "@/lib/authError";

export const Route = createFileRoute("/auth/error")({
	validateSearch: (search: Record<string, unknown>) => ({
		error: typeof search.error === "string" ? search.error : undefined,
	}),
	component: AuthErrorPage,
});

function AuthErrorPage() {
	const { error } = Route.useSearch();
	const { key, title, description } = getAuthErrorMessage(error);

	return (
		<PageShell layout="centered" size="md">
			<Card>
				<CardHeader className="space-y-4 text-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
						<XIcon className="h-6 w-6" />
					</div>
					<div className="space-y-1">
						<CardTitle>{title}</CardTitle>
						<CardDescription>{description}</CardDescription>
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Button asChild size="lg">
						<Link to="/">Back to sign in</Link>
					</Button>
					{key !== "Default" ? (
						<p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Error code: {key}</p>
					) : null}
				</CardContent>
			</Card>
		</PageShell>
	);
}
