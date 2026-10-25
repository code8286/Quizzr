"use client";
import { useEffect,useRef } from "react";
import type { StudentView } from "@/contracts/types";
import { api } from "./api";
export function useMonitoring(view:StudentView|null,onUpdate:(s:StudentView)=>void,onError:(s:string)=>void){
  const update=useRef(onUpdate),error=useRef(onError);update.current=onUpdate;error.current=onError;
  const active=view?.attempt?.state==="active"&&view.attempt.startedAt!==null&&!view.attempt.locked&&view.released;
  const attemptId=view?.attempt?.id;
  useEffect(()=>{
    if(!active)return;
    let disposed=false,sending=false,heartbeatPending=false;
    const report=async(type:string,details="")=>{if(disposed||sending||!view?.monitoring)return;sending=true;try{const s=await api<StudentView>("quiz/proctor-event",{event_type:type,details});if(!disposed)update.current(s);}catch(e){if(!disposed)error.current((e as Error).message);}finally{sending=false;}};
    const hidden=()=>{if(document.hidden)void report("TAB_HIDDEN");};
    const blur=()=>void report("FOCUS_LOST");const leave=()=>void report("CURSOR_LEFT");
    const context=(e:MouseEvent)=>{if(view?.monitoring){e.preventDefault();void report("CONTEXT_MENU");}};
    const keyboard=(e:KeyboardEvent)=>{if(!view?.monitoring)return;const k=e.key.toLowerCase();if(k==="f12"||((e.ctrlKey||e.metaKey)&&["c","v","x","tab"].includes(k))||e.altKey&&k==="tab"||(e.ctrlKey||e.metaKey)&&e.shiftKey&&["i","j","c"].includes(k)){e.preventDefault();void report("SHORTCUT",e.key);}};
    const heartbeat=async()=>{if(disposed||heartbeatPending)return;heartbeatPending=true;try{const s=await api<StudentView>("quiz/heartbeat",{focused:document.hasFocus(),hidden:document.hidden,width:window.innerWidth,height:window.innerHeight});if(!disposed)update.current(s);}catch(e){if(!disposed)error.current(`Connection interrupted. ${(e as Error).message}`);}finally{heartbeatPending=false;}};
    const metrics=()=>{if(window.outerWidth-window.innerWidth>220||window.outerHeight-window.innerHeight>220)void report("DEVTOOLS_OPEN","Large browser viewport difference detected");};
    document.addEventListener("visibilitychange",hidden);window.addEventListener("blur",blur);document.addEventListener("mouseleave",leave);document.addEventListener("contextmenu",context);document.addEventListener("keydown",keyboard);
    void heartbeat();const id=setInterval(()=>{void heartbeat();if(view?.monitoring)metrics();},3000);
    return()=>{disposed=true;clearInterval(id);document.removeEventListener("visibilitychange",hidden);window.removeEventListener("blur",blur);document.removeEventListener("mouseleave",leave);document.removeEventListener("contextmenu",context);document.removeEventListener("keydown",keyboard);};
  },[active,attemptId,view?.monitoring]);
}
