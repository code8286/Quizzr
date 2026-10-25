import { test, expect } from "@playwright/test";

test("production assets, headers, secure sessions and origin protection", async ({ request }) => {
  const page = await request.get("/");
  expect(page.status()).toBe(200);
  const html = await page.text();
  expect(html).toContain("Quizzr");
  expect(page.headers()["x-powered-by"]).toBeUndefined();
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
  expect(page.headers()["x-frame-options"]).toBe("DENY");
  expect(page.headers()["content-security-policy"]).not.toContain("unsafe-eval");
  const assets = [...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+\.(?:js|css))"/g)];
  expect(assets.length).toBeGreaterThan(0);
  for (const [, path] of assets) expect((await request.get(path.replaceAll("&amp;", "&"))).status()).toBe(200);
  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await request.get("/api/admin/export")).status()).toBe(401);
  expect((await request.get("/api/events")).status()).toBe(401);
  expect((await request.get("/api/cron/watchdog")).status()).toBe(401);
  expect((await request.post("/api/admin/login", {
    headers: { Origin: "https://wrong-origin.invalid" },
    data: { admin_username: "ADMIN", password: "TestAdmin!2026" },
  })).status()).toBe(403);
  const login = await request.post("/api/admin/login", {
    headers: { Origin: "http://127.0.0.1:3101" },
    data: { admin_username: "ADMIN", password: "TestAdmin!2026" },
  });
  expect(login.status()).toBe(200);
  const cookie = login.headers()["set-cookie"];
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie.toLowerCase()).toContain("samesite=strict");
  // The local rehearsal uses HTTP; explicitly forward the otherwise HTTPS-only cookie.
  const dashboard = await request.get("/api/admin/live-dashboard", { headers: { Cookie: cookie.split(";")[0] } });
  expect(dashboard.status()).toBe(200);
  expect(dashboard.headers()["cache-control"]).toContain("no-store");
  expect((await dashboard.json()).teams).toEqual([]);
});
