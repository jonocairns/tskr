const { randomBytes, scrypt } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { promisify } = require("node:util");

const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");

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
		if (!key || Object.hasOwn(process.env, key)) {
			continue;
		}
		let value = line.slice(equalsIndex + 1).trim();
		const isQuoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
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
const cleanEnvValue = (value) => {
	if (!value) {
		return undefined;
	}
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
};

const generatePassword = () => randomBytes(12).toString("base64url");

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
	const fallbackEmail = "admin@tskr.com";
	const envEmail = cleanEnvValue(process.env.SUPER_ADMIN_EMAIL);
	const forceRotate = cleanEnvValue(process.env.SUPER_ADMIN_FORCE_PASSWORD) === "1";

	if (!envEmail) {
		const existingSuperAdmin = await prisma.user.findFirst({
			where: { isSuperAdmin: true },
			select: { id: true },
		});

		if (existingSuperAdmin && !forceRotate) {
			log("Super admin already exists. Skipping bootstrap.");
			return;
		}

		log(`SUPER_ADMIN_EMAIL not set; using ${fallbackEmail}.`);
	}

	const normalizedEmail = normalizeEmail(envEmail || fallbackEmail);
	const existing = await prisma.user.findUnique({
		where: { email: normalizedEmail },
		select: {
			id: true,
			isSuperAdmin: true,
			passwordLoginDisabled: true,
			passwordHash: true,
			passwordResetRequired: true,
		},
	});

	const updates = {
		isSuperAdmin: true,
		passwordLoginDisabled: false,
	};

	let generatedPassword;
	if (!existing || forceRotate || !existing.passwordHash) {
		generatedPassword = generatePassword();
		updates.passwordHash = await hashPassword(generatedPassword);
		updates.passwordResetRequired = true;
	}

	if (!existing) {
		await prisma.user.create({
			data: {
				email: normalizedEmail,
				...updates,
			},
		});
		log(`Created super admin for ${normalizedEmail}.`);
	} else {
		await prisma.user.update({
			where: { id: existing.id },
			data: updates,
		});
		log(`Updated super admin record for ${normalizedEmail}.`);
	}

	if (generatedPassword) {
		log(`Temporary password: ${generatedPassword}`);
	} else {
		log("Temporary password unchanged. Set SUPER_ADMIN_FORCE_PASSWORD=1 to rotate it.");
	}
};

void (async () => {
	try {
		await main();
	} catch (error) {
		console.error("[db:bootstrap] Failed to bootstrap super admin.", error);
		process.exitCode = 1;
	} finally {
		await prisma.$disconnect();
	}
})();
