"use client";

import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAppErrorCode, getErrorMessage } from "@/lib/appErrors";
import { useTranslation } from "@/lib/i18nClient";

type Props = {
	children: ReactNode;
	onResetAction?: () => void;
};

type State = {
	hasError: boolean;
	error: Error | null;
};

const ErrorFallback = ({ error, onReset, onReload }: { error: Error; onReset: () => void; onReload: () => void }) => {
	const { t } = useTranslation();
	const appErrorCode = getAppErrorCode(error);
	const errorMessage = getErrorMessage(error, t, appErrorCode);
	const errorDescription = appErrorCode
		? t("Error: {{code}}", { code: appErrorCode })
		: t("We encountered an unexpected error");

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-destructive">{t("Something went wrong")}</CardTitle>
					<CardDescription>{errorDescription}</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">{errorMessage}</p>
					{process.env.NODE_ENV === "development" && error && (
						<details className="mt-4">
							<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
								{t("Error details (dev only)")}
							</summary>
							<pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{error.stack || error.toString()}</pre>
						</details>
					)}
				</CardContent>
				<CardFooter className="flex gap-2">
					<Button onClick={onReset} variant="outline" className="flex-1">
						{t("Try again")}
					</Button>
					<Button onClick={onReload} className="flex-1">
						{t("Reload page")}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
};

export class TRPCErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Log error details for debugging
		console.error("[TRPCErrorBoundary]", {
			error,
			errorInfo,
			isTRPCError: error instanceof TRPCClientError,
		});
	}

	private handleReset = () => {
		this.props.onResetAction?.();
		this.setState({ hasError: false, error: null });
	};

	private handleReload = () => {
		window.location.reload();
	};

	render() {
		if (this.state.hasError && this.state.error) {
			return <ErrorFallback error={this.state.error} onReset={this.handleReset} onReload={this.handleReload} />;
		}

		return this.props.children;
	}
}

export const TRPCErrorBoundaryWithQueryInvalidation = ({ children }: { children: ReactNode }) => {
	const queryClient = useQueryClient();

	const handleReset = () => {
		queryClient.invalidateQueries();
	};

	return <TRPCErrorBoundary onResetAction={handleReset}>{children}</TRPCErrorBoundary>;
};
