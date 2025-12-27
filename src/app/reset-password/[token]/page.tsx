import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: Props) {
	const { token = "" } = await params;

	return (
		<main className="flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
			<div className="mx-auto w-full max-w-md">
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
			</div>
		</main>
	);
}
