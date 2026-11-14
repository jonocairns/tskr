import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { type HouseholdRole, PrismaClient } from "@prisma/client";

import { BUCKET_POINTS, type DurationKey } from "../../src/lib/points";
import { DATABASE_URL, type SeededUser, USERS } from "./env";

const scryptAsync = promisify(scrypt);

let client: PrismaClient | undefined;

export const getPrisma = () => {
	client ??= new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: DATABASE_URL }) });
	return client;
};

export const disconnectPrisma = async () => {
	await client?.$disconnect();
	client = undefined;
};

// Same format as the app and scripts/db-bootstrap.cjs: scrypt$<saltHex>$<derivedHex>.
export const hashPassword = async (password: string) => {
	const salt = randomBytes(16).toString("hex");
	const derived = (await scryptAsync(password, salt, 64)) as Buffer;
	return `scrypt$${salt}$${derived.toString("hex")}`;
};

const getUserId = async (user: SeededUser) => {
	const { id } = await getPrisma().user.findUniqueOrThrow({
		where: { email: USERS[user].email },
		select: { id: true },
	});
	return id;
};

type MemberSeed<U extends SeededUser = SeededUser> = {
	user: U;
	role: HouseholdRole;
	requiresApproval?: boolean;
};

// Each test gets a brand-new household, so tests (and CI retries) never share
// points, logs or presets even though they reuse the same signed-in accounts.
export const createHousehold = async <U extends SeededUser>(members: MemberSeed<U>[]) => {
	const prisma = getPrisma();
	const memberIds = await Promise.all(members.map(({ user }) => getUserId(user)));
	const household = await prisma.household.create({
		data: {
			name: `E2E ${randomUUID().slice(0, 8)}`,
			createdById: memberIds[0],
			members: {
				create: members.map((member, index) => ({
					userId: memberIds[index],
					role: member.role,
					requiresApprovalDefault: member.requiresApproval ?? false,
				})),
			},
		},
	});
	// Make it each member's active household, so signing in redirects here even
	// when an earlier attempt (retry or repeat) left the user in other households.
	await prisma.user.updateMany({ where: { id: { in: memberIds } }, data: { lastHouseholdId: household.id } });
	const userIds = Object.fromEntries(members.map(({ user }, index) => [user, memberIds[index]])) as Record<U, string>;
	return { householdId: household.id, userIds };
};

export const createPreset = async ({
	householdId,
	createdById,
	label,
	bucket,
}: {
	householdId: string;
	createdById: string;
	label: string;
	bucket: DurationKey;
}) => {
	const preset = await getPrisma().presetTask.create({
		data: { householdId, createdById, label, bucket, isShared: true },
	});
	return { presetId: preset.id, points: BUCKET_POINTS[bucket] };
};

export const createApprovedLog = async ({
	householdId,
	userId,
	description,
	bucket,
	points = BUCKET_POINTS[bucket],
}: {
	householdId: string;
	userId: string;
	description: string;
	bucket: DurationKey;
	points?: number;
}) => {
	await getPrisma().pointLog.create({
		data: {
			householdId,
			userId,
			kind: "PRESET",
			duration: bucket,
			points,
			description,
			status: "APPROVED",
		},
	});
};

export const createAssignment = async ({
	householdId,
	presetId,
	assignedToId,
	assignedById,
}: {
	householdId: string;
	presetId: string;
	assignedToId: string;
	assignedById: string;
}) => {
	await getPrisma().assignedTask.create({
		data: {
			householdId,
			presetId,
			assignedToId,
			assignedById,
			cadenceTarget: 1,
			cadenceIntervalMinutes: 7 * 24 * 60,
			isRecurring: false,
		},
	});
};
