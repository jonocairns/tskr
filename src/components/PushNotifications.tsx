"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/lib/i18nClient";
import { trpc } from "@/lib/trpc/react";

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

const subscribeWithTimeout = async (registration: ServiceWorkerRegistration, publicKey: string, timeoutMs = 10000) => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	try {
		const applicationServerKey = toUint8Array(publicKey);
		const subscribePromise = registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey,
		});

		const timeoutPromise = new Promise<never>((_resolve, reject) => {
			timeoutId = setTimeout(() => {
				reject(new Error("Subscription timed out"));
			}, timeoutMs);
		});

		return await Promise.race([subscribePromise, timeoutPromise]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
};

const describeError = (error: unknown, fallbackMessage: string) => {
	if (error instanceof Error) {
		return { name: error.name, message: error.message };
	}
	if (typeof error === "string") {
		return { name: "Error", message: error };
	}
	return { name: "Error", message: fallbackMessage };
};

const extractSubscriptionKeys = (subscription: PushSubscription) => {
	const json = subscription.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
		return null;
	}
	return {
		endpoint: json.endpoint,
		keys: {
			p256dh: json.keys.p256dh,
			auth: json.keys.auth,
		},
	};
};

type Props = {
	householdId: string;
	variant?: "card" | "section";
};

export const PushNotifications = ({ householdId, variant = "card" }: Props) => {
	const [status, setStatus] = useState<Status>("loading");
	const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [vapidPublicKey, setVapidPublicKey] = useState("");
	const [isKeyLoaded, setIsKeyLoaded] = useState(false);
	const { toast } = useToast();
	const { t } = useTranslation();

	const subscribeMutation = trpc.push.subscribe.useMutation({
		onError: (error) => {
			console.error("[push] subscribe failed", error);
			toast({
				title: t("Unable to enable notifications"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const unsubscribeMutation = trpc.push.unsubscribe.useMutation({
		onError: (error) => {
			console.error("[push] unsubscribe failed", error);
			toast({
				title: t("Unable to disable notifications"),
				description: t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const testMutation = trpc.push.test.useMutation({
		onSuccess: () => {
			toast({
				title: t("Test notification sent"),
				description: t("Check your device for the push alert."),
			});
		},
		onError: (error) => {
			console.error("[push] test failed", error);
			toast({
				title: t("Unable to send test"),
				description: t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const { data: keyData } = trpc.push.getPublicKey.useQuery(undefined, {
		retry: false,
		refetchOnWindowFocus: false,
	});

	const hasVapidKey = vapidPublicKey.length > 0;

	useEffect(() => {
		let active = true;

		const setup = async () => {
			if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
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
		if (keyData?.publicKey) {
			setVapidPublicKey(keyData.publicKey);
		}
		setIsKeyLoaded(true);
	}, [keyData]);

	const helperText = useMemo(() => {
		if (status === "unsupported") {
			return t("Your browser does not support Web Push.");
		}
		if (status === "blocked") {
			return t("Notifications are blocked in browser settings.");
		}
		if (isKeyLoaded && !hasVapidKey) {
			return t("Missing VAPID_PUBLIC_KEY.");
		}
		return null;
	}, [status, isKeyLoaded, hasVapidKey, t]);

	const isSubscribed = status === "subscribed";
	const toggleDisabled = isSubscribed ? isBusy : isBusy || status !== "ready" || !isKeyLoaded || !hasVapidKey;

	const handleEnable = async () => {
		if (!isKeyLoaded) {
			toast({
				title: t("Loading push settings"),
				description: t("Try again in a moment."),
				variant: "destructive",
			});
			return;
		}

		if (!hasVapidKey) {
			toast({
				title: t("Missing VAPID key"),
				description: t("Set VAPID_PUBLIC_KEY to enable push."),
				variant: "destructive",
			});
			return;
		}

		setIsBusy(true);
		try {
			toast({
				title: t("Enabling notifications"),
				description: t("Waiting for the browser subscription."),
			});

			const activeRegistration = registration ?? (await navigator.serviceWorker.ready);

			if (!activeRegistration?.pushManager) {
				toast({
					title: t("Notifications unavailable"),
					description: t("Push manager not available on this device."),
					variant: "destructive",
				});
				return;
			}

			const existing = await activeRegistration.pushManager.getSubscription();
			const existingKeys = existing ? extractSubscriptionKeys(existing) : null;
			if (existingKeys) {
				await subscribeMutation.mutateAsync(existingKeys);
				setStatus("subscribed");
				toast({
					title: t("Notifications enabled"),
					description: t("You will now receive task updates."),
				});
				return;
			}

			const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
			if (permission !== "granted") {
				setStatus(permission === "denied" ? "blocked" : "ready");
				return;
			}

			const subscription = await subscribeWithTimeout(activeRegistration, vapidPublicKey);
			const subscriptionKeys = extractSubscriptionKeys(subscription);
			if (!subscriptionKeys) {
				throw new Error("Invalid subscription data");
			}

			await subscribeMutation.mutateAsync(subscriptionKeys);
			setStatus("subscribed");
			toast({
				title: t("Notifications enabled"),
				description: t("You will now receive task updates."),
			});
		} catch (error) {
			const { name, message } = describeError(error, t("Unknown error"));
			if (name === "NotAllowedError") {
				setStatus("blocked");
			} else if (name === "NotSupportedError") {
				setStatus("unsupported");
			}

			console.error("[push] subscribe failed", error);
			toast({
				title: t("Unable to enable notifications"),
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
				await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
				await subscription.unsubscribe();
			}

			setStatus("ready");
			toast({
				title: t("Notifications disabled"),
				description: t("You can re-enable them any time."),
			});
		} catch (error) {
			console.error("[push] unsubscribe failed", error);
			toast({
				title: t("Unable to disable notifications"),
				description: t("Please try again."),
				variant: "destructive",
			});
		} finally {
			setIsBusy(false);
		}
	};

	const handleTest = async () => {
		setIsTesting(true);
		try {
			await testMutation.mutateAsync({ householdId });
		} finally {
			setIsTesting(false);
		}
	};

	const handleToggle = (checked: boolean) => {
		if (checked) {
			handleEnable();
		} else {
			handleDisable();
		}
	};

	const controls = (
		<div className="flex items-center gap-3">
			<Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={isTesting || !isSubscribed}>
				{isTesting ? t("Sending...") : t("Send test")}
			</Button>
			<div className="flex items-center gap-2">
				<Switch
					id="push-notifications-toggle"
					checked={isSubscribed}
					disabled={toggleDisabled}
					onCheckedChange={handleToggle}
				/>
				<span className="text-sm text-muted-foreground">{isSubscribed ? t("On") : t("Off")}</span>
			</div>
		</div>
	);

	const helperTextElement = helperText ? <p className="text-sm text-muted-foreground">{helperText}</p> : null;

	if (variant === "section") {
		return (
			<>
				{helperTextElement}
				{controls}
			</>
		);
	}

	return (
		<Card>
			<CardContent className="pt-6">
				<div className="space-y-2">{helperTextElement}</div>
				{controls}
			</CardContent>
		</Card>
	);
};
