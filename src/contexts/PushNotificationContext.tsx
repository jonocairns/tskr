"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

type Status = "loading" | "unsupported" | "blocked" | "ready" | "subscribed";

interface PushNotificationContextValue {
	status: Status;
	isSubscribed: boolean;
	isReady: boolean;
}

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);

export const usePushNotificationStatus = () => {
	const context = useContext(PushNotificationContext);
	if (!context) {
		throw new Error("usePushNotificationStatus must be used within PushNotificationProvider");
	}
	return context;
};

export const PushNotificationProvider = ({ children }: { children: ReactNode }) => {
	const [status, setStatus] = useState<Status>("loading");

	useEffect(() => {
		let active = true;

		const checkStatus = async () => {
			if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
				setStatus("unsupported");
				return;
			}

			try {
				const reg = await navigator.serviceWorker.register("/sw.js");
				if (!active) {
					return;
				}

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
			} catch {
				setStatus("unsupported");
			}
		};

		checkStatus();

		return () => {
			active = false;
		};
	}, []);

	const value: PushNotificationContextValue = {
		status,
		isSubscribed: status === "subscribed",
		isReady: status === "ready" || status === "subscribed",
	};

	return <PushNotificationContext.Provider value={value}>{children}</PushNotificationContext.Provider>;
};
