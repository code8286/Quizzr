import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/e2e",testMatch:"api.spec.ts",fullyParallel:false,workers:1,timeout:60000,
  use:{baseURL:"http://127.0.0.1:3100",trace:"retain-on-failure",screenshot:"only-on-failure"},
  webServer:{command:"tsx scripts/setup-e2e.ts && next dev --hostname 127.0.0.1 --port 3100",url:"http://127.0.0.1:3100/api/health",reuseExistingServer:false,timeout:120000,env:{QUIZ_STORAGE:"local",QUIZ_DATA_DIR:".data/e2e",QUIZ_BUILD_DIR:".next-e2e",SESSION_SECRET:"e2e-only-secret-do-not-use-in-production-2026",APP_ORIGIN:"http://127.0.0.1:3100"}},
});
