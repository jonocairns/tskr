import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

test("archive migration upgrades existing tasks additively and preserves log links and unrelated schema", async () => {
	const directory = mkdtempSync(join(tmpdir(), "tskr-archive-upgrade-"));
	const databaseUrl = `file:${join(directory, "test.db")}`;
	const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
	const migration = readdirSync("prisma/migrations").find((name) => name.endsWith("_archive_assigned_tasks"));
	if (!migration) throw new Error("Archive migration missing");
	const deploy = (config?: string) =>
		execFileSync(
			process.execPath,
			[require.resolve("prisma/build/index.js"), "migrate", "deploy", ...(config ? ["--config", config] : [])],
			{ env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" },
		);
	const unrelatedSchema = () => db.$queryRaw`
		SELECT type, name, tbl_name, sql FROM sqlite_master
		WHERE tbl_name != 'AssignedTask' AND name NOT LIKE 'sqlite_%' ORDER BY type, name`;
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
		await db.presetTask.create({
			data: {
				id: "preset",
				householdId: "home",
				createdById: "creator",
				label: "Bins",
				bucket: "QUICK",
				isShared: true,
			},
		});
		// The generated client knows archivedAt, but the pre-upgrade database does not.
		await db.$executeRaw`INSERT INTO "AssignedTask" ("id", "householdId", "presetId", "assignedToId", "cadenceTarget", "cadenceIntervalMinutes") VALUES ('task', 'home', 'preset', 'creator', 1, 1440)`;
		const log = await db.pointLog.create({
			data: { householdId: "home", userId: "creator", assignedTaskId: "task", description: "Bins", points: 3 },
		});
		const beforeTask = await db.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AssignedTask"`;
		const beforeSchema = await unrelatedSchema();
		const beforeIndexes = await db.$queryRaw<
			Array<{ name: string }>
		>`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'AssignedTask' ORDER BY name`;
		await db.$disconnect();
		deploy();
		expect(await db.$queryRaw`SELECT * FROM "AssignedTask"`).toEqual(
			beforeTask.map((task) => ({ ...task, archivedAt: null })),
		);
		expect(await db.assignedTask.findUniqueOrThrow({ where: { id: "task" } })).toMatchObject({
			archivedAt: null,
			assignedToId: "creator",
		});
		expect(await db.pointLog.findUniqueOrThrow({ where: { id: log.id } })).toEqual(log);
		expect(await unrelatedSchema()).toEqual(beforeSchema);
		const indexes = await db.$queryRaw<
			Array<{ name: string }>
		>`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'AssignedTask' ORDER BY name`;
		expect(indexes).toHaveLength(beforeIndexes.length + 1);
		expect(indexes).toEqual(expect.arrayContaining(beforeIndexes));
		expect(await db.$queryRaw`PRAGMA foreign_key_check`).toEqual([]);
		const sql = readFileSync(join("prisma/migrations", migration, "migration.sql"), "utf8");
		expect(sql).not.toMatch(/DROP|CREATE TABLE|PresetTaskOrder/);
	} finally {
		await db.$disconnect();
		rmSync(directory, { recursive: true, force: true });
	}
}, 30_000);
