import { PageTransition } from "@/components/PageTransition";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TRPCErrorBoundaryWithQueryInvalidation } from "@/components/TRPCErrorBoundary";
import { Toaster } from "@/components/ui/Toaster";
import { TRPCProvider } from "@/lib/trpc/react";

export const Providers = ({ nonce, children }: { nonce?: string; children: React.ReactNode }) => {
	return (
		<TRPCProvider>
			<TRPCErrorBoundaryWithQueryInvalidation>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
					<PullToRefresh />
					<PageTransition>{children}</PageTransition>
					<Toaster />
				</ThemeProvider>
			</TRPCErrorBoundaryWithQueryInvalidation>
		</TRPCProvider>
	);
};
