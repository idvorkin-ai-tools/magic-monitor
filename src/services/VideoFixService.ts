/**
 * Humble Object for WebM video fixing.
 * Wraps fix-webm-duration for seekable video support.
 * See docs/ARCHITECTURE-practice-recorder.md for details.
 */

export const VideoFixService = {
	/**
	 * Fix WebM metadata for seeking support.
	 * MediaRecorder-produced WebM files often lack proper duration metadata,
	 * making them non-seekable. This fixes that issue.
	 *
	 * Note: Only applies to WebM files. MP4 files (used on iOS) don't need this fix.
	 *
	 * @returns Object with blob and wasFixed flag indicating if fix succeeded
	 */
	async fixDuration(
		blob: Blob,
		durationMs?: number,
	): Promise<{ blob: Blob; wasFixed: boolean }> {
		// Only fix WebM files - MP4 (used on iOS) doesn't need this fix
		// and fix-webm-duration would corrupt MP4 files
		if (!blob.type.includes("webm")) {
			return { blob, wasFixed: false };
		}

		try {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			// fix-webm-duration infers duration from WebM when not provided
			// Pass duration if known, otherwise let library calculate it
			const fixed = durationMs
				? await fixWebmDuration(blob, durationMs)
				: await fixWebmDuration(blob, 0); // Library calculates duration when 0
			return { blob: fixed, wasFixed: true };
		} catch (err) {
			console.warn("fix-webm-duration failed, returning original blob:", err);
			return { blob, wasFixed: false };
		}
	},

	/**
	 * Check if fix is needed based on blob type.
	 * Only WebM files need the duration fix - MP4 files have proper metadata.
	 */
	needsFix(blob: Blob): boolean {
		return blob.type.includes("webm");
	},
};

export type VideoFixServiceType = typeof VideoFixService;
