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
	const repoUrl = "https://github.com/test/repo";
	const testDate = new Date("2025-11-29T12:00:00Z");

	it("includes date in description", () => {
		const result = buildDefaultDescription(null, repoUrl, testDate);
		expect(result).toContain("**Date:** Nov 29, 2025");
	});

	it("includes repo link when no commit provided", () => {
		const result = buildDefaultDescription(null, repoUrl, testDate);
		expect(result).toContain(`**Latest version:** [${repoUrl}](${repoUrl})`);
	});

	it("includes commit info when provided", () => {
		const commit = {
			sha: "abc1234",
			message: "Fix a bug",
			url: "https://github.com/test/repo/commit/abc1234",
		};
		const result = buildDefaultDescription(commit, repoUrl, testDate);
		expect(result).toContain(
			"**Latest version:** [abc1234](https://github.com/test/repo/commit/abc1234) - Fix a bug",
		);
	});

	it("includes prompts for user input", () => {
		const result = buildDefaultDescription(null, repoUrl, testDate);
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

	it("returns metadata object with route and user agent", () => {
		const result = getMetadata(
			() => "/test-route",
			() => "TestAgent/1.0",
			testDate,
		);

		expect(result).toEqual({
			route: "/test-route",
			userAgent: "TestAgent/1.0",
			timestamp: "2025-11-29T12:00:00.000Z",
			appVersion: "0.0.0",
		});
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
			testDate,
		);

		expect(routeCalled).toBe(true);
		expect(agentCalled).toBe(true);
	});
});
