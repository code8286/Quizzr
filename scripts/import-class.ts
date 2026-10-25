import { existsSync } from "node:fs";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { transaction,closeStore } from "../src/server/store";
import { parseRosterCsv } from "../src/server/roster";
import { paperSchema } from "../src/server/engine";
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
async function main(){const [csv,paperFile]=process.argv.slice(2);if(!csv||!paperFile)throw new Error("Usage: npm run class:import -- <team.csv> <private-papers.json>");const roster=parseRosterCsv(await readFile(csv,"utf8")),papers=paperSchema.parse(JSON.parse(await readFile(paperFile,"utf8")));
  await transaction(async s=>{if(s.teams.length||s.attempts.length){if(!s.control.practice||process.env.QUIZ_STORAGE!=="local")throw new Error("An active exam cannot be replaced. Import into a fresh database.");await mkdir(".data/archive",{recursive:true});await writeFile(`.data/archive/practice-before-class-${Date.now()}.json`,JSON.stringify(s),{mode:0o600});s.teams=[];s.attempts=[];s.users=s.users.filter(u=>u.role==="ADMIN");s.users.forEach(u=>u.sessionVersion++);s.audit=[];s.limits={};}
    if((s.roster||[]).length)throw new Error("A roster is already imported. Use a fresh exam for a different roster.");s.roster=roster;s.papers=papers;s.control.released=false;s.control.closed=false;s.control.practice=false;s.control.version++;});
  console.log(`Imported ${roster.length} numbered teams, ${roster.reduce((n,t)=>n+t.members.length,0)} students and 15 questions. Paper content and student identities are not printed.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(closeStore);
