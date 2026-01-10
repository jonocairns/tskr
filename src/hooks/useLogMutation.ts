"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

export const useLogMutation = () => {
	const router = useRouter();
	const { toast } = useToast();
	const utils = trpc.useUtils();

	const createLogMutation = trpc.logs.create.useMutation({
		onSuccess: (data) => {
			const isPending = data.entry.status === "PENDING";
			toast({
				title: isPending ? "Submitted for approval" : "Task logged",
				description: isPending ? "Task logged and waiting for approval." : "Time-based task recorded and points added.",
			});
			utils.logs.invalidate();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: "Unable to log task",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	return createLogMutation;
};
