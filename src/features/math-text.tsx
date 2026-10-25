"use client";
import katex from "katex";
export function MathText({text}:{text:string}){
  return <div className="math-text">{text.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$)/g).map((part,i)=>{
    if(part.startsWith("$")){const display=part.startsWith("$$");const value=part.slice(display?2:1,display?-2:-1);return <span key={i} dangerouslySetInnerHTML={{__html:katex.renderToString(value,{displayMode:display,throwOnError:false,trust:false,strict:"warn"})}}/>;}
    return <span key={i}>{part}</span>;
  })}</div>;
}
