import { watchdog,errorResponse } from "@/server/gateway";
import type { NextRequest } from "next/server";
export const runtime="nodejs";
export async function GET(req:NextRequest){try{return await watchdog(req);}catch(e){return errorResponse(e);}}
