/**
 * Humble Object for thumbnail capture operations.
 * Isolates canvas operations for testability.
 * See docs/ARCHITECTURE-practice-recorder.md for details.
 */

export const ThumbnailCaptureService = {
	/**
	 * Capture a frame from a video element as JPEG data URL.
	 */
	captureFromVideo(video: HTMLVideoElement, quality = 0.7): string {
		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Cannot get canvas context");
		}
		ctx.drawImage(video, 0, 0);
		return canvas.toDataURL("image/jpeg", quality);
	},

	/**
	 * Capture a frame at a specific time from a video blob.
	 * Returns a promise that resolves to a JPEG data URL.
	 */
	async captureAtTime(
		blob: Blob,
		timeSeconds: number,
		quality = 0.7,
	): Promise<string> {
		return new Promise((resolve, reject) => {
			const video = document.createElement("video");
			video.muted = true;
			video.playsInline = true;
			const url = URL.createObjectURL(blob);
			video.src = url;

			const cleanup = () => {
				URL.revokeObjectURL(url);
			};

			video.onloadedmetadata = () => {
				// Clamp time to valid range
				const clampedTime = Math.min(timeSeconds, video.duration);
				video.currentTime = clampedTime;
			};

			video.onseeked = () => {
				try {
					const dataUrl = this.captureFromVideo(video, quality);
					cleanup();
					resolve(dataUrl);
				} catch (err) {
					cleanup();
					reject(err);
				}
			};

			video.onerror = () => {
				cleanup();
				reject(new Error("Failed to load video for thumbnail capture"));
			};

			video.load();
		});
	},

	/**
	 * Generate multiple thumbnails at regular intervals from a video blob.
	 * Returns an array of { time, dataUrl } objects.
	 */
	async generateThumbnailsAtIntervals(
		blob: Blob,
		intervalSeconds: number,
		quality = 0.7,
	): Promise<Array<{ time: number; dataUrl: string }>> {
		return new Promise((resolve, reject) => {
			const video = document.createElement("video");
			video.muted = true;
			video.playsInline = true;
			const url = URL.createObjectURL(blob);
			video.src = url;

			const thumbnails: Array<{ time: number; dataUrl: string }> = [];
			let currentTime = 0;

			const cleanup = () => {
				URL.revokeObjectURL(url);
			};

			const captureNext = () => {
				if (currentTime > video.duration) {
					cleanup();
					resolve(thumbnails);
					return;
				}

				video.currentTime = currentTime;
			};

			video.onloadedmetadata = () => {
				captureNext();
			};

			video.onseeked = () => {
				try {
					const dataUrl = this.captureFromVideo(video, quality);
					thumbnails.push({ time: currentTime, dataUrl });
					currentTime += intervalSeconds;
					captureNext();
				} catch (err) {
					cleanup();
					reject(err);
				}
			};

			video.onerror = () => {
				cleanup();
				reject(new Error("Failed to load video for thumbnail generation"));
			};

			video.load();
		});
	},
};

export type ThumbnailCaptureServiceType = typeof ThumbnailCaptureService;
