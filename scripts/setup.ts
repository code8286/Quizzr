import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { transaction,closeStore } from "../src/server/store";
import { hashPassword } from "../src/server/security";
import { paperSchema } from "../src/server/engine";
import { practicePapers } from "./practice-papers";
import type { State } from "../src/server/model";

if(existsSync(".env.local"))process.loadEnvFile(".env.local");
const mode=process.argv[2];
async function main(){
  if(mode==="demo") {
    if(process.env.QUIZ_STORAGE==="postgres" || process.env.DATABASE_URL)throw new Error("Demo setup refuses to modify a configured database.");
    if(!existsSync(".env.local"))await writeFile(".env.local",`QUIZ_STORAGE=local\nSESSION_SECRET=${randomBytes(48).toString("base64url")}\nAPP_ORIGIN=http://127.0.0.1:3000\nHEARTBEAT_TIMEOUT_MS=60000\n`);
    process.loadEnvFile(".env.local");
    await transaction(s=>{
      if(s.users.length || s.teams.length)throw new Error("A portal already exists. Demo setup never overwrites data.");
      s.control.practice=true;s.control.monitoring=false;s.papers=practicePapers;
      const user=(registration:string,name:string,password:string,admin=false)=>({id:randomUUID(),registration,name,passwordHash:hashPassword(password),role:admin?"ADMIN" as const:"LEADER" as const,sessionVersion:0,enrolled:admin});
      s.users.push(user("ADMIN","Quiz administrator","PracticeAdmin!2026",true));
      s.roster=Array.from({length:12},(_,i)=>({number:i+1,members:[{registration_number:`MA${String(i+1).padStart(3,"0")}`,name:"First Practice Member"},{registration_number:`MB${String(i+1).padStart(3,"0")}`,name:"Second Practice Member"}]}));
    });
    console.log("Practice portal ready. Admin: ADMIN / PracticeAdmin!2026. Leaders sign up with MA001–MA012 or MB001–MB012 and a name. Each numbered practice team has one MA and one MB member. Monitoring starts OFF. Do not deploy public practice admin credentials.");
  } else if(mode==="admin") {
    const rl=createInterface({input:process.stdin,output:process.stdout});
    const username=(await rl.question("Admin username: ")).trim().toUpperCase();
    const password=await rl.question("Admin password (at least 12 characters; input is visible): ");rl.close();
    if(!/^[A-Z0-9_-]{2,50}$/.test(username)||password.length<12)throw new Error("Invalid username or password too short.");
    await transaction(s=>{if(s.users.some(u=>u.registration===username))throw new Error("Username already exists.");s.users.push({id:randomUUID(),registration:username,name:"Quiz administrator",role:"ADMIN",passwordHash:hashPassword(password),sessionVersion:0,enrolled:true});});
    console.log("Administrator created. Import the numbered roster and papers before leaders sign up.");
  } else if(mode==="papers") {
    const file=process.argv[3];if(!file)throw new Error("Usage: npm run papers:import -- <private-paper-file.json>");
    const papers=paperSchema.parse(JSON.parse(await readFile(file,"utf8")));
    await transaction((s:State)=>{if(s.attempts.length)throw new Error("Paper import is blocked once attempts exist. Use a fresh exam database.");s.papers=papers;s.control.practice=false;});
    console.log("Validated and imported 15 questions. Paper content is not printed.");
  }else throw new Error("Choose demo, admin, or papers.");
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(closeStore);
