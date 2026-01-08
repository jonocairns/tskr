import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/auth/auth";
import { PageShell } from "@/components/PageShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { checkPasswordResetRequired } from "@/lib/passwordReset";

const loadResetPage = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	if (!session?.user?.id) {
		throw redirect({ to: "/", search: { error: undefined } });
	}

	const resetRequired = await checkPasswordResetRequired(session.user.id);
	if (!resetRequired) {
		throw redirect({ to: "/", search: { error: undefined } });
	}

	return { ok: true };
});

export const Route = createFileRoute("/reset-password/")({
	loader: () => loadResetPage(),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	return (
		<PageShell layout="centered" size="sm">
			<Card>
				<CardHeader>
					<CardTitle>Set a new password</CardTitle>
					<CardDescription>Choose a new password to keep using your account.</CardDescription>
				</CardHeader>
				<CardContent>
					<ResetPasswordForm />
				</CardContent>
			</Card>
		</PageShell>
	);
}
