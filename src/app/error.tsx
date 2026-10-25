"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="empty-card"><h1>Something interrupted this page.</h1><p>Your committed progress remains saved.</p><button className="button primary" onClick={reset}>Try again</button></main>;}
