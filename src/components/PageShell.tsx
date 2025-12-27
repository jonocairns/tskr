import { cn } from "@/lib/utils";

type Props = {
	children: React.ReactNode;
	size?: "sm" | "md" | "lg" | "xl";
	layout?: "default" | "centered";
	className?: string;
	containerClassName?: string;
};

const sizeClasses: Record<NonNullable<Props["size"]>, string> = {
	sm: "max-w-3xl",
	md: "max-w-5xl",
	lg: "max-w-6xl",
	xl: "max-w-7xl",
};

const centeredSizeClasses: Record<NonNullable<Props["size"]>, string> = {
	sm: "max-w-md",
	md: "max-w-lg",
	lg: "max-w-2xl",
	xl: "max-w-3xl",
};

export const PageShell = ({
	children,
	size = "lg",
	layout = "default",
	className,
	containerClassName,
}: Props) => {
	const mainClass =
		layout === "centered"
			? "flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12"
			: "min-h-screen bg-gradient-to-br from-background via-background to-muted";
	const containerClass =
		layout === "centered"
			? cn("mx-auto w-full", centeredSizeClasses[size])
			: cn("mx-auto flex flex-col gap-6 px-4 py-10", sizeClasses[size]);

	return (
		<main className={cn(mainClass, className)}>
			<div className={cn(containerClass, containerClassName)}>{children}</div>
		</main>
	);
};
