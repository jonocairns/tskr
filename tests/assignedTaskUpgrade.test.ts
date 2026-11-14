import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

test("nullable-assignee migration preserves seeded tasks, log links, indexes and unrelated schema", async () => {
	const directory = mkdtempSync(join(tmpdir(), "tskr-board-upgrade-"));
	const sourceUrl = `file:${join(directory, "seed.db")}`;
	const copyUrl = `file:${join(directory, "copy.db")}`;
	const source = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: sourceUrl }) });
	const upgraded = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: copyUrl }) });
	const deploy = (url: string, config?: string) =>
		execFileSync(
			process.execPath,
			[require.resolve("prisma/build/index.js"), "migrate", "deploy", ...(config ? ["--config", config] : [])],
			{
				env: { ...process.env, DATABASE_URL: url },
				stdio: "pipe",
			},
		);
	const unrelatedSchema = (db: PrismaClient) => db.$queryRaw`
		SELECT type, name, tbl_name, sql FROM sqlite_master
		WHERE tbl_name != 'AssignedTask' AND name NOT LIKE 'sqlite_%' ORDER BY type, name`;
	const taskIndexes = (db: PrismaClient) => db.$queryRaw`
		SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'AssignedTask' ORDER BY name`;
	try {
		const oldMigrations = join(directory, "migrations");
		mkdirSync(oldMigrations);
		for (const name of readdirSync("prisma/migrations")) {
			if (name !== "20261114203610_shared_task_board_nullable_assignee") {
				cpSync(join("prisma/migrations", name), join(oldMigrations, name), { recursive: true });
			}
		}
		const configPath = join(directory, "prisma.config.ts");
		writeFileSync(
			configPath,
			`export default ${JSON.stringify({ schema: resolve("prisma/schema.prisma"), migrations: { path: oldMigrations }, datasource: { url: sourceUrl } })};`,
		);
		deploy(sourceUrl, configPath);
		await source.user.createMany({ data: [{ id: "creator" }, { id: "assignee" }] });
		await source.household.create({ data: { id: "home", name: "Home", createdById: "creator" } });
		await source.presetTask.create({
			data: {
				id: "preset",
				householdId: "home",
				createdById: "creator",
				label: "Bins",
				bucket: "QUICK",
				isShared: true,
			},
		});
		for (const [id, isRecurring] of [
			["recurring", true],
			["one-off", false],
		] as const) {
			await source.assignedTask.create({
				data: {
					id,
					householdId: "home",
					presetId: "preset",
					assignedToId: "assignee",
					assignedById: "creator",
					cadenceTarget: 1,
					cadenceIntervalMinutes: 1440,
					isRecurring,
				},
			});
			await source.pointLog.create({
				data: {
					householdId: "home",
					userId: "assignee",
					presetId: "preset",
					assignedTaskId: id,
					points: 3,
					description: "Bins",
					status: "PENDING",
				},
			});
		}
		const tasks = await source.assignedTask.findMany({ orderBy: { id: "asc" } });
		const logs = await source.pointLog.findMany({ orderBy: { id: "asc" } });
		const linkedCount = await source.pointLog.count({ where: { assignedTaskId: { not: null } } });
		const indexes = await taskIndexes(source);
		const schema = await unrelatedSchema(source);
		await source.$disconnect();
		cpSync(join(directory, "seed.db"), join(directory, "copy.db"));
		deploy(copyUrl);
		expect(await upgraded.assignedTask.findMany({ orderBy: { id: "asc" } })).toEqual(tasks);
		expect(await upgraded.pointLog.findMany({ orderBy: { id: "asc" } })).toEqual(logs);
		expect(await upgraded.pointLog.count({ where: { assignedTaskId: { not: null } } })).toBe(linkedCount);
		expect(await taskIndexes(upgraded)).toEqual(indexes);
		expect(await unrelatedSchema(upgraded)).toEqual(schema);
		expect(await upgraded.$queryRaw`PRAGMA foreign_key_check`).toEqual([]);
	} finally {
		await source.$disconnect();
		await upgraded.$disconnect();
		rmSync(directory, { recursive: true, force: true });
	}
}, 30_000);
