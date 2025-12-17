import { describe, expect, it } from "vitest";
import {
	buildDefaultDescription,
	buildDefaultTitle,
	buildGitHubIssueUrl,
	buildIssueBody,
	formatDate,
	getMetadata,
} from "./bugReportFormatters";

describe("formatDate", () => {
	it("formats date in US locale", () => {
		const date = new Date("2025-11-29T12:00:00Z");
		expect(formatDate(date)).toBe("Nov 29, 2025");
	});

	it("uses current date when none provided", () => {
		const result = formatDate();
		expect(result).toMatch(/\w{3} \d{1,2}, \d{4}/);
	});
});

describe("buildDefaultTitle", () => {
	it("returns Bug", () => {
		expect(buildDefaultTitle()).toBe("Bug");
	});
});

describe("buildDefaultDescription", () => {
	const testDate = new Date("2025-11-29T12:00:00Z");

	it("includes date in description", () => {
		const result = buildDefaultDescription(testDate);
		expect(result).toContain("**Date:** Nov 29, 2025");
	});

	it("includes build info with linked commit", () => {
		const result = buildDefaultDescription(testDate);
		// Build info should always be a linked commit SHA
		expect(result).toContain("**Build:** [");
		expect(result).toContain("](");
	});

	it("includes prompts for user input", () => {
		const result = buildDefaultDescription(testDate);
		expect(result).toContain("**What were you trying to do?**");
		expect(result).toContain("**What happened instead?**");
		expect(result).toContain("**Steps to reproduce:**");
	});
});

describe("buildIssueBody", () => {
	const data = {
		title: "Bug",
		description: "Test description",
		includeMetadata: true,
	};

	const metadata = {
		route: "/test",
		userAgent: "TestBrowser/1.0",
		timestamp: "2025-11-29T12:00:00.000Z",
		appVersion: "1.0.0",
		screenWidth: 1920,
		screenHeight: 1080,
		devicePixelRatio: 2,
		deviceMemoryGB: 8,
		hardwareConcurrency: 8,
		isOnline: true,
		connectionType: "4g",
		displayMode: "browser",
		isTouchDevice: false,
		isMobile: false,
		mediaRecorder: {
			available: true,
			isIOSSafari: false,
			selectedCodec: "video/webm;codecs=vp9",
			supportedCodecs: ["video/webm;codecs=vp9", "video/webm"],
		},
	};

	it("includes description", () => {
		const result = buildIssueBody(data, metadata, {
			isMobile: false,
			hasScreenshot: false,
		});
		expect(result).toContain("Test description");
	});

	it("includes metadata table when enabled", () => {
		const result = buildIssueBody(data, metadata, {
			isMobile: false,
			hasScreenshot: false,
		});
		expect(result).toContain("**App Metadata**");
		expect(result).toContain("| Route | `/test` |");
		expect(result).toContain("| Browser | `TestBrowser/1.0` |");
	});

	it("includes device info in metadata table", () => {
		const result = buildIssueBody(data, metadata, {
			isMobile: false,
			hasScreenshot: false,
		});
		expect(result).toContain("| Screen | `1920x1080 @2x` |");
		expect(result).toContain("| Device Memory | `8 GB` |");
		expect(result).toContain("| CPU Cores | `8 cores` |");
		expect(result).toContain("| Online | `true` |");
		expect(result).toContain("| Connection | `4g` |");
		expect(result).toContain("| Display Mode | `browser` |");
		expect(result).toContain("| Touch Device | `false` |");
		expect(result).toContain("| Mobile | `false` |");
	});

	it("displays Unknown for null device memory", () => {
		const metadataWithNullMemory = { ...metadata, deviceMemoryGB: null };
		const result = buildIssueBody(data, metadataWithNullMemory, {
			isMobile: false,
			hasScreenshot: false,
		});
		expect(result).toContain("| Device Memory | `Unknown` |");
	});

	it("displays Unknown for null hardware concurrency", () => {
		const metadataWithNullCores = { ...metadata, hardwareConcurrency: null };
		const result = buildIssueBody(data, metadataWithNullCores, {
			isMobile: false,
			hasScreenshot: false,
		});
		expect(result).toContain("| CPU Cores | `Unknown` |");
	});

	it("displays Unknown for null connection type", () => {
		const metadataWithNullConnection = { ...metadata, connectionType: null };
		const result = buildIssueBody(data, metadataWithNullConnection, {
			isMobile: false,
			hasScreenshot: false,
		});
		expect(result).toContain("| Connection | `Unknown` |");
	});

	it("excludes metadata when disabled", () => {
		const result = buildIssueBody(
			{ ...data, includeMetadata: false },
			metadata,
			{ isMobile: false, hasScreenshot: false },
		);
		expect(result).not.toContain("**App Metadata**");
	});

	it("includes screenshot note on desktop with screenshot", () => {
		const result = buildIssueBody(data, metadata, {
			isMobile: false,
			hasScreenshot: true,
		});
		expect(result).toContain("**Screenshot**");
		expect(result).toContain("Screenshot is on your clipboard");
	});

	it("excludes screenshot note on mobile", () => {
		const result = buildIssueBody(data, metadata, {
			isMobile: true,
			hasScreenshot: true,
		});
		expect(result).not.toContain("**Screenshot**");
	});

	it("excludes screenshot note when no screenshot", () => {
		const result = buildIssueBody(data, metadata, {
			isMobile: false,
			hasScreenshot: false,
		});
		expect(result).not.toContain("**Screenshot**");
	});
});

describe("buildGitHubIssueUrl", () => {
	const repoUrl = "https://github.com/test/repo";

	it("builds valid URL with title and body", () => {
		const url = buildGitHubIssueUrl(repoUrl, "Bug Title", "Bug body");
		expect(url).toContain("https://github.com/test/repo/issues/new");
		expect(url).toContain("title=Bug+Title");
		expect(url).toContain("body=Bug+body");
	});

	it("includes default labels", () => {
		const url = buildGitHubIssueUrl(repoUrl, "Title", "Body");
		expect(url).toContain("labels=bug%2Cfrom-app");
	});

	it("supports custom labels", () => {
		const url = buildGitHubIssueUrl(repoUrl, "Title", "Body", [
			"custom",
			"labels",
		]);
		expect(url).toContain("labels=custom%2Clabels");
	});
});

describe("getMetadata", () => {
	const testDate = new Date("2025-11-29T12:00:00.000Z");

	const mockDeviceInfo = {
		getScreenWidth: () => 1920,
		getScreenHeight: () => 1080,
		getDevicePixelRatio: () => 2,
		getDeviceMemoryGB: () => 8,
		getHardwareConcurrency: () => 8,
		isOnline: () => true,
		getConnectionType: () => "4g",
		getDisplayMode: () => "browser",
		isTouchDevice: () => false,
		isMobileDevice: () => false,
	};

	it("returns metadata object with route, user agent, and device info", () => {
		const result = getMetadata(
			() => "/test-route",
			() => "TestAgent/1.0",
			mockDeviceInfo,
			testDate,
		);

		expect(result.route).toBe("/test-route");
		expect(result.userAgent).toBe("TestAgent/1.0");
		expect(result.timestamp).toBe("2025-11-29T12:00:00.000Z");
		// appVersion is now the build-time SHA (or "dev" in dev mode)
		expect(typeof result.appVersion).toBe("string");
		expect(result.appVersion.length).toBeGreaterThan(0);
		// Device info
		expect(result.screenWidth).toBe(1920);
		expect(result.screenHeight).toBe(1080);
		expect(result.devicePixelRatio).toBe(2);
		expect(result.deviceMemoryGB).toBe(8);
		expect(result.hardwareConcurrency).toBe(8);
		expect(result.isOnline).toBe(true);
		expect(result.connectionType).toBe("4g");
		expect(result.displayMode).toBe("browser");
		expect(result.isTouchDevice).toBe(false);
		expect(result.isMobile).toBe(false);
	});

	it("uses provided getters", () => {
		let routeCalled = false;
		let agentCalled = false;

		getMetadata(
			() => {
				routeCalled = true;
				return "/";
			},
			() => {
				agentCalled = true;
				return "Agent";
			},
			mockDeviceInfo,
			testDate,
		);

		expect(routeCalled).toBe(true);
		expect(agentCalled).toBe(true);
	});
});
