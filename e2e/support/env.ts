import { tmpdir } from "node:os";
import { join } from "node:path";

export const PORT = Number(process.env.E2E_PORT ?? 3210);
export const BASE_URL = `http://127.0.0.1:${PORT}`;

// Throwaway database, recreated by the web server command on every run.
export const DB_DIR = join(tmpdir(), `tskr-e2e-${PORT}`);
export const DB_PATH = join(DB_DIR, "e2e.db");
export const DATABASE_URL = `file:${DB_PATH}`;

export const PASSWORD = "e2e-Password-123";

// Accounts seeded by global setup. Households are created per test, so these
// users can be shared while every test still works on isolated data.
export const USERS = {
	member: { email: "member@e2e.test", name: "Morgan Member" },
	approver: { email: "approver@e2e.test", name: "Avery Approver" },
	signIn: { email: "signin@e2e.test", name: "Sam SignIn" },
} as const;

export type SeededUser = keyof typeof USERS;

// Signed-in browser state, written by auth.setup.ts and reused by specs. Logging
// in once per account keeps the suite below the login rate limit.
export const AUTH_STATE = {
	member: join(import.meta.dirname, "..", ".auth", "member.json"),
	approver: join(import.meta.dirname, "..", ".auth", "approver.json"),
} as const;
