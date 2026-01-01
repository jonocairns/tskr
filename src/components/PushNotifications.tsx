"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
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
		const subscribePromise = registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: toUint8Array(publicKey),
		});

		const timeoutPromise = new Promise<never>((_resolve, reject) => {
			timeoutId = setTimeout(() => {
				reject(new Error("Subscription timed out"));
			}, timeoutMs);
		});

		return (await Promise.race([subscribePromise, timeoutPromise])) as PushSubscription;
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
};

type Props = {
	variant?: "card" | "section";
};

export const PushNotifications = ({ variant = "card" }: Props) => {
	const params = useParams<{ householdId: string }>();
	const householdId = params.householdId;
	const [status, setStatus] = useState<Status>("loading");
	const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [vapidPublicKey, setVapidPublicKey] = useState("");
	const [isKeyLoaded, setIsKeyLoaded] = useState(false);
	const { toast } = useToast();

	const subscribeMutation = trpc.push.subscribe.useMutation({
		onError: (error) => {
			console.error("[push] subscribe failed", error);
			toast({
				title: "Unable to enable notifications",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const unsubscribeMutation = trpc.push.unsubscribe.useMutation({
		onError: (error) => {
			console.error("[push] unsubscribe failed", error);
			toast({
				title: "Unable to disable notifications",
				description: "Please try again.",
				variant: "destructive",
			});
		},
	});

	const testMutation = trpc.push.test.useMutation({
		onSuccess: () => {
			toast({
				title: "Test notification sent",
				description: "Check your device for the push alert.",
			});
		},
		onError: (error) => {
			console.error("[push] test failed", error);
			toast({
				title: "Unable to send test",
				description: "Please try again.",
				variant: "destructive",
			});
		},
	});

	const { data: keyData } = trpc.push.getPublicKey.useQuery(undefined, {
		retry: false,
		refetchOnWindowFocus: false,
	});

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
			return "Your browser does not support Web Push.";
		}
		if (status === "blocked") {
			return "Notifications are blocked in browser settings.";
		}
		if (isKeyLoaded && !hasVapidKey) {
			return "Missing VAPID_PUBLIC_KEY.";
		}
		return null;
	}, [status, isKeyLoaded, hasVapidKey]);

	const isSubscribed = status === "subscribed";
	const toggleDisabled = isSubscribed ? isBusy : isBusy || status !== "ready" || !isKeyLoaded || !hasVapidKey;

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

			const activeRegistration = registration ?? (await navigator.serviceWorker.ready);

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
				const json = existing.toJSON();
				if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
					await subscribeMutation.mutateAsync({
						endpoint: json.endpoint,
						keys: {
							p256dh: json.keys.p256dh,
							auth: json.keys.auth,
						},
					});

					setStatus("subscribed");
					toast({
						title: "Notifications enabled",
						description: "You will now receive task updates.",
					});
					return;
				}
			}

			const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
			if (permission !== "granted") {
				setStatus(permission === "denied" ? "blocked" : "ready");
				return;
			}

			const subscription = await subscribeWithTimeout(activeRegistration, vapidPublicKey);

			const json = subscription.toJSON();
			if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
				throw new Error("Invalid subscription data");
			}

			await subscribeMutation.mutateAsync({
				endpoint: json.endpoint,
				keys: {
					p256dh: json.keys.p256dh,
					auth: json.keys.auth,
				},
			});

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
				await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
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
			await testMutation.mutateAsync({ householdId });
		} finally {
			setIsTesting(false);
		}
	};

	const content = (
		<div className="space-y-2">
			<Label htmlFor="push-notifications-toggle">Notifications</Label>
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex items-center gap-2">
					<Switch
						id="push-notifications-toggle"
						checked={isSubscribed}
						disabled={toggleDisabled}
						onCheckedChange={(checked) => (checked ? handleEnable() : handleDisable())}
					/>
					<span className="text-sm text-muted-foreground">{isSubscribed ? "On" : "Off"}</span>
				</div>
				<Button type="button" variant="outline" onClick={handleTest} disabled={isTesting || !isSubscribed}>
					{isTesting ? "Sending..." : "Send test"}
				</Button>
			</div>
			{helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
		</div>
	);

	if (variant === "section") {
		return <section className="space-y-3">{content}</section>;
	}

	return (
		<Card>
			<CardContent className="pt-6">{content}</CardContent>
		</Card>
	);
};
