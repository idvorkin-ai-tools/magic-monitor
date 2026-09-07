import { defineConfig, devices } from "@playwright/test";

/**
 * The dev server only serves HTTPS when it detects a container AND Tailscale
 * (see vite.config.ts). CI has neither, so it answered on http:// while this
 * config waited on https:// - every CI run died with "Timed out waiting
 * 120000ms from config.webServer". Pinning the test server to plain HTTP makes
 * CI and local runs agree; localhost is a secure context either way, so camera
 * APIs still work.
 */
const TEST_SERVER_URL = "http://localhost:5273";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// 1 local retry: a known app bug (MediaPipe crash on 0x0 pre-metadata frame,
	// tracked in the reliability sweep) can kill an arbitrary test under suite
	// timing pressure; retried passes surface as "flaky", not silent green.
	retries: process.env.CI ? 2 : 1,
	// Serial everywhere: several tests are timing-sensitive and flake under
	// parallel load (a different set each run); CI was already serial.
	workers: 1,
	reporter: [
		["list"],
		["html", { outputFolder: "playwright-report", open: "never" }],
	],
	use: {
		baseURL: TEST_SERVER_URL,
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
		url: TEST_SERVER_URL,
		env: { VITE_DEV_SERVER_PLAIN_HTTP: "1" },
		reuseExistingServer: !process.env.CI, // Reuse existing server in dev, start fresh in CI
		timeout: 120 * 1000,
		stdout: "ignore",
		stderr: "pipe",
	},
});
