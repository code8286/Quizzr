import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Actor } from "./model";
import { AppError } from "./engine";
const cookie="quiz_session";
function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw new Error("Set SESSION_SECRET to at least 32 random characters.");return new TextEncoder().encode(s);}
export async function actor():Promise<Actor>{
  const token=(await cookies()).get(cookie)?.value;
  if(!token)throw new AppError(401,"UNAUTHENTICATED","Please sign in to continue.");
  try {const {payload}=await jwtVerify(token,secret(),{algorithms:["HS256"],issuer:"mathematics-quiz-3",audience:"quiz-portal"});
    if(typeof payload.sub!=="string"||typeof payload.v!=="number"||typeof payload.sid!=="string")throw new Error("Invalid session");
    return {id:payload.sub,version:payload.v,sid:payload.sid};
  }catch{throw new AppError(401,"UNAUTHENTICATED","Your session has expired. Sign in again.");}
}
export async function setSession(a:Actor){
  const token=await new SignJWT({v:a.version,sid:a.sid}).setProtectedHeader({alg:"HS256"}).setSubject(a.id).setIssuer("mathematics-quiz-3").setAudience("quiz-portal").setIssuedAt().setExpirationTime("8h").sign(secret());
  (await cookies()).set(cookie,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:8*3600});
}
export async function clearSession(){(await cookies()).set(cookie,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});}
