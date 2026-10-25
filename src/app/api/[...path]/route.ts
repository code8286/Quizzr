import type { NextRequest } from "next/server";
import { handle } from "@/server/gateway";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{path:string[]}>};
export async function GET(req:NextRequest,ctx:Context){return handle(req,(await ctx.params).path.join("/"));}
export async function POST(req:NextRequest,ctx:Context){return handle(req,(await ctx.params).path.join("/"));}
