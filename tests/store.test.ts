import { expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { transaction,readSnapshot } from "../src/server/store";
import { registerTeam } from "../src/server/engine";
import type { User } from "../src/server/model";
process.env.QUIZ_STORAGE="local";process.env.QUIZ_DATA_DIR=`.data/test-${randomUUID()}`;
const users:User[]=Array.from({length:2},(_,i)=>({id:randomUUID(),registration:`T${i+1}`,name:"Test User",role:"LEADER",passwordHash:"",sessionVersion:1,enrolled:true}));
it("serializes competing roster team claims and rolls back failed changes",async()=>{await transaction(s=>{s.users=users;s.roster=[{number:27,members:users.map(u=>({name:u.name,registration_number:u.registration}))}];});const results=await Promise.allSettled(users.map(u=>transaction(s=>registerTeam(s,u,{members:users.map(u=>({name:u.name,registration_number:u.registration}))},Date.now()))));expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);expect(await transaction(s=>s.teams[0].number)).toBe(27);await expect(transaction(s=>{s.teams=[];throw Error("rollback");})).rejects.toThrow("rollback");expect(await transaction(s=>s.teams.length)).toBe(1);});
it("reads the committed snapshot during a held writer without taking its lock or saving projections",async()=>{
  await transaction(s=>{s.control.closed=false;});
  let enter!:()=>void,release!:()=>void;
  const entered=new Promise<void>(resolve=>{enter=resolve;}),released=new Promise<void>(resolve=>{release=resolve;});
  const writer=transaction(async s=>{s.control.closed=true;enter();await released;});
  await entered;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const closed=await Promise.race([readSnapshot(s=>{const closed=s.control.closed;s.control.version=999;return closed;}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("Reader waited for writer lock")),500);})]);
    expect(closed).toBe(false);
  }finally{if(timer)clearTimeout(timer);release();await writer;}
  expect(await readSnapshot(s=>s.control.closed)).toBe(true);expect(await readSnapshot(s=>s.control.version)).not.toBe(999);
});
