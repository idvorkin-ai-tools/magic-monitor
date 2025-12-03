import type { BugReportData, BugReportMetadata } from "../types/bugReport";
import { GIT_COMMIT_URL, GIT_SHA_SHORT } from "../version";

export function formatBuildLink(): string {
	return `[${GIT_SHA_SHORT}](${GIT_COMMIT_URL})`;
}

export function formatDate(date: Date = new Date()): string {
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function buildDefaultTitle(): string {
	return "Bug";
}

export function buildDefaultDescription(
	currentDate: Date = new Date(),
): string {
	const date = formatDate(currentDate);

	return `**Date:** ${date}

**Build:** ${formatBuildLink()}

**What were you trying to do?**


**What happened instead?**


**Steps to reproduce:**
1.
`;
}

export function buildIssueBody(
	data: BugReportData,
	metadata: BugReportMetadata,
	options: { isMobile: boolean; hasScreenshot: boolean },
): string {
	let body = data.description;

	if (data.includeMetadata) {
		const memoryDisplay =
			metadata.deviceMemoryGB !== null
				? `${metadata.deviceMemoryGB} GB`
				: "Unknown";
		const cpuDisplay =
			metadata.hardwareConcurrency !== null
				? `${metadata.hardwareConcurrency} cores`
				: "Unknown";
		const connectionDisplay = metadata.connectionType ?? "Unknown";
		body += `

---

**App Metadata**
| Field | Value |
|-------|-------|
| Route | \`${metadata.route}\` |
| App Version | \`${metadata.appVersion}\` |
| Browser | \`${metadata.userAgent}\` |
| Timestamp | \`${metadata.timestamp}\` |
| Screen | \`${metadata.screenWidth}x${metadata.screenHeight} @${metadata.devicePixelRatio}x\` |
| Device Memory | \`${memoryDisplay}\` |
| CPU Cores | \`${cpuDisplay}\` |
| Online | \`${metadata.isOnline}\` |
| Connection | \`${connectionDisplay}\` |
| Display Mode | \`${metadata.displayMode}\` |
| Touch Device | \`${metadata.isTouchDevice}\` |
| Mobile | \`${metadata.isMobile}\` |
`;
	}

	if (options.hasScreenshot && !options.isMobile) {
		body += `
**Screenshot**
_(Screenshot is on your clipboard - paste it here with Ctrl+V / Cmd+V)_
`;
	}

	return body;
}

export function buildGitHubIssueUrl(
	repoUrl: string,
	title: string,
	body: string,
	labels: string[] = ["bug", "from-app"],
): string {
	const issueUrl = new URL(`${repoUrl}/issues/new`);
	issueUrl.searchParams.set("title", title);
	issueUrl.searchParams.set("body", body);
	issueUrl.searchParams.set("labels", labels.join(","));
	return issueUrl.toString();
}

export interface DeviceInfoGetters {
	getScreenWidth: () => number;
	getScreenHeight: () => number;
	getDevicePixelRatio: () => number;
	getDeviceMemoryGB: () => number | null;
	getHardwareConcurrency: () => number | null;
	isOnline: () => boolean;
	getConnectionType: () => string | null;
	getDisplayMode: () => string;
	isTouchDevice: () => boolean;
	isMobileDevice: () => boolean;
}

export function getMetadata(
	getCurrentRoute: () => string,
	getUserAgent: () => string,
	deviceInfo: DeviceInfoGetters,
	currentDate: Date = new Date(),
): BugReportMetadata {
	return {
		route: getCurrentRoute(),
		userAgent: getUserAgent(),
		timestamp: currentDate.toISOString(),
		appVersion: GIT_SHA_SHORT,
		screenWidth: deviceInfo.getScreenWidth(),
		screenHeight: deviceInfo.getScreenHeight(),
		devicePixelRatio: deviceInfo.getDevicePixelRatio(),
		deviceMemoryGB: deviceInfo.getDeviceMemoryGB(),
		hardwareConcurrency: deviceInfo.getHardwareConcurrency(),
		isOnline: deviceInfo.isOnline(),
		connectionType: deviceInfo.getConnectionType(),
		displayMode: deviceInfo.getDisplayMode(),
		isTouchDevice: deviceInfo.isTouchDevice(),
		isMobile: deviceInfo.isMobileDevice(),
	};
}

export function buildCrashReportBody(
	error: Error,
	metadata: BugReportMetadata,
): string {
	const memoryDisplay =
		metadata.deviceMemoryGB !== null
			? `${metadata.deviceMemoryGB} GB`
			: "Unknown";
	const cpuDisplay =
		metadata.hardwareConcurrency !== null
			? `${metadata.hardwareConcurrency} cores`
			: "Unknown";
	const connectionDisplay = metadata.connectionType ?? "Unknown";
	return `**Error:** ${error.message}

**Build:** ${formatBuildLink()}

**Stack Trace:**
\`\`\`
${error.stack || "No stack trace available"}
\`\`\`

---

**App Metadata**
| Field | Value |
|-------|-------|
| Route | \`${metadata.route}\` |
| App Version | ${formatBuildLink()} |
| Browser | \`${metadata.userAgent}\` |
| Timestamp | \`${metadata.timestamp}\` |
| Screen | \`${metadata.screenWidth}x${metadata.screenHeight} @${metadata.devicePixelRatio}x\` |
| Device Memory | \`${memoryDisplay}\` |
| CPU Cores | \`${cpuDisplay}\` |
| Online | \`${metadata.isOnline}\` |
| Connection | \`${connectionDisplay}\` |
| Display Mode | \`${metadata.displayMode}\` |
| Touch Device | \`${metadata.isTouchDevice}\` |
| Mobile | \`${metadata.isMobile}\` |
`;
}
