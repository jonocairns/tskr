"use client";

import { TRPCClientError } from "@trpc/client";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";

type Props = {
	children: ReactNode;
};

type State = {
	hasError: boolean;
	error: Error | null;
};

/**
 * Global error boundary for catching unhandled tRPC errors.
 * Displays a user-friendly error message and provides recovery options.
 */
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

		// You can also send error to monitoring service here
		// e.g., Sentry, LogRocket, etc.
	}

	private handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	private handleReload = () => {
		window.location.reload();
	};

	render() {
		if (this.state.hasError) {
			const error = this.state.error;
			const isTRPCError = error instanceof TRPCClientError;

			let errorMessage = "An unexpected error occurred";
			let errorCode: string | undefined;

			if (isTRPCError) {
				errorMessage = error.message || "A server error occurred";
				errorCode = error.data?.code;
			} else if (error?.message) {
				errorMessage = error.message;
			}

			return (
				<div className="flex min-h-screen items-center justify-center p-4">
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle className="text-destructive">Something went wrong</CardTitle>
							<CardDescription>
								{errorCode ? `Error: ${errorCode}` : "We encountered an unexpected error"}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">{errorMessage}</p>
							{process.env.NODE_ENV === "development" && error && (
								<details className="mt-4">
									<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
										Error details (dev only)
									</summary>
									<pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
										{error.stack || error.toString()}
									</pre>
								</details>
							)}
						</CardContent>
						<CardFooter className="flex gap-2">
							<Button onClick={this.handleReset} variant="outline" className="flex-1">
								Try again
							</Button>
							<Button onClick={this.handleReload} className="flex-1">
								Reload page
							</Button>
						</CardFooter>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}
