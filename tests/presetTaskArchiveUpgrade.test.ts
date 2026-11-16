import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

test("Quick log archive migration preserves tasks, orders, logs and unrelated schema", async () => {
	const directory = mkdtempSync(join(tmpdir(), "tskr-archive-upgrade-"));
	const databaseUrl = `file:${join(directory, "test.db")}`;
	const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
	const migration = readdirSync("prisma/migrations").find((name) => name.endsWith("_archive_preset_tasks"));
	if (!migration) throw new Error("Archive migration missing");
	const deploy = (config?: string) =>
		execFileSync(
			process.execPath,
			[require.resolve("prisma/build/index.js"), "migrate", "deploy", ...(config ? ["--config", config] : [])],
			{ env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" },
		);
	const unrelatedSchema = () => db.$queryRaw`
		SELECT type, name, tbl_name, sql FROM sqlite_master
		WHERE tbl_name != 'PresetTask' AND name NOT LIKE 'sqlite_%' ORDER BY type, name`;
	const presetTaskIndexes = () => db.$queryRaw`
		SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'PresetTask' ORDER BY name`;
	try {
		const oldMigrations = join(directory, "migrations");
		mkdirSync(oldMigrations);
		for (const name of readdirSync("prisma/migrations")) {
			if (name < migration || name === "migration_lock.toml")
				cpSync(join("prisma/migrations", name), join(oldMigrations, name), { recursive: true });
		}
		const config = join(directory, "prisma.config.ts");
		writeFileSync(
			config,
			`export default ${JSON.stringify({ schema: resolve("prisma/schema.prisma"), migrations: { path: oldMigrations }, datasource: { url: databaseUrl } })};`,
		);
		deploy(config);
		await db.user.create({ data: { id: "creator" } });
		await db.household.create({ data: { id: "home", name: "Home", createdById: "creator" } });

		await db.$executeRaw`INSERT INTO "PresetTask" ("id", "householdId", "createdById", "label", "bucket", "isShared", "updatedAt") VALUES ('preset', 'home', 'creator', 'Bins', 'QUICK', true, CURRENT_TIMESTAMP)`;
		await db.assignedTask.create({
			data: {
				id: "task",
				householdId: "home",
				presetId: "preset",
				assignedToId: "creator",
				cadenceTarget: 1,
				cadenceIntervalMinutes: 1440,
			},
		});
		await db.presetTaskOrder.create({
			data: { householdId: "home", userId: "creator", presetId: "preset", sortOrder: 2 },
		});
		const beforeTasks = await db.assignedTask.findMany();
		const beforeOrders = await db.presetTaskOrder.findMany();
		const log = await db.pointLog.create({
			data: {
				householdId: "home",
				userId: "creator",
				presetId: "preset",
				assignedTaskId: "task",
				description: "Bins",
				points: 3,
			},
		});
		const beforeTask = await db.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "PresetTask"`;
		const beforeSchema = await unrelatedSchema();
		const beforeIndexes = await presetTaskIndexes();
		await db.$disconnect();
		deploy();
		expect(await db.$queryRaw`SELECT * FROM "PresetTask"`).toEqual(
			beforeTask.map((task) => ({ ...task, archivedAt: null })),
		);

		expect(await db.assignedTask.findMany()).toEqual(beforeTasks);
		expect(await db.presetTaskOrder.findMany()).toEqual(beforeOrders);
		expect(await db.pointLog.findUniqueOrThrow({ where: { id: log.id } })).toEqual(log);
		expect(await unrelatedSchema()).toEqual(beforeSchema);
		expect(await presetTaskIndexes()).toEqual(beforeIndexes);
		expect(await db.$queryRaw`PRAGMA foreign_key_check`).toEqual([]);
		const sql = readFileSync(join("prisma/migrations", migration, "migration.sql"), "utf8");
		expect(sql).not.toMatch(/DROP|CREATE|PRAGMA|PresetTaskOrder|AssignedTask/);
	} finally {
		await db.$disconnect();
		rmSync(directory, { recursive: true, force: true });
	}
}, 30_000);
