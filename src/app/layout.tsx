import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
export const metadata:Metadata={title:"Quizzr · Mathematics Quiz 3",description:"A focused, collaborative mathematics assessment workspace."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
