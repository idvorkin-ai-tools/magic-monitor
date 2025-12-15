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
	 */
	async fixDuration(blob: Blob, durationMs?: number): Promise<Blob> {
		try {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			// fix-webm-duration infers duration from WebM when not provided
			// Pass duration if known, otherwise let library calculate it
			const fixed = durationMs
				? await fixWebmDuration(blob, durationMs)
				: await fixWebmDuration(blob, 0); // Library calculates duration when 0
			return fixed;
		} catch (err) {
			console.warn("fix-webm-duration failed, returning original blob:", err);
			return blob;
		}
	},

	/**
	 * Check if fix is needed based on browser capabilities.
	 * Some browsers (Safari 18.4+) may produce seekable WebM natively.
	 */
	needsFix(): boolean {
		// For now, always assume fix is needed
		// Could add detection for browsers that produce seekable WebM natively
		return true;
	},
};

export type VideoFixServiceType = typeof VideoFixService;
