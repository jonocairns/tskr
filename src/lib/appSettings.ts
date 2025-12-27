import "server-only";

import { prisma } from "@/lib/prisma";

const APP_SETTINGS_ID = "singleton";

export const getAppSettings = async () => {
	const existing = await prisma.appSettings.findUnique({
		where: { id: APP_SETTINGS_ID },
		select: { allowGoogleAccountCreation: true },
	});

	if (existing) {
		return existing;
	}

	return prisma.appSettings.create({
		data: { id: APP_SETTINGS_ID },
		select: { allowGoogleAccountCreation: true },
	});
};

export const setAllowGoogleAccountCreation = async (value: boolean) => {
	return prisma.appSettings.upsert({
		where: { id: APP_SETTINGS_ID },
		create: { id: APP_SETTINGS_ID, allowGoogleAccountCreation: value },
		update: { allowGoogleAccountCreation: value },
		select: { allowGoogleAccountCreation: true },
	});
};
