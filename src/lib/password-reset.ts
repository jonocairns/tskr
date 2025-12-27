import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { config } from "@/server-config";

const getTtlHours = () => {
	const ttl = config.passwordResetTtlHours;
	if (Number.isFinite(ttl) && ttl > 0) {
		return ttl;
	}
	return 24;
};

export const createPasswordResetToken = async (userId: string) => {
	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + getTtlHours() * 60 * 60 * 1000);

	await prisma.passwordResetToken.create({
		data: {
			userId,
			token,
			expiresAt,
		},
	});

	return { token, expiresAt };
};
