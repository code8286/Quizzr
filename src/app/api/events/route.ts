import { actor } from "@/server/session";
import { errorResponse,viewForActor } from "@/server/gateway";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
export async function GET(req:Request){
  try{
    const a=await actor();await viewForActor(a);
    const encoder=new TextEncoder();
    const stream=new ReadableStream({async start(controller){
      const deadline=Date.now()+24000;
      try {while(Date.now()<deadline&&!req.signal.aborted){const view=await viewForActor(a);controller.enqueue(encoder.encode(`data: ${JSON.stringify(view)}\n\n`));await new Promise(r=>setTimeout(r,2000));}}
      catch{try{controller.enqueue(encoder.encode("event: reconnect\ndata: {}\n\n"));}catch{/* Disconnected. */}}
      finally{try{controller.close();}catch{/* Cancelled. */}}
    }});
    return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"}});
  }catch(e){return errorResponse(e);}
}
