import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { parseRosterCsv } from "../src/server/roster";
import { applyRosterUpdate, planRosterUpdate } from "../src/server/roster-update";
import { closeStore, transaction } from "../src/server/store";

async function main() {
  const args = process.argv.slice(2), csv = args[0];
  if (!csv || args.slice(1).some(a => a !== "--apply") || args.length > 2)
    throw new Error('Usage: npm run roster:update -- "<team.csv>" [--apply]');
  // Match the existing import tools: explicit process/--env-file settings win.
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const source = await readFile(csv, "utf8"), incoming = parseRosterCsv(source);
  const apply = args.includes("--apply");
  const report = await transaction(async state => {
    const plan = planRosterUpdate(state, incoming);
    if (!apply || !plan.changed || plan.blockedTeams.length) return { plan, backup: null };
    // Validate on a copy before writing a private recovery snapshot, and then
    // mutate under the same database/classroom lock. A failed write rolls back.
    const updated = structuredClone(state);
    applyRosterUpdate(updated, incoming, Date.now());
    const archive = path.resolve(process.env.QUIZ_DATA_DIR || ".data", "archive");
    await mkdir(archive, { recursive: true });
    const backup = path.join(archive, `roster-before-${Date.now()}-${randomUUID()}.json`);
    await writeFile(backup, JSON.stringify(state), { mode: 0o600, flag: "wx" });
    Object.assign(state, updated);
    return { plan, backup };
  });
  console.log(`Target: ${process.env.QUIZ_STORAGE === "postgres" ? "PostgreSQL (DATABASE_URL)" : "local rehearsal"}`);
  console.log(JSON.stringify(report.plan, null, 2));
  if (report.plan.blockedTeams.length) {
    console.log("Blocked: saved registrations in changed teams require a separate history-preserving migration. Nothing was changed.");
    process.exitCode = 1;
  } else if (!report.plan.changed) console.log("Already up to date. Nothing changed.");
  else if (apply) console.log(`Applied. Private recovery snapshot: ${report.backup}`);
  else console.log("Preview only. Run the same command with --apply to save this update.");
}

main().catch((error: unknown) => {
  // Driver errors can contain database credentials. Do not print raw exceptions.
  const code = (error as { code?: unknown })?.code;
  const diagnostic = typeof code === "string" && /^[A-Z0-9_]{2,50}$/.test(code) ? ` (${code})` : "";
  console.error(`Roster update did not confirm completion${diagnostic}. Run the preview to check the database before retrying. Check the CSV and connection; recall papers before adding team numbers. Recovery snapshots stay private in .data/archive.`);
  process.exitCode = 1;
}).finally(closeStore);
