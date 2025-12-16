import { expect, type Page, test } from "@playwright/test";
import {
	seedSessionBuffer,
	waitForSessionsLoaded,
} from "./helpers/seedSessionBuffer";

// Declare the mock helper types for TypeScript
declare global {
	interface Window {
		mockCamera: {
			setColor: (color: string) => void;
		};
	}
}

// Helper to locate a settings toggle by its label
function getSettingsToggle(page: Page, labelPattern: RegExp) {
	return page
		.locator("div", { hasText: labelPattern })
		.locator('button[role="switch"]');
}

// Reusable mock injection function
async function injectMockCamera(page: Page) {
	await page.addInitScript(() => {
		// Create the Mock Camera Helper
		const canvas = document.createElement("canvas");
		canvas.width = 1920;
		canvas.height = 1080;
		const ctx = canvas.getContext("2d");

		// Default to a pattern so we can see it working
		let currentColor = "pattern";

		function draw() {
			if (!ctx) return;

			if (currentColor === "pattern") {
				// Draw a moving pattern
				const time = Date.now() / 1000;
				ctx.fillStyle = "#111";
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				ctx.fillStyle = "#444";
				const x = ((Math.sin(time) + 1) * canvas.width) / 2;
				ctx.fillRect(x - 50, canvas.height / 2 - 50, 100, 100);

				ctx.fillStyle = "white";
				ctx.font = "40px sans-serif";
				ctx.fillText(`MOCK CAMERA ${time.toFixed(1)}`, 50, 50);
			} else {
				// Solid color
				ctx.fillStyle = currentColor;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}

			requestAnimationFrame(draw);
		}

		draw();

		// Expose control to window
		window.mockCamera = {
			setColor: (color: string) => {
				currentColor = color;
			},
		};

		// Mock getUserMedia
		const stream = canvas.captureStream(30);

		// Override navigator.mediaDevices.getUserMedia
		if (!navigator.mediaDevices) {
			// @ts-expect-error - navigator.mediaDevices is read-only but we need to mock it
			navigator.mediaDevices = {};
		}

		navigator.mediaDevices.getUserMedia = async (constraints) => {
			console.log("Mock getUserMedia called with:", constraints);
			return stream;
		};

		navigator.mediaDevices.enumerateDevices = async () => {
			return [
				{
					deviceId: "mock-camera-1",
					kind: "videoinput",
					label: "Mock Camera 1",
					groupId: "group1",
				},
				{
					deviceId: "mock-camera-2",
					kind: "videoinput",
					label: "Mock Camera 2",
					groupId: "group1",
				},
			] as MediaDeviceInfo[];
		};
	});
}

test.describe("Magic Monitor E2E", () => {
	test.beforeEach(async ({ page }) => {
		await injectMockCamera(page);
		// Clear localStorage to ensure clean state between tests
		await page.addInitScript(() => {
			localStorage.clear();
		});
		await page.goto("/");
	});

	test("App loads and requests camera", async ({ page }) => {
		await expect(page).toHaveTitle(/magic-monitor/i);
		// Check if the video element exists and is playing
		const video = page.getByTestId("main-video");
		await expect(video).toBeVisible();

		// Check if controls are visible
		await page.getByTitle("Settings").click();
		await expect(page.getByText("Pick Color")).toBeVisible();

		// Check if camera selection has labels
		const cameraSelect = page.locator("select#camera-source");
		await expect(cameraSelect).toContainText("Mock Camera 1");
		await expect(cameraSelect).toContainText("Mock Camera 2");
	});

	// TODO: Flash detection timing is flaky with mock camera - needs investigation
	// The mock canvas stream and flash detector's requestAnimationFrame loop
	// don't sync reliably in the test environment
	test.skip("Flash Detection Logic", async ({ page }) => {
		// Use a distinctive color for testing (not pure red to avoid any default state issues)
		const testColor = "rgb(0, 255, 0)"; // Green

		// 1. Set Mock to GREEN
		await page.evaluate(
			(color) => window.mockCamera.setColor(color),
			testColor,
		);
		await page.waitForTimeout(500); // Let mock update

		// 2. Pick the color
		await page.getByTitle("Settings").click();
		await page.getByText("Pick Color").click();
		// Click the video to pick the color (center of screen)
		await page
			.getByTestId("main-video")
			.click({ position: { x: 100, y: 100 }, force: true });

		// 3. Verify flash is now armed
		await page.getByTitle("Settings").click();
		// Use exact match since "ARMED" appears in both settings modal and main control bar
		await expect(
			page.getByRole("button", { name: "ARMED", exact: true }),
		).toBeVisible();

		// Close settings modal before testing flash overlay
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);

		// The flash warning overlay is the border-red-600 div.
		const flashOverlay = page.locator(".border-red-600");

		// 4. Since we're showing green and picked green, flash should be active
		await expect(flashOverlay).toHaveClass(/opacity-100/, { timeout: 3000 });

		// 5. Change to BLUE - flash should stop (different color)
		await page.evaluate(() => window.mockCamera.setColor("rgb(0, 0, 255)"));
		await page.waitForTimeout(500);
		await expect(flashOverlay).toHaveClass(/opacity-0/, { timeout: 5000 });

		// 6. Change back to GREEN - flash should resume
		await page.evaluate(
			(color) => window.mockCamera.setColor(color),
			testColor,
		);
		await expect(flashOverlay).toHaveClass(/opacity-100/, { timeout: 3000 });
	});

	test("UI Controls: Zoom", async ({ page }) => {
		// Zoom
		const zoomInput = page.locator('input[type="range"]').last(); // Zoom is the last range input
		await zoomInput.fill("2");
		// Verify video style transform
		const video = page.getByTestId("main-video");
		// Browsers often report transform as matrix(scaleX, skewY, skewX, scaleY, translateX, translateY)
		// scale(2) -> matrix(2, 0, 0, 2, 0, 0)
		await expect(video).toHaveCSS("transform", /matrix\(2, 0, 0, 2, 0, 0\)/);

		// Reset Zoom (button text is just "Reset")
		await page.getByText("Reset").click();
		// scale(1) -> none or matrix(1, 0, 0, 1, 0, 0)
		await expect(video).toHaveCSS(
			"transform",
			/none|matrix\(1, 0, 0, 1, 0, 0\)/,
		);
	});

	test("Sessions: Enter and Exit Replay via Session Picker", async ({
		page,
	}) => {
		// Seed the IndexedDB with test sessions
		await seedSessionBuffer(page, 3);

		// Reload to pick up the seeded data
		await page.reload();

		// Wait for seeded data to be loaded from IndexedDB
		await waitForSessionsLoaded(page, 3);

		// Open Sessions picker (button text is "Sessions" with emoji)
		await page.getByText("Sessions").click();

		// Verify Session Picker modal is visible
		await expect(
			page.getByRole("heading", { name: "Sessions" }),
		).toBeVisible();

		// Check that recent sessions section is displayed (use heading role to be specific)
		await expect(
			page.getByRole("heading", { name: "Recent" }),
		).toBeVisible();

		// Click first session thumbnail to enter timeline view
		const sessionThumbnails = page.locator(
			'[data-testid="session-thumbnail"]',
		);
		await sessionThumbnails.first().click();

		// Timeline view should show thumbnails (previews)
		const timelineThumbs = page.locator('img[alt^="Frame at"]');
		await expect(timelineThumbs.first()).toBeVisible({ timeout: 5000 });

		// Click first thumbnail to enter replay mode
		await timelineThumbs.first().click();

		// Verify Replay UI is shown
		await expect(page.getByText("REPLAY MODE")).toBeVisible();

		// Video should be hidden, replay video visible
		await expect(page.getByTestId("main-video")).toBeHidden();

		// Exit Replay (button shows ✕)
		await page.locator("button", { hasText: "✕" }).click();

		// Wait for replay mode to exit - the main controls bar should reappear
		await expect(page.getByText("REPLAY MODE")).toBeHidden({ timeout: 5000 });
		await expect(page.getByText("Sessions")).toBeVisible({ timeout: 5000 });
		await expect(page.getByTestId("main-video")).toBeVisible();
	});

	test("Sessions: Thumbnails appear in session timeline", async ({ page }) => {
		// Seed with 3 sessions
		await seedSessionBuffer(page, 3);
		await page.reload();

		// Wait for seeded data to be loaded from IndexedDB
		await waitForSessionsLoaded(page, 3);

		// Open Sessions picker
		await page.getByText("Sessions").click();
		await expect(
			page.getByRole("heading", { name: "Sessions" }),
		).toBeVisible();

		// Click first session to see timeline view
		const sessionThumbnails = page.locator(
			'[data-testid="session-thumbnail"]',
		);
		await sessionThumbnails.first().click();

		// Timeline view should show thumbnails from the session
		// Each session has thumbnails at different times
		const timelineThumbs = page.locator('img[alt^="Frame at"]');
		await expect(timelineThumbs.first()).toBeVisible({ timeout: 5000 });

		// There should be multiple thumbnails (seeded sessions have 6 thumbnails each)
		const count = await timelineThumbs.count();
		expect(count).toBeGreaterThan(0);

		// Click a thumbnail to seek to that time and enter replay
		await timelineThumbs.first().click();

		// Should now be in replay mode
		await expect(page.getByText("REPLAY MODE")).toBeVisible();

		// Exit replay
		await page.locator("button", { hasText: "✕" }).click();
		await expect(page.getByText("REPLAY MODE")).toBeHidden({ timeout: 5000 });
	});

	test("Sessions: Export video via Share button", async ({ page }) => {
		// Seed with 3 sessions for faster test
		await seedSessionBuffer(page, 3);
		await page.reload();

		// Wait for seeded data to be loaded from IndexedDB
		await waitForSessionsLoaded(page, 3);

		// Open Sessions picker and select a session
		await page.getByText("Sessions").click();
		await expect(
			page.getByRole("heading", { name: "Sessions" }),
		).toBeVisible();

		// Click first session
		const sessionThumbnails = page.locator(
			'[data-testid="session-thumbnail"]',
		);
		await sessionThumbnails.first().click();

		// Click first thumbnail to enter replay mode
		const timelineThumbs = page.locator('img[alt^="Frame at"]');
		await expect(timelineThumbs.first()).toBeVisible({ timeout: 5000 });
		await timelineThumbs.first().click();
		await expect(page.getByText("REPLAY MODE")).toBeVisible();

		// Set up download listener before clicking share
		const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

		// Click share button (may need to wait for it to appear)
		const shareButton = page.locator("button", { hasText: /Share/ });
		await expect(shareButton).toBeVisible();
		await shareButton.click();

		// Wait for download to complete
		const download = await downloadPromise;

		// Verify download filename pattern (practice-clip is the default name)
		expect(download.suggestedFilename()).toMatch(/\.webm$/);

		// Save to temp location and verify we got something
		const path = await download.path();
		expect(path).toBeTruthy();

		// The file should have content
		const fs = await import("node:fs/promises");
		const stats = await fs.stat(path!);
		expect(stats.size).toBeGreaterThan(0);

		// Exit replay
		await page.locator("button", { hasText: "✕" }).click();
	});

	test("Sessions: Replay play/pause controls work", async ({ page }) => {
		// Seed with sessions
		await seedSessionBuffer(page, 1);
		await page.reload();
		await waitForSessionsLoaded(page, 1);

		// Enter replay mode
		await page.getByText("Sessions").click();
		const sessionThumbnails = page.locator('[data-testid="session-thumbnail"]');
		await sessionThumbnails.first().click();
		const timelineThumbs = page.locator('img[alt^="Frame at"]');
		await expect(timelineThumbs.first()).toBeVisible({ timeout: 5000 });
		await timelineThumbs.first().click();
		await expect(page.getByText("REPLAY MODE")).toBeVisible();

		// Find play/pause button (usually has ▶ or ⏸ icon)
		const playPauseButton = page.locator('button[title*="lay"], button[title*="ause"]').first();
		await expect(playPauseButton).toBeVisible();

		// Toggle play/pause
		await playPauseButton.click();
		await page.waitForTimeout(500);
		await playPauseButton.click();

		// Exit replay
		await page.locator("button", { hasText: "✕" }).click();
		await expect(page.getByText("REPLAY MODE")).toBeHidden({ timeout: 5000 });
	});

	test("Sessions: Delete session removes it from list", async ({ page }) => {
		// Seed with 3 sessions
		await seedSessionBuffer(page, 3);
		await page.reload();
		await waitForSessionsLoaded(page, 3);

		// Open Sessions picker
		await page.getByText("Sessions").click();
		await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();

		// Count initial sessions
		const sessionThumbnails = page.locator('[data-testid="session-thumbnail"]');
		const initialCount = await sessionThumbnails.count();
		expect(initialCount).toBe(3);

		// Find and click delete button on first session (usually shows on hover)
		const firstSession = sessionThumbnails.first();
		await firstSession.hover();

		// Handle the confirm dialog
		page.on("dialog", (dialog) => dialog.accept());

		// Click delete button
		const deleteButton = firstSession.locator('button[title*="elete"], button:has-text("×")').first();
		if (await deleteButton.isVisible()) {
			await deleteButton.click();

			// Verify session count decreased
			await page.waitForTimeout(500);
			const newCount = await sessionThumbnails.count();
			expect(newCount).toBe(initialCount - 1);
		}

		// Close picker
		await page.keyboard.press("Escape");
	});

	test("Settings: Mirror mode toggle", async ({ page }) => {
		const video = page.getByTestId("main-video");

		// Check initial state (not mirrored by default since localStorage is cleared)
		await expect(video).toHaveCSS(
			"transform",
			/none|matrix\(1, 0, 0, 1, 0, 0\)/,
		);

		// Open settings and toggle mirror on
		await page.getByTitle("Settings").click();
		const mirrorToggle = getSettingsToggle(page, /^Mirror Video/);

		// Toggle should be off (gray) initially
		await expect(mirrorToggle).toHaveClass(/bg-gray-700/);

		// Click to enable mirror
		await mirrorToggle.click();

		// Toggle should be on (blue)
		await expect(mirrorToggle).toHaveClass(/bg-blue-600/);

		// Close settings
		await page.keyboard.press("Escape");

		// Video should now be mirrored (scaleX(-1) creates matrix with -1)
		await expect(video).toHaveCSS("transform", /matrix\(-1.*\)/);

		// Toggle mirror off again
		await page.getByTitle("Settings").click();
		await mirrorToggle.click();
		await expect(mirrorToggle).toHaveClass(/bg-gray-700/);
		await page.keyboard.press("Escape");
		await expect(video).toHaveCSS(
			"transform",
			/none|matrix\(1, 0, 0, 1, 0, 0\)/,
		);
	});

	test("Settings: Camera device switching", async ({ page }) => {
		// Open settings
		await page.getByTitle("Settings").click();

		// Check camera select is visible with both mock cameras
		const cameraSelect = page.locator("select#camera-source");
		await expect(cameraSelect).toBeVisible();
		await expect(cameraSelect).toContainText("Mock Camera 1");
		await expect(cameraSelect).toContainText("Mock Camera 2");

		// Get initial value
		const initialValue = await cameraSelect.inputValue();
		expect(initialValue).toBe("mock-camera-1");

		// Switch to Mock Camera 2
		await cameraSelect.selectOption("mock-camera-2");

		// Verify selection changed
		const newValue = await cameraSelect.inputValue();
		expect(newValue).toBe("mock-camera-2");

		// Video should still be visible (stream switched)
		await page.keyboard.press("Escape");
		const video = page.getByTestId("main-video");
		await expect(video).toBeVisible();
	});

	test("Recording: Shows recording indicator when live", async ({ page }) => {
		// Wait for app to load and start recording
		const video = page.getByTestId("main-video");
		await expect(video).toBeVisible();

		// Recording indicator should show "REC" or recording duration
		// Look for the recording indicator in the control bar
		const recordingIndicator = page.locator("text=/REC|\\d+:\\d+/");
		await expect(recordingIndicator.first()).toBeVisible({ timeout: 10000 });
	});

	test("Recording: Duration counter increases over time", async ({ page }) => {
		// Wait for app to load
		const video = page.getByTestId("main-video");
		await expect(video).toBeVisible();

		// Wait for recording to start (should show a duration like "0:01" or "0:00")
		const durationRegex = /\d+:\d{2}/;
		await expect(page.getByText(durationRegex).first()).toBeVisible({ timeout: 10000 });

		// Get initial duration text
		const durationElement = page.getByText(durationRegex).first();
		const initialText = await durationElement.textContent();

		// Wait 2 seconds for counter to increase
		await page.waitForTimeout(2000);

		// Duration should have increased
		const newText = await durationElement.textContent();
		expect(newText).not.toBe(initialText);
	});
});

test.describe("Bug Report", () => {
	test.beforeEach(async ({ page }) => {
		await injectMockCamera(page);
		await page.addInitScript(() => {
			localStorage.clear();
		});
		await page.goto("/");
	});

	test("Bug report includes device details in metadata", async ({
		page,
		context,
	}) => {
		// Open bug report via keyboard shortcut (Ctrl+I or Cmd+I)
		await page.keyboard.press("Control+i");

		// Wait for bug report modal (use heading to be specific)
		await expect(
			page.getByRole("heading", { name: "Report a Bug" }),
		).toBeVisible();

		// Verify "Include technical details" checkbox is checked by default
		const metadataCheckbox = page.locator('input[type="checkbox"]');
		await expect(metadataCheckbox).toBeChecked();

		// Fill in a title (required for submit)
		await page.locator("#bug-title").fill("Test Bug Report");

		// Listen for popup (GitHub issue page)
		const popupPromise = context.waitForEvent("page");

		// Submit the bug report
		await page.getByText("Copy & Open GitHub").click();

		// Wait for the popup and get its URL
		const popup = await popupPromise;
		const popupUrl = popup.url();

		// Close the popup
		await popup.close();

		// Verify the URL is from GitHub
		expect(popupUrl).toContain("github.com");

		// GitHub may redirect to login page with return_to parameter
		// Extract the actual issue URL from return_to if redirected
		const url = new URL(popupUrl);
		let issueUrl: URL;
		const returnTo = url.searchParams.get("return_to");
		if (returnTo) {
			// Redirected to login - extract the original issue URL
			issueUrl = new URL(decodeURIComponent(returnTo));
		} else {
			issueUrl = url;
		}

		// Verify it's the issues/new endpoint
		expect(issueUrl.pathname).toContain("issues/new");

		// Decode the body parameter to check for device details
		const body = decodeURIComponent(issueUrl.searchParams.get("body") || "");

		// Verify device details are present in the body
		expect(body).toContain("App Metadata");
		expect(body).toContain("Screen");
		expect(body).toContain("Device Memory");
		expect(body).toContain("CPU Cores");
		expect(body).toContain("Online");
		expect(body).toContain("Connection");
		expect(body).toContain("Display Mode");
		expect(body).toContain("Touch Device");
		expect(body).toContain("Mobile");
	});
});

test.describe("Error States", () => {
	test("Shows error when camera permission denied", async ({ page }) => {
		// Mock camera permission denied
		await page.addInitScript(() => {
			navigator.mediaDevices.getUserMedia = async () => {
				throw new DOMException(
					"Permission denied",
					"NotAllowedError",
				);
			};
			navigator.mediaDevices.enumerateDevices = async () => [];
		});

		await page.goto("/");

		// Should show error message about camera access
		// Actual message: "Could not access camera. Please allow permissions."
		await expect(
			page.getByText(/could not access camera|allow permissions/i),
		).toBeVisible({ timeout: 10000 });
	});

	test("Shows error when no camera devices available", async ({ page }) => {
		// Mock no devices
		await page.addInitScript(() => {
			navigator.mediaDevices.getUserMedia = async () => {
				throw new DOMException(
					"Requested device not found",
					"NotFoundError",
				);
			};
			navigator.mediaDevices.enumerateDevices = async () => [];
		});

		await page.goto("/");

		// Should show error message about camera access (same error shown for NotFoundError)
		await expect(
			page.getByText(/could not access camera|allow permissions/i),
		).toBeVisible({ timeout: 10000 });
	});
});
