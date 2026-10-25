/** Shared by the production store and the read-only deployment preflight. */
export function productionConfigIssues(env: Record<string, string | undefined>): string[] {
  const issues: string[] = [];
  if (env.QUIZ_STORAGE !== "postgres") issues.push("Set QUIZ_STORAGE=postgres.");
  try {
    const url = new URL(env.DATABASE_URL || "");
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.password)
      throw new Error();
    if (["disable", "allow", "prefer"].includes(url.searchParams.get("sslmode") || ""))
      issues.push("DATABASE_URL must require TLS; remove the insecure sslmode setting.");
  } catch {
    issues.push("Set DATABASE_URL to the private PostgreSQL transaction-pooler URL, including its password.");
  }
  if (env.PGSSL === "disable") issues.push("Remove PGSSL=disable; production requires TLS.");
  const secret = env.SESSION_SECRET || "";
  if (secret.length < 32 || /change.?me|replace.?me|example|e2e-only|do-not-use/i.test(secret))
    issues.push("Set SESSION_SECRET to at least 32 random characters, unique to this environment.");
  try {
    const url = new URL(env.APP_ORIGIN || "");
    if (url.protocol !== "https:" || url.origin !== env.APP_ORIGIN) throw new Error();
  } catch {
    issues.push("Set APP_ORIGIN to the exact public HTTPS origin, without a trailing slash or path.");
  }
  if (env.ALLOW_LOCAL_PRODUCTION === "true") issues.push("Remove ALLOW_LOCAL_PRODUCTION from the hosted environment.");
  if (env.HEARTBEAT_TIMEOUT_MS !== undefined &&
      (!Number.isInteger(Number(env.HEARTBEAT_TIMEOUT_MS)) || Number(env.HEARTBEAT_TIMEOUT_MS) < 3000))
    issues.push("HEARTBEAT_TIMEOUT_MS must be an integer of at least 3000 milliseconds.");
  if (env.CRON_SECRET && env.CRON_SECRET.length < 32)
    issues.push("Use at least 32 random characters for CRON_SECRET, or omit it when using pg_cron.");
  return issues;
}

export function assertProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  // Explicitly isolated local production rehearsals are supported; hosted apps cannot opt out.
  if (!process.env.VERCEL && process.env.QUIZ_STORAGE === "local" && process.env.ALLOW_LOCAL_PRODUCTION === "true") return;
  const issues = productionConfigIssues(process.env);
  if (issues.length) throw new Error(`Production configuration is invalid: ${issues.join(" ")}`);
}
