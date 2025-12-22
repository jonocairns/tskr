import webPush, {
	type PushSubscription as WebPushSubscription,
} from "web-push";

import { prisma } from "@/lib/prisma";

type PushPayload = {
	title: string;
	body: string;
	url?: string;
	icon?: string;
	badge?: string;
};

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
const pushConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

if (pushConfigured) {
	webPush.setVapidDetails(
		vapidSubject,
		vapidPublicKey as string,
		vapidPrivateKey as string,
	);
}

const toWebPushSubscription = (subscription: {
	endpoint: string;
	p256dh: string;
	auth: string;
}): WebPushSubscription => ({
	endpoint: subscription.endpoint,
	keys: {
		p256dh: subscription.p256dh,
		auth: subscription.auth,
	},
});

export const isPushConfigured = () => pushConfigured;

export async function broadcastPush(payload: PushPayload) {
	if (!pushConfigured) {
		return { sent: 0, removed: 0 };
	}

	const subscriptions = await prisma.pushSubscription.findMany({
		select: { endpoint: true, p256dh: true, auth: true },
	});

	if (subscriptions.length === 0) {
		return { sent: 0, removed: 0 };
	}

	const payloadText = JSON.stringify(payload);
	const results = await Promise.all(
		subscriptions.map(async (subscription) => {
			try {
				await webPush.sendNotification(
					toWebPushSubscription(subscription),
					payloadText,
				);
				return { sent: 1, removed: 0 };
			} catch (error) {
				const statusCode =
					typeof error === "object" &&
					error &&
					"statusCode" in error &&
					typeof (error as { statusCode?: number }).statusCode === "number"
						? (error as { statusCode: number }).statusCode
						: undefined;

				if (statusCode === 404 || statusCode === 410) {
					await prisma.pushSubscription.delete({
						where: { endpoint: subscription.endpoint },
					});
					return { sent: 0, removed: 1 };
				}

				console.error("[push] send failed", error);
				return { sent: 0, removed: 0 };
			}
		}),
	);

	return results.reduce(
		(acc, result) => ({
			sent: acc.sent + result.sent,
			removed: acc.removed + result.removed,
		}),
		{ sent: 0, removed: 0 },
	);
}
