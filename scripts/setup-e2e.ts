import { mkdir,writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { emptyState } from "../src/server/model";
import { hashPassword } from "../src/server/security";
import { practicePapers } from "./practice-papers";
async function prepare(){const s=emptyState();s.control.practice=true;s.control.monitoring=false;s.papers=structuredClone(practicePapers);s.papers.find(p=>p.set===1&&p.module===1)!.hints=[{text:"First test hint",deduction:.5},{text:"Second test hint",deduction:1},{text:"Final test hint",deduction:2}];s.users=[{id:randomUUID(),registration:"ADMIN",name:"Administrator",passwordHash:hashPassword("TestAdmin!2026"),role:"ADMIN",sessionVersion:0,enrolled:true}];s.roster=Array.from({length:11},(_,i)=>({number:i+1,members:Array.from({length:i===0?7:2},(_,j)=>({name:`Roster Name ${j+1}`,registration_number:`T${i+1}M${j+1}`}))}));await mkdir(".data/e2e",{recursive:true});await writeFile(".data/e2e/quiz.json",JSON.stringify(s));}
prepare().catch(e=>{console.error(e);process.exitCode=1;});
