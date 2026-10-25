import { expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { transaction } from "../src/server/store";
import { registerTeam } from "../src/server/engine";
import type { User } from "../src/server/model";
process.env.QUIZ_STORAGE="local";process.env.QUIZ_DATA_DIR=`.data/test-${randomUUID()}`;
const users:User[]=Array.from({length:2},(_,i)=>({id:randomUUID(),registration:`T${i+1}`,name:"Test User",role:"LEADER",passwordHash:"",sessionVersion:1,enrolled:true}));
it("serializes competing roster team claims and rolls back failed changes",async()=>{await transaction(s=>{s.users=users;s.roster=[{number:27,members:users.map(u=>({name:u.name,registration_number:u.registration}))}];});const results=await Promise.allSettled(users.map(u=>transaction(s=>registerTeam(s,u,{members:users.map(u=>({name:u.name,registration_number:u.registration}))},Date.now()))));expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);expect(await transaction(s=>s.teams[0].number)).toBe(27);await expect(transaction(s=>{s.teams=[];throw Error("rollback");})).rejects.toThrow("rollback");expect(await transaction(s=>s.teams.length)).toBe(1);});
