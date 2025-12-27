import "server-only";

import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { config } from "@/server-config";

let hasEnsuredDefaultAdmin = false;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getBootstrapSuperAdmin = () => {
	const email = config.superAdminEmail?.trim();
	const password = config.superAdminPassword;

	if (!email || !password) {
		return null;
	}

	return { email: normalizeEmail(email), password };
};

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

		const bootstrap = getBootstrapSuperAdmin();
		if (!bootstrap) {
			console.warn(
				"No super admin found and SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD are not set. Skipping bootstrap.",
			);
			hasEnsuredDefaultAdmin = true;
			return;
		}

		const normalizedEmail = bootstrap.email;
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
			const passwordHash = await hashPassword(bootstrap.password);
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
			updates.passwordHash = await hashPassword(bootstrap.password);
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
