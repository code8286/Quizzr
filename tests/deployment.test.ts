import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { checkDeploymentDatabase, type DeploymentQuery } from "../scripts/deployment-database";
import { practicePapers } from "../scripts/practice-papers";
import { hashPassword } from "../src/server/security";

let db: PGlite;
const query: DeploymentQuery = async <Row extends Record<string, unknown>>(sql: string) => (await db.query<Row>(sql)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const file of ["001_portal.sql", "002_watchdog.sql", "003_forty_minute_limit.sql", "004_roster_and_unlimited_members.sql", "005_module_start_and_portal_registration.sql", "006_sixty_second_heartbeat.sql", "007_concurrent_heartbeats.sql"])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const paper of practicePapers)
    await db.query("insert into quiz_private.papers values($1,$2,$3,$4,$5)", [paper.id, paper.set, paper.module, paper.version, JSON.stringify(paper)]);
  await db.query("insert into quiz_private.roster_teams values(1,'{}')");
  await db.query("insert into quiz_private.roster_students values('TEST001',1)");
  const admin = { id: randomUUID(), registration: "PRIVATE_ADMIN", name: "Admin", role: "ADMIN", passwordHash: hashPassword(randomBytes(32).toString("hex")), sessionVersion: 0, enrolled: true };
  await db.query("insert into quiz_private.profiles values($1,$2,'ADMIN',$3)", [admin.id, admin.registration, JSON.stringify(admin)]);
  // pg_cron itself runs only on the hosted database. Model its catalog to exercise the launch query.
  await db.exec("create schema cron; create table cron.job(schedule text, command text, active boolean);");
  await db.query("insert into cron.job values('1 second','SELECT quiz_private.watchdog();',true)");
}, 30000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db?.close(); });

it("checks the complete migrated deployment in a read-only transaction", async () => {
  await db.exec("set transaction read only");
  await expect(checkDeploymentDatabase(query)).resolves.toBeUndefined();
});

it("blocks a practice deployment or incomplete papers", async () => {
  await db.exec("update quiz_private.control set body=body || '{\"practice\":true}'::jsonb where id=1");
  await expect(checkDeploymentDatabase(query)).rejects.toThrow("practice mode");
  await db.exec("update quiz_private.control set body=body || '{\"practice\":false}'::jsonb where id=1");
  await db.exec("delete from quiz_private.papers where id=(select id from quiz_private.papers limit 1)");
  await expect(checkDeploymentDatabase(query)).rejects.toThrow("all 15");
});

it("blocks browser grants even when row-level security is enabled", async () => {
  await db.exec("grant usage on schema quiz_private to authenticated");
  await expect(checkDeploymentDatabase(query)).rejects.toThrow("Revoke browser-role access");
});

it("blocks the documented public administrator password", async () => {
  await db.query("update quiz_private.profiles set body=jsonb_set(body,'{passwordHash}',to_jsonb($1::text))", [hashPassword("PracticeAdmin!2026")]);
  await expect(checkDeploymentDatabase(query)).rejects.toThrow("administrator password");
});

it("blocks an absent, slow or duplicate watchdog schedule", async () => {
  await db.exec("update cron.job set active=false");
  await expect(checkDeploymentDatabase(query)).rejects.toThrow("exactly one active watchdog");
  await db.exec("update cron.job set active=true, schedule='* * * * *'");
  await expect(checkDeploymentDatabase(query)).rejects.toThrow("'1 second'");
  await db.exec("update cron.job set schedule='1 second'; insert into cron.job select * from cron.job");
  await expect(checkDeploymentDatabase(query)).rejects.toThrow("exactly one active watchdog");
});
