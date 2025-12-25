import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : 2,
	reporter: [
		["list"],
		["html", { outputFolder: "playwright-report" }],
	],
	use: {
		baseURL: "https://localhost:5173",
		trace: "retain-on-failure",
		video: "retain-on-failure",
		screenshot: "only-on-failure",
		ignoreHTTPSErrors: true,
		// Block service workers to prevent cached content from interfering with tests
		serviceWorkers: "block",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				headless: true,
			},
		},
	],
	webServer: {
		command: "npm run dev -- --port 5173",
		url: "https://localhost:5173",
		reuseExistingServer: !process.env.CI, // Reuse existing server in dev, start fresh in CI
		timeout: 120 * 1000,
		stdout: "ignore",
		stderr: "pipe",
		ignoreHTTPSErrors: true,
		env: {
			VITE_SSL: "true",
		},
	},
});
