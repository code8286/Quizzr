import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "production.spec.ts",
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3101" },
  webServer: {
    command: "tsx scripts/setup-e2e.ts && next build && next start --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101/api/health",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      QUIZ_STORAGE: "local", QUIZ_DATA_DIR: ".data/e2e", QUIZ_BUILD_DIR: ".next-verify",
      ALLOW_LOCAL_PRODUCTION: "true", VERCEL: "",
      SESSION_SECRET: "e2e-only-secret-do-not-use-in-production-2026",
      APP_ORIGIN: "http://127.0.0.1:3101",
    },
  },
});
