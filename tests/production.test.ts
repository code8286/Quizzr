import { afterEach, describe, expect, it, vi } from "vitest";
import { assertProductionConfig, productionConfigIssues } from "../src/server/production";

const valid = {
  QUIZ_STORAGE: "postgres",
  DATABASE_URL: "postgresql://postgres:private-password@db.example.com:6543/postgres",
  SESSION_SECRET: "9iZL3mR7aV2xK6bC8sF4nP1wY5qT0hDe",
  APP_ORIGIN: "https://quiz.example.com",
};
afterEach(() => vi.unstubAllEnvs());

describe("production release configuration", () => {
  it("accepts private PostgreSQL and an exact HTTPS origin without requiring HTTP cron", () => {
    expect(productionConfigIssues(valid)).toEqual([]);
  });
  it.each(["http://quiz.example.com", "https://quiz.example.com/", "https://quiz.example.com/path", "https://user:pass@quiz.example.com", "https://quiz.example.com?x=1"])("rejects unusable APP_ORIGIN %s", origin => {
    expect(productionConfigIssues({ ...valid, APP_ORIGIN: origin }).join()).toContain("APP_ORIGIN");
  });
  it("rejects local storage, public test secrets and insecure database connections", () => {
    const issues = productionConfigIssues({ ...valid, QUIZ_STORAGE: "local", ALLOW_LOCAL_PRODUCTION: "true", PGSSL: "disable", SESSION_SECRET: "e2e-only-secret-do-not-use-in-production-2026" });
    for (const key of ["QUIZ_STORAGE", "ALLOW_LOCAL_PRODUCTION", "PGSSL", "SESSION_SECRET"]) expect(issues.join()).toContain(key);
    expect(productionConfigIssues({ ...valid, DATABASE_URL: `${valid.DATABASE_URL}?sslmode=disable` }).join()).toContain("TLS");
  });
  it("reports missing database credentials without disclosing their value", () => {
    const issues = productionConfigIssues({ ...valid, DATABASE_URL: "postgres://secret-user@db.example.com/db" });
    expect(issues.join()).toContain("DATABASE_URL");
    expect(issues.join()).not.toContain("secret-user");
  });
  it("rejects invalid heartbeat and optional cron settings", () => {
    expect(productionConfigIssues({ ...valid, HEARTBEAT_TIMEOUT_MS: "NaN", CRON_SECRET: "short" }).join()).toContain("CRON_SECRET");
    expect(productionConfigIssues({ ...valid, HEARTBEAT_TIMEOUT_MS: "2000" }).join()).toContain("HEARTBEAT_TIMEOUT_MS");
  });
  it("prevents hosted instances from bypassing production checks with the local override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("QUIZ_STORAGE", "local");
    vi.stubEnv("ALLOW_LOCAL_PRODUCTION", "true");
    expect(assertProductionConfig).toThrow("QUIZ_STORAGE=postgres");
    vi.stubEnv("VERCEL", "");
    expect(assertProductionConfig).not.toThrow();
  });
});
