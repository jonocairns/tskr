import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { config } from "@/server-config";

const getTtlHours = () => {
	const ttl = config.passwordResetTtlHours;
	if (Number.isFinite(ttl) && ttl > 0) {
		return ttl;
	}
	return 24;
};

export const hashPasswordResetToken = (token: string) =>
	createHash("sha256").update(token).digest("hex");

export const createPasswordResetToken = async (userId: string) => {
	const token = randomBytes(32).toString("base64url");
	const tokenHash = hashPasswordResetToken(token);
	const expiresAt = new Date(Date.now() + getTtlHours() * 60 * 60 * 1000);

	await prisma.passwordResetToken.create({
		data: {
			userId,
			tokenHash,
			expiresAt,
		},
	});

	return { token, expiresAt };
};
