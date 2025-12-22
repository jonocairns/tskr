"use client";

import { BellIcon, BellOffIcon, Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Status = "loading" | "unsupported" | "blocked" | "ready" | "subscribed";

const toUint8Array = (base64String: string) => {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; i += 1) {
		outputArray[i] = rawData.charCodeAt(i);
	}

	return outputArray;
};

const subscribeWithTimeout = async (
	registration: ServiceWorkerRegistration,
	publicKey: string,
	timeoutMs = 10000,
) => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	try {
		const subscribePromise = registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: toUint8Array(publicKey),
		});

		const timeoutPromise = new Promise<never>((_resolve, reject) => {
			timeoutId = setTimeout(() => {
				reject(new Error("Subscription timed out"));
			}, timeoutMs);
		});

		return (await Promise.race([
			subscribePromise,
			timeoutPromise,
		])) as PushSubscription;
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
};

export function PushNotifications() {
	const [status, setStatus] = useState<Status>("loading");
	const [registration, setRegistration] =
		useState<ServiceWorkerRegistration | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [vapidPublicKey, setVapidPublicKey] = useState("");
	const [isKeyLoaded, setIsKeyLoaded] = useState(false);
	const { toast } = useToast();

	const hasVapidKey = vapidPublicKey.length > 0;

	const describeError = (error: unknown) => {
		if (error instanceof Error) {
			return { name: error.name, message: error.message };
		}

		if (typeof error === "string") {
			return { name: "Error", message: error };
		}

		return { name: "Error", message: "Unknown error" };
	};

	useEffect(() => {
		let active = true;

		const setup = async () => {
			if (
				!("serviceWorker" in navigator) ||
				!("PushManager" in window) ||
				!("Notification" in window)
			) {
				setStatus("unsupported");
				return;
			}

			const reg = await navigator.serviceWorker.register("/sw.js");
			if (!active) {
				return;
			}

			setRegistration(reg);
			const subscription = await reg.pushManager.getSubscription();
			if (!active) {
				return;
			}

			if (subscription) {
				setStatus("subscribed");
				return;
			}

			if (Notification.permission === "denied") {
				setStatus("blocked");
				return;
			}

			setStatus("ready");
		};

		setup().catch(() => setStatus("unsupported"));

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		let active = true;

		const loadKey = async () => {
			try {
				const res = await fetch("/api/push/key");
				if (!res.ok) {
					return;
				}

				const data = await res.json().catch(() => ({}));
				if (typeof data?.publicKey === "string" && active) {
					setVapidPublicKey(data.publicKey);
				}
			} catch (error) {
				console.error("[push] key fetch failed", error);
			} finally {
				if (active) {
					setIsKeyLoaded(true);
				}
			}
		};

		loadKey();

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!registration || !hasVapidKey) {
			return;
		}

		let active = true;

		const syncSubscription = async () => {
			const subscription = await registration.pushManager.getSubscription();
			if (!subscription || !active) {
				return;
			}

			const res = await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(subscription.toJSON()),
			});

			if (!res.ok) {
				throw new Error("Subscription sync failed");
			}
		};

		syncSubscription().catch((error) => {
			console.error("[push] sync failed", error);
		});

		return () => {
			active = false;
		};
	}, [registration, hasVapidKey]);

	const statusLabel = useMemo(() => {
		switch (status) {
			case "subscribed":
				return "On";
			case "blocked":
				return "Blocked";
			case "unsupported":
				return "Unsupported";
			case "ready":
				return "Off";
			default:
				return "Checking";
		}
	}, [status]);

	const handleEnable = async () => {
		if (!isKeyLoaded) {
			toast({
				title: "Loading push settings",
				description: "Try again in a moment.",
				variant: "destructive",
			});
			return;
		}

		if (!hasVapidKey) {
			toast({
				title: "Missing VAPID key",
				description: "Set VAPID_PUBLIC_KEY to enable push.",
				variant: "destructive",
			});
			return;
		}

		setIsBusy(true);
		try {
			toast({
				title: "Enabling notifications",
				description: "Waiting for the browser subscription.",
			});

			const activeRegistration =
				registration ?? (await navigator.serviceWorker.ready);

			if (!activeRegistration?.pushManager) {
				toast({
					title: "Notifications unavailable",
					description: "Push manager not available on this device.",
					variant: "destructive",
				});
				return;
			}

			const existing = await activeRegistration.pushManager.getSubscription();
			if (existing) {
				const res = await fetch("/api/push/subscribe", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(existing.toJSON()),
				});

				if (!res.ok) {
					throw new Error("Subscription sync failed");
				}

				setStatus("subscribed");
				toast({
					title: "Notifications enabled",
					description: "You will now receive task updates.",
				});
				return;
			}

			const permission =
				Notification.permission === "granted"
					? "granted"
					: await Notification.requestPermission();
			if (permission !== "granted") {
				setStatus(permission === "denied" ? "blocked" : "ready");
				return;
			}

			const subscription = await subscribeWithTimeout(
				activeRegistration,
				vapidPublicKey,
			);

			const res = await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(subscription.toJSON()),
			});

			if (!res.ok) {
				throw new Error("Subscription rejected");
			}

			setStatus("subscribed");
			toast({
				title: "Notifications enabled",
				description: "You will now receive task updates.",
			});
		} catch (error) {
			const { name, message } = describeError(error);
			if (name === "NotAllowedError") {
				setStatus("blocked");
			} else if (name === "NotSupportedError") {
				setStatus("unsupported");
			}

			console.error("[push] subscribe failed", error);
			toast({
				title: "Unable to enable notifications",
				description: `${name}: ${message}`,
				variant: "destructive",
			});
		} finally {
			setIsBusy(false);
		}
	};

	const handleDisable = async () => {
		if (!registration) {
			setStatus("ready");
			return;
		}

		setIsBusy(true);
		try {
			const subscription = await registration.pushManager.getSubscription();
			if (subscription) {
				await fetch("/api/push/subscribe", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ endpoint: subscription.endpoint }),
				});
				await subscription.unsubscribe();
			}

			setStatus("ready");
			toast({
				title: "Notifications disabled",
				description: "You can re-enable them any time.",
			});
		} catch (error) {
			console.error("[push] unsubscribe failed", error);
			toast({
				title: "Unable to disable notifications",
				description: "Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsBusy(false);
		}
	};

	const handleTest = async () => {
		setIsTesting(true);
		try {
			const res = await fetch("/api/push/test", { method: "POST" });
			if (!res.ok) {
				throw new Error("Test push failed");
			}

			toast({
				title: "Test notification sent",
				description: "Check your device for the push alert.",
			});
		} catch (error) {
			console.error("[push] test failed", error);
			toast({
				title: "Unable to send test",
				description: "Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsTesting(false);
		}
	};

	return (
		<Card>
			<CardHeader className="space-y-1">
				<CardDescription>Alerts</CardDescription>
				<CardTitle className="flex items-center justify-between text-xl">
					Task notifications
					<Badge variant={status === "subscribed" ? "default" : "secondary"}>
						{statusLabel}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-wrap items-center gap-3">
				{status === "unsupported" ? (
					<span className="text-sm text-muted-foreground">
						Your browser does not support Web Push.
					</span>
				) : status === "blocked" ? (
					<span className="text-sm text-muted-foreground">
						Notifications are blocked in browser settings.
					</span>
				) : (
					<span className="text-sm text-muted-foreground">
						Install to the home screen on iOS for background alerts.
					</span>
				)}

				<div className="flex items-center gap-2">
					{status === "subscribed" ? (
						<Button
							type="button"
							variant="outline"
							onClick={handleDisable}
							disabled={isBusy}
						>
							{isBusy ? (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<BellOffIcon className="mr-2 h-4 w-4" />
							)}
							Turn off
						</Button>
					) : (
						<Button
							type="button"
							onClick={handleEnable}
							disabled={
								isBusy || status !== "ready" || !hasVapidKey || !isKeyLoaded
							}
						>
							{isBusy ? (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<BellIcon className="mr-2 h-4 w-4" />
							)}
							Enable
						</Button>
					)}
					<Button
						type="button"
						variant="outline"
						onClick={handleTest}
						disabled={isTesting || status !== "subscribed"}
					>
						{isTesting ? (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						Send test
					</Button>
				</div>
				{isKeyLoaded && !hasVapidKey ? (
					<span className="text-xs text-muted-foreground">
						Missing VAPID_PUBLIC_KEY.
					</span>
				) : null}
			</CardContent>
		</Card>
	);
}
