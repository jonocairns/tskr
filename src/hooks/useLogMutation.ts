"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/lib/i18nClient";
import { trpc } from "@/lib/trpc/react";

export const useLogMutation = () => {
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();
	const utils = trpc.useUtils();

	const createLogMutation = trpc.logs.create.useMutation({
		onSuccess: (data) => {
			const isPending = data.entry.status === "PENDING";
			toast({
				title: isPending ? t("Submitted for approval") : t("Task logged"),
				description: isPending
					? t("Task logged and waiting for approval.")
					: t("Time-based task recorded and points added."),
			});
			utils.logs.invalidate();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: t("Unable to log task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	return createLogMutation;
};
