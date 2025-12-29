import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const scryptAsync = promisify(scrypt);
const HASH_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const normalizeEmail = (email) => email.trim().toLowerCase();

const hashPassword = async (password) => {
	const salt = randomBytes(SALT_LENGTH).toString("hex");
	const derived = await scryptAsync(password, salt, HASH_KEY_LENGTH);
	return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
};

const prisma = new PrismaClient();

const log = (message) => {
	console.log(`[db:bootstrap] ${message}`);
};

const main = async () => {
	const existingSuperAdmin = await prisma.user.findFirst({
		where: { isSuperAdmin: true },
		select: { id: true },
	});

	if (existingSuperAdmin) {
		log("Super admin already exists. Skipping bootstrap.");
		return;
	}

	const email = process.env.SUPER_ADMIN_EMAIL?.trim();
	const password = process.env.SUPER_ADMIN_PASSWORD;
	if (!email || !password) {
		console.warn(
			"[db:bootstrap] No super admin found and SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD are not set. Skipping bootstrap.",
		);
		return;
	}

	const normalizedEmail = normalizeEmail(email);
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
		const passwordHash = await hashPassword(password);
		await prisma.user.create({
			data: {
				email: normalizedEmail,
				passwordHash,
				isSuperAdmin: true,
				passwordResetRequired: true,
			},
		});
		log(`Created super admin for ${normalizedEmail}.`);
		return;
	}

	const updates = {};
	if (!existing.isSuperAdmin) {
		updates.isSuperAdmin = true;
	}
	if (!existing.passwordHash) {
		updates.passwordHash = await hashPassword(password);
		updates.passwordResetRequired = true;
	}

	if (Object.keys(updates).length > 0) {
		await prisma.user.update({
			where: { id: existing.id },
			data: updates,
		});
		log(`Updated super admin record for ${normalizedEmail}.`);
	} else {
		log(`Super admin record for ${normalizedEmail} already up to date.`);
	}
};

try {
	await main();
} catch (error) {
	console.error("[db:bootstrap] Failed to bootstrap super admin.", error);
	process.exitCode = 1;
} finally {
	await prisma.$disconnect();
}
