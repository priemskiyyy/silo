import { defineConfig, devices } from "@playwright/test";

// Test the built browser app and the Expo web export.
export default defineConfig({
  testDir: ".",
  testMatch: ["fieldbook.spec.ts", "expo.spec.ts"],
  outputDir: "../.artifacts/example-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4190",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium" }],
  webServer: [
    {
      command:
        "pnpm --filter example-react-web build && pnpm --filter example-react-web exec vite preview --host 127.0.0.1 --port 4190 --strictPort",
      cwd: "..",
      url: "http://127.0.0.1:4190",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        "pnpm --filter example-expo build && pnpm exec vite preview --outDir examples/expo/dist --host 127.0.0.1 --port 4192 --strictPort",
      cwd: "..",
      url: "http://127.0.0.1:4192",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
