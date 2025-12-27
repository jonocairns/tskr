import "server-only";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/passwords";

let hasEnsuredDefaultAdmin = false;

const DEFAULT_SUPER_ADMIN_EMAIL = "admin@example.com";
const DEFAULT_SUPER_ADMIN_PASSWORD = "admin";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const ensureDefaultSuperAdmin = async () => {
	if (hasEnsuredDefaultAdmin) {
		return;
	}

	try {
		const existingSuperAdmin = await prisma.user.findFirst({
			where: { isSuperAdmin: true },
			select: { id: true },
		});

		if (existingSuperAdmin) {
			hasEnsuredDefaultAdmin = true;
			return;
		}

		const normalizedEmail = normalizeEmail(DEFAULT_SUPER_ADMIN_EMAIL);
		const existing = await prisma.user.findUnique({
			where: { email: normalizedEmail },
			select: {
				id: true,
				isSuperAdmin: true,
				passwordHash: true,
				passwordResetRequired: true,
			},
		});

		if (!existing) {
			const passwordHash = await hashPassword(DEFAULT_SUPER_ADMIN_PASSWORD);
			await prisma.user.create({
				data: {
					email: normalizedEmail,
					passwordHash,
					isSuperAdmin: true,
					passwordResetRequired: true,
				},
			});
			hasEnsuredDefaultAdmin = true;
			return;
		}

		const updates: {
			isSuperAdmin?: boolean;
			passwordHash?: string;
			passwordResetRequired?: boolean;
		} = {};

		if (!existing.isSuperAdmin) {
			updates.isSuperAdmin = true;
		}
		if (!existing.passwordHash) {
			updates.passwordHash = await hashPassword(DEFAULT_SUPER_ADMIN_PASSWORD);
			updates.passwordResetRequired = true;
		}

		if (Object.keys(updates).length > 0) {
			await prisma.user.update({
				where: { id: existing.id },
				data: updates,
			});
		}
	} catch (error) {
		hasEnsuredDefaultAdmin = false;
		throw error;
	}

	hasEnsuredDefaultAdmin = true;
};
