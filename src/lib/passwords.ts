import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const HASH_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const hashPassword = async (password: string) => {
	const salt = randomBytes(SALT_LENGTH).toString("hex");
	const derived = (await scryptAsync(password, salt, HASH_KEY_LENGTH)) as Buffer;
	return `scrypt$${salt}$${derived.toString("hex")}`;
};

export const verifyPassword = async (password: string, storedHash: string) => {
	const [scheme, salt, hash] = storedHash.split("$");
	if (scheme !== "scrypt" || !salt || !hash) {
		return false;
	}
	const storedBuffer = Buffer.from(hash, "hex");
	const derived = (await scryptAsync(password, salt, storedBuffer.length)) as Buffer;
	return timingSafeEqual(storedBuffer, derived);
};
