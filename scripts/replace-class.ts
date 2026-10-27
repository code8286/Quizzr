import postgres from "postgres";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseRosterCsv } from "../src/server/roster";
import { replaceClass } from "./class-replacement";

async function main(){
  const args=process.argv.slice(2);
  if(args.length!==5||args[0]!=="--env-file"||args[2]!=="--csv"||args[4]!=="--apply")throw Error("Use --env-file <private-env> --csv <new-class.csv> --apply.");
  process.loadEnvFile(args[1]);
  if(process.env.QUIZ_STORAGE!=="postgres"||!process.env.DATABASE_URL)throw Error("Explicit PostgreSQL configuration is required.");
  const roster=parseRosterCsv(await readFile(args[3],"utf8")),label=path.basename(args[3]);
  const db=postgres(process.env.DATABASE_URL,{max:1,prepare:false,ssl:"require",connect_timeout:10});
  let backupFile:string|undefined;
  try{
    await db.unsafe(await readFile("supabase/migrations/008_class_archives.sql","utf8"));
    const result=await db.begin(tx=>replaceClass(async(sql,params)=>(await tx.unsafe(sql,params as Parameters<typeof tx.unsafe>[1])) as unknown as Record<string,unknown>[],roster,label,async(archive,id)=>{
      const folder=path.resolve(".data/archive");await mkdir(folder,{recursive:true});backupFile=path.join(folder,`previous-class-${id}.json`);
      await writeFile(backupFile,JSON.stringify(archive),{mode:0o600,flag:"wx"});
    }));
    console.log(JSON.stringify({target:"Supabase PostgreSQL",...result,backupFile}));
  }finally{await db.end();}
}
main().catch(error=>{console.error("Class replacement did not confirm completion:",(error as {code?:string})?.code||"validation/backup/connection check failed; verify the active roster before retrying");process.exitCode=1;});
