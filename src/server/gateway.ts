import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { ZodError } from "zod";
import { transaction, readSnapshot, recordHeartbeat } from "./store";
import { projectReadState } from "./heartbeat";
import { actor,clearSession,setSession } from "./session";
import { AppError,authenticate,assert,adminCommand,adminView,getQuestion,login,signup,ownTeam,quizCommand,registerTeam,result,studentView,sweep,throttle } from "./engine";
import type { Actor,State } from "./model";
const headers={"Cache-Control":"no-store, max-age=0"};
export function errorResponse(e:unknown){
  const requestId=randomUUID();
  if(e instanceof AppError)return NextResponse.json({code:e.code,message:e.message,requestId},{status:e.status,headers});
  if(e instanceof ZodError)return NextResponse.json({code:"INVALID_INPUT",message:e.issues[0]?.message||"Invalid input.",requestId},{status:422,headers});
  console.error("Portal request failed",requestId,e instanceof Error ? e.message : "Unknown error");
  return NextResponse.json({code:"SERVER_ERROR",message:"The portal could not complete this request. Check the server configuration or try again.",requestId},{status:500,headers});
}
function checkOrigin(req:NextRequest){
  const origin=req.headers.get("origin"),expected=process.env.APP_ORIGIN;
  if(process.env.NODE_ENV==="production"&&!expected)throw new Error("APP_ORIGIN is required in production.");
  assert(origin===(expected || req.nextUrl.origin),"Request origin is not allowed.",403,"ORIGIN_DENIED");
  assert(req.headers.get("content-type")?.startsWith("application/json"),"Use JSON request bodies.",415);
}
async function body(req:NextRequest){
  assert(Number(req.headers.get("content-length")||0)<=1048576,"Request is too large.",413);
  const text=await req.text();assert(Buffer.byteLength(text)<=1048576,"Request is too large.",413);
  try{const data=JSON.parse(text || "{}");assert(data&&typeof data==="object"&&!Array.isArray(data),"Use a JSON object.",422);return data;}catch(e){if(e instanceof AppError)throw e;throw new AppError(422,"INVALID_JSON","Enter valid JSON.");}
}
export async function viewForActor(a:Actor){return readSnapshot(s=>{const now=Date.now();projectReadState(s,now);const u=authenticate(s,a);return u.role==="ADMIN"?adminView(s,now):studentView(s,u,now);});}
function routeCommand(s:State,a:Actor,path:string,method:string,data:unknown,req:NextRequest,now:number){
  const admin=path.startsWith("admin/");const u=authenticate(s,a,admin);
  if(path==="auth/logout"){u.sessionVersion++;return {ok:true};}
  if(path==="auth/me")return {user:{name:u.name,registration:u.registration,role:u.role}};
  if(path==="quiz/status")return studentView(s,u,now);
  if(path==="admin/live-dashboard")return adminView(s,now);
  if(path==="admin/export")return {exportedAt:new Date(now).toISOString(),practice:s.control.practice,teams:s.teams.map(t=>({number:t.number,members:t.members,registrationClearedAt:t.registrationClearedAt||null,registrationHistory:t.registrations||[],currentAttempt:t.attemptId,attempts:s.attempts.filter(a=>a.teamId===t.id).map(a=>({id:a.id,set:a.set,state:a.state,startedAt:a.startedAt,completedAt:a.completedAt,completionReason:a.completionReason||null,timeLimitMinutes:40,total:a.total,questions:a.progress.map(p=>({module:p.module,submittedKey:p.submittedKey||null,correct:p.solved,attempts:p.attempts,hintsUsed:p.hints.length,deducted:p.deducted,marks:p.marks}))}))}))};
  if(path==="quiz/question"){
    const module=Number(req.nextUrl.searchParams.get("module"));assert(Number.isInteger(module)&&module>=1&&module<=5,"Invalid module.",422);return getQuestion(s,u,module,now);
  }
  if(path==="quiz/result")return result(s,u);
  if(method==="GET")throw new AppError(404,"NOT_FOUND","Endpoint not found.");
  if(path==="team/register")return registerTeam(s,u,data,now);
  if(path.startsWith("admin/"))return adminCommand(s,u,path.slice(6),data,now);
  if(path.startsWith("quiz/")){assert(u.role==="LEADER","Student access required.",403);ownTeam(s,u);return quizCommand(s,u,a,path.slice(5),data,now);}
  throw new AppError(404,"NOT_FOUND","Endpoint not found.");
}
export async function handle(req:NextRequest,path:string){
  try{
    const method=req.method;if(method==="POST")checkOrigin(req);
    const reads=["health","auth/me","quiz/status","quiz/question","quiz/result","admin/live-dashboard","admin/export"];
    if(method==="GET"&&!reads.includes(path))throw new AppError(405,"METHOD_NOT_ALLOWED","This endpoint requires POST.");
    if(method==="POST"&&reads.includes(path))throw new AppError(405,"METHOD_NOT_ALLOWED","This endpoint requires GET.");
    if(path==="health"&&method==="GET")return NextResponse.json({ok:true},{headers});
    const data=method==="POST"?await body(req):{};
    if((path==="auth/login"||path==="auth/signup"||path==="admin/login")&&method==="POST"){
      // Persistent throttling also counts failed credential checks. Untrusted forwarding
      // headers are not used as the sole limiter; a global ceiling bounds distributed abuse.
      const out=await transaction(s=>{
        const now=Date.now();throttle(s,"login:global",100,60000,now);
        const b=data as Record<string,unknown>;const identifier=String(b.registration_id || b.admin_username || "").trim().toUpperCase().slice(0,50);
        try{throttle(s,`login:${identifier}`,8,60000,now);const draft=structuredClone(s);const session=path==="auth/signup"?signup(draft,data,now):login(draft,data,path==="admin/login",now);Object.assign(s,draft);return {session};}
        catch(error){return {error};}
      });
      if(out.error)throw out.error;assert(out.session,"Login failed.",401);await setSession(out.session);return NextResponse.json({role:out.session.role},{headers});
    }
    const a=await actor();
    if(method==="GET"){
      const value=await readSnapshot(s=>{const now=Date.now();projectReadState(s,now);return routeCommand(s,a,path,method,data,req,now);});
      return NextResponse.json(value,{headers});
    }
    if(path==="quiz/heartbeat"){
      const out=await recordHeartbeat(a,data);if(out.error)throw out.error;
      return NextResponse.json(out.value,{headers});
    }
    const studentWrite=path.startsWith("quiz/")||path==="team/register";
    const out=await transaction(s=>{
      const now=Date.now();
      try{const u=authenticate(s,a);if(studentWrite)assert(u.role==="LEADER","Student access required.",403);
        sweep(s,now,u.role==="LEADER"?s.teams.find(t=>t.leaderId===u.id&&t.registrationClearedAt===undefined)?.id||"no-team":undefined);
        if(method==="POST")throttle(s,`actions:${a.id}`,180,60000,now);
        const draft=structuredClone(s);const value=routeCommand(draft,a,path,method,data,req,now);Object.assign(s,draft);return {value};
      }catch(error){return {error};}
    },studentWrite?{leaderId:a.id}:undefined);
    if(out.error)throw out.error;if(path==="auth/logout")await clearSession();
    return NextResponse.json(out.value,{headers});
  }catch(e){return errorResponse(e);}
}
export async function watchdog(req:NextRequest){
  const expected=process.env.CRON_SECRET,provided=req.headers.get("authorization")?.replace(/^Bearer /,"");
  if(!expected||!provided||Buffer.byteLength(expected)!==Buffer.byteLength(provided)||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return NextResponse.json({message:"Unauthorized"},{status:401,headers});
  await transaction(s=>sweep(s,Date.now()));return NextResponse.json({ok:true},{headers});
}
