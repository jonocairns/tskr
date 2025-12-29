import { randomBytes, scrypt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const scryptAsync = promisify(scrypt);
const HASH_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const loadEnvFile = (path) => {
	if (!existsSync(path)) {
		return false;
	}
	const contents = readFileSync(path, "utf8");
	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const equalsIndex = line.indexOf("=");
		if (equalsIndex === -1) {
			continue;
		}
		const key = line.slice(0, equalsIndex).trim();
		if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
			continue;
		}
		let value = line.slice(equalsIndex + 1).trim();
		const isQuoted =
			(value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
		if (isQuoted) {
			value = value.slice(1, -1);
		}
		value = value.replace(/\\n/g, "\n");
		process.env[key] = value;
	}
	return true;
};

const envCandidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "prisma/.env")];
for (const candidate of envCandidates) {
	if (loadEnvFile(candidate)) {
		break;
	}
}

const normalizeEmail = (email) => email.trim().toLowerCase();

const hashPassword = async (password) => {
	const salt = randomBytes(SALT_LENGTH).toString("hex");
	const derived = await scryptAsync(password, salt, HASH_KEY_LENGTH);
	return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
};

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

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
