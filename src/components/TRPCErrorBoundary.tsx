"use client";

import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";

type Props = {
	children: ReactNode;
	onReset?: () => void;
};

type State = {
	hasError: boolean;
	error: Error | null;
};

function ErrorFallback({ error, onReset, onReload }: { error: Error; onReset: () => void; onReload: () => void }) {
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
					<CardDescription>{errorCode ? `Error: ${errorCode}` : "We encountered an unexpected error"}</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">{errorMessage}</p>
					{process.env.NODE_ENV === "development" && error && (
						<details className="mt-4">
							<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
								Error details (dev only)
							</summary>
							<pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{error.stack || error.toString()}</pre>
						</details>
					)}
				</CardContent>
				<CardFooter className="flex gap-2">
					<Button onClick={onReset} variant="outline" className="flex-1">
						Try again
					</Button>
					<Button onClick={onReload} className="flex-1">
						Reload page
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

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
		this.props.onReset?.();
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

export function TRPCErrorBoundaryWithQueryInvalidation({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	const handleReset = () => {
		queryClient.invalidateQueries();
	};

	return <TRPCErrorBoundary onReset={handleReset}>{children}</TRPCErrorBoundary>;
}
