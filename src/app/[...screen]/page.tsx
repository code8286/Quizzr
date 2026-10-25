import { notFound } from "next/navigation";
import { Portal } from "@/features/portal";
export default async function Page({params}:{params:Promise<{screen:string[]}>}){
  const path=(await params).screen.join("/");
  if(!["login","home","quiz/register","quiz/waiting","quiz/play","quiz/completed","admin","admin/login"].includes(path))notFound();
  return <Portal/>;
}
