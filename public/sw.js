self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

const DEFAULT_NOTIFICATION_PAYLOAD = {
	url: "/",
	icon: "/icon-192.png",
	badge: "/icon-192.png",
};

const FALLBACK_MESSAGES_BY_LOCALE = {
	en: {
		title: "tskr",
		body: "New task activity",
	},
	pseudo: {
		title: "tskr [pseudo]",
		body: "New task activity [pseudo]",
	},
};

const resolvePreferredLocale = () => {
	const language = self.navigator && typeof self.navigator.language === "string" ? self.navigator.language.toLowerCase() : "en";
	if (language in FALLBACK_MESSAGES_BY_LOCALE) {
		return language;
	}

	const [baseLanguage] = language.split("-");
	if (baseLanguage && baseLanguage in FALLBACK_MESSAGES_BY_LOCALE) {
		return baseLanguage;
	}

	return "en";
};

const getFallbackPayload = () => {
	const locale = resolvePreferredLocale();
	return {
		...DEFAULT_NOTIFICATION_PAYLOAD,
		...FALLBACK_MESSAGES_BY_LOCALE[locale],
	};
};

self.addEventListener("push", (event) => {
	const fallback = getFallbackPayload();

	let payload = fallback;

	if (event.data) {
		try {
			payload = { ...fallback, ...event.data.json() };
		} catch {
			payload = { ...fallback, body: event.data.text() };
		}
	}

	const options = {
		body: payload.body,
		icon: payload.icon,
		badge: payload.badge,
		data: { url: payload.url },
	};

	event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const url = event.notification?.data?.url || "/";

	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if ("navigate" in client) {
					client.navigate(url);
					return client.focus();
				}
			}

			return self.clients.openWindow ? self.clients.openWindow(url) : null;
		}),
	);
});
