import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/PageShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export const Route = createFileRoute("/reset-password/$token")({
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { token } = Route.useParams();

	return (
		<PageShell layout="centered" size="sm">
			<Card>
				<CardHeader>
					<CardTitle>Set a new password</CardTitle>
					<CardDescription>Choose a new password to sign in with email.</CardDescription>
				</CardHeader>
				<CardContent>
					<ResetPasswordForm token={token} />
				</CardContent>
			</Card>
		</PageShell>
	);
}
