import postgres from "postgres";
import { productionConfigIssues } from "../src/server/production";
import { checkDeploymentDatabase } from "./deployment-database";

async function main() {
  const args = process.argv.slice(2);
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--env-file")
      throw new Error("Usage: npm run deploy:check -- [--env-file <private-production-env-file>]");
    process.loadEnvFile(args[1]);
  }
  // Never implicitly load .env.local: it contains this workspace's rehearsal configuration.
  const issues = productionConfigIssues(process.env);
  if (issues.length) throw new Error(issues.join("\n"));

  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1, prepare: false, ssl: "require", connect_timeout: 10, idle_timeout: 5,
  });
  try {
    await sql.begin(async tx => {
      await tx`set transaction read only`;
      await tx`set local statement_timeout = '15s'`;
      await checkDeploymentDatabase(async <Row extends Record<string, unknown>>(query: string) =>
        Array.from(await tx.unsafe<Row[]>(query)));
    });
    console.log("PASS: Production settings, private schema, papers, roster, administrators and watchdog schedule are ready. No database records were changed.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(error => {
  // Driver errors can contain connection strings or private records. Print only our own diagnostics.
  console.error(error instanceof Error && error.constructor === Error
    ? error.message
    : "Deployment check failed. Check database connectivity, permissions and migrations in the trusted database console.");
  process.exitCode = 1;
});
