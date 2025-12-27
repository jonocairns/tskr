import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { PageShell } from "@/components/PageShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: Props) {
	const { token = "" } = await params;

	return (
		<PageShell layout="centered" size="sm">
			<Card>
				<CardHeader>
					<CardTitle>Set a new password</CardTitle>
					<CardDescription>
						Choose a new password to sign in with email.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ResetPasswordForm token={token} />
				</CardContent>
			</Card>
		</PageShell>
	);
}
