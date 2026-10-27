import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { transaction, closeStore } from "../src/server/store";
import { activeTeams, audit, current, newAttempt } from "../src/server/engine";

async function main() {
  const args=process.argv.slice(2);
  if(args.length!==3||args[0]!=="--env-file"||args[2]!=="--apply")throw Error("Use --env-file <private-environment-file> --apply to reset progress.");
  // Explicitly load the requested target instead of inheriting rehearsal settings.
  process.loadEnvFile(args[1]);
  const report = await transaction(async state => {
    const teams = activeTeams(state), now = Date.now();
    const folder = path.resolve(process.env.QUIZ_DATA_DIR || ".data", "archive");
    await mkdir(folder, { recursive: true });
    const backup = path.join(folder, `before-all-team-reset-${now}-${randomUUID()}.json`);
    await writeFile(backup, JSON.stringify(state), { mode: 0o600, flag: "wx" });
    for (const team of teams) {
      const previous = current(state, team), fresh = newAttempt(team.id);
      fresh.set = previous.set ?? state.roster?.find(r => r.number === team.number)?.set ?? null;
      fresh.paperVersion = previous.paperVersion ?? state.papers.find(p => p.set === fresh.set)?.version ?? null;
      if (previous.state !== "completed") previous.state = "closed";
      previous.revision++;
      state.attempts.push(fresh); team.attemptId = fresh.id;
      audit(state, "operator", "PROGRESS_RESET", JSON.stringify({ previousAttempt: previous.id, attempt: fresh.id, set: fresh.set }), now, team.id);
    }
    state.control.closed = false;
    state.control.version++;
    audit(state, "operator", "ALL_TEAM_PROGRESS_RESET", `${teams.length} registered teams reset; registrations and paper assignments preserved`, now);
    return { target:process.env.QUIZ_STORAGE, teamsReset: teams.length, papersReleased: state.control.released, backup };
  });
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error("Reset did not confirm completion:", (error as { code?: string })?.code || "check storage configuration"); process.exitCode = 1; }).finally(closeStore);
