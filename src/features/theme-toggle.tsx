"use client";
import { useEffect,useState } from "react";
import { Moon,Sun } from "lucide-react";
export function ThemeToggle(){const [dark,setDark]=useState(false);useEffect(()=>{const saved=localStorage.getItem("quizzr-theme"),next=saved?saved==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=next?"dark":"light";setDark(next);},[]);return <button type="button" className="theme-toggle" aria-label={dark?"Switch to light mode":"Switch to dark mode"} aria-pressed={dark} onClick={()=>{const next=!dark;setDark(next);document.documentElement.dataset.theme=next?"dark":"light";localStorage.setItem("quizzr-theme",next?"dark":"light");}}>{dark?<Sun size={16}/>:<Moon size={16}/>}<span>{dark?"Light mode":"Dark mode"}</span></button>;}
