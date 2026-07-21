import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// 1 local retry: a known app bug (MediaPipe crash on 0x0 pre-metadata frame,
	// tracked in the reliability sweep) can kill an arbitrary test under suite
	// timing pressure; retried passes surface as "flaky", not silent green.
	retries: process.env.CI ? 2 : 1,
	workers: process.env.CI ? 1 : 2,
	reporter: [
		["list"],
		["html", { outputFolder: "playwright-report", open: "never" }],
	],
	use: {
		baseURL: "https://localhost:5273",
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
		command: "npx vite --port 5273 --strictPort",
		url: "https://localhost:5273",
		reuseExistingServer: !process.env.CI, // Reuse existing server in dev, start fresh in CI
		timeout: 120 * 1000,
		stdout: "ignore",
		stderr: "pipe",
		ignoreHTTPSErrors: true,
	},
});
