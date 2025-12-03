export interface BugReportData {
	title: string;
	description: string;
	includeMetadata: boolean;
	screenshot?: string;
}

export interface BugReportMetadata {
	route: string;
	userAgent: string;
	timestamp: string;
	appVersion: string;
	screenWidth: number;
	screenHeight: number;
	devicePixelRatio: number;
	deviceMemoryGB: number | null;
	hardwareConcurrency: number | null;
	isOnline: boolean;
	connectionType: string | null;
	displayMode: string;
	isTouchDevice: boolean;
	isMobile: boolean;
}
