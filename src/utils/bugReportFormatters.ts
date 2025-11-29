import type {
	BugReportData,
	BugReportMetadata,
	LatestCommit,
} from "../types/bugReport";

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
	latestCommit: LatestCommit | null,
	githubRepoUrl: string,
	currentDate: Date = new Date(),
): string {
	const date = formatDate(currentDate);
	const versionLine = latestCommit
		? `**Latest version:** [${latestCommit.sha}](${latestCommit.url}) - ${latestCommit.message}`
		: `**Latest version:** [${githubRepoUrl}](${githubRepoUrl})`;

	return `**Date:** ${date}

${versionLine}

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
		body += `

---

**App Metadata**
| Field | Value |
|-------|-------|
| Route | \`${metadata.route}\` |
| App Version | \`${metadata.appVersion}\` |
| Browser | \`${metadata.userAgent}\` |
| Timestamp | \`${metadata.timestamp}\` |
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

export function getMetadata(
	getCurrentRoute: () => string,
	getUserAgent: () => string,
	currentDate: Date = new Date(),
): BugReportMetadata {
	return {
		route: getCurrentRoute(),
		userAgent: getUserAgent(),
		timestamp: currentDate.toISOString(),
		appVersion: "0.0.0",
	};
}
