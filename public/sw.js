self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
	const fallback = {
		title: "tskr",
		body: "New task activity",
		url: "/",
		icon: "/icon-192.png",
		badge: "/icon-192.png",
	};

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
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clients) => {
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
