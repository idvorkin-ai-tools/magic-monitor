/**
 * Humble Object for WebM video fixing.
 * Wraps fix-webm-duration for seekable video support.
 * See docs/ARCHITECTURE-practice-recorder.md for details.
 */

export const VideoFixService = {
	/**
	 * Fix WebM metadata for seeking support.
	 * MediaRecorder-produced WebM files carry no Duration in their Info section,
	 * so browsers report `video.duration === Infinity` until the whole file has
	 * been demuxed. This writes the real duration into the header.
	 *
	 * `durationMs` is required in practice: fix-webm-duration writes whatever
	 * number it is handed and never derives one. Handing it 0 stamps
	 * `Duration: 0` into the file - a lie that ffprobe and every other player
	 * honour, and which still leaves the browser reporting Infinity. So an
	 * unknown duration means "don't touch the blob", not "pass 0".
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

		if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) {
			console.warn(
				"fixDuration called without a usable duration - leaving the blob unfixed",
			);
			return { blob, wasFixed: false };
		}

		try {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			const fixed = await fixWebmDuration(blob, durationMs);
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
