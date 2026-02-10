"use client";

import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, OctagonXIcon } from "lucide-react";

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

export const Toaster = () => {
	const { toasts } = useToast();

	const getToastIcon = (variant: "default" | "success" | "warning" | "destructive" | null | undefined) => {
		if (variant === "destructive") {
			return <OctagonXIcon className="h-4 w-4 text-destructive" aria-hidden="true" />;
		}
		if (variant === "success") {
			return <CheckCircle2Icon className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
		}
		if (variant === "warning") {
			return <AlertTriangleIcon className="h-4 w-4 text-amber-600" aria-hidden="true" />;
		}
		return <InfoIcon className="h-4 w-4 text-foreground/85" aria-hidden="true" />;
	};

	return (
		<ToastProvider>
			{toasts.map(({ id, title, description, action, ...props }) => {
				const hasDescription = description !== undefined && description !== null;
				const isDefaultVariant = props.variant === "default" || props.variant === undefined || props.variant === null;

				return (
					<Toast key={id} {...props}>
						<div className={cn("flex gap-2", hasDescription ? "items-start" : "items-center")}>
							<div
								className={cn(
									"rounded-md border border-border/60 bg-background/70 p-1",
									hasDescription ? "mt-0.5" : null,
									isDefaultVariant ? "border-foreground/20 bg-foreground/10" : null,
									props.variant === "destructive" ? "border-destructive/30 bg-destructive/10" : null,
								)}
							>
								{getToastIcon(props.variant)}
							</div>
							<div className="grid gap-0.5">
								{title ? <ToastTitle>{title}</ToastTitle> : null}
								{description ? <ToastDescription>{description}</ToastDescription> : null}
							</div>
						</div>
						{action}
						<ToastClose />
					</Toast>
				);
			})}
			<ToastViewport />
		</ToastProvider>
	);
};
