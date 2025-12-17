/**
 * Humble Object for MediaRecorder and related browser APIs.
 * Isolates MediaRecorder, URL.createObjectURL, canvas operations for testability.
 */

export interface RecordingChunk {
	blob: Blob;
	duration: number;
}

export interface MediaRecorderConfig {
	videoBitsPerSecond?: number;
}

export interface RecordingSession {
	start: () => void;
	stop: () => Promise<RecordingChunk>;
	getState: () => RecordingState;
}

export const MediaRecorderService = {
	/**
	 * Check if a MIME type is supported by MediaRecorder.
	 */
	isTypeSupported(mimeType: string): boolean {
		return (
			typeof MediaRecorder !== "undefined" &&
			MediaRecorder.isTypeSupported(mimeType)
		);
	},

	/**
	 * Get the best supported video codec.
	 * iOS Safari requires MP4 (doesn't support WebM at all).
	 * Other browsers prefer WebM with VP9 for better compression.
	 */
	getBestCodec(): string {
		// Try WebM with VP9 first (best compression, works on Chrome/Firefox/Edge)
		if (this.isTypeSupported("video/webm;codecs=vp9")) {
			return "video/webm;codecs=vp9";
		}
		// Try plain WebM (broader browser support)
		if (this.isTypeSupported("video/webm")) {
			return "video/webm";
		}
		// Try MP4 with H.264 baseline profile (required for iOS Safari)
		// avc1.42E01E = H.264 Baseline Profile Level 3.0 (widely compatible)
		if (this.isTypeSupported("video/mp4;codecs=avc1.42E01E")) {
			return "video/mp4;codecs=avc1.42E01E";
		}
		if (this.isTypeSupported("video/mp4;codecs=avc1")) {
			return "video/mp4;codecs=avc1";
		}
		if (this.isTypeSupported("video/mp4")) {
			return "video/mp4";
		}
		// Last resort - let browser pick
		return "";
	},

	/**
	 * Start recording from a MediaStream.
	 * Returns a recording session with start/stop/getState methods.
	 */
	startRecording(
		stream: MediaStream,
		config: MediaRecorderConfig = {},
	): RecordingSession {
		const mimeType = this.getBestCodec();

		const recorder = new MediaRecorder(stream, {
			mimeType,
			videoBitsPerSecond: config.videoBitsPerSecond ?? 2500000,
		});

		const chunks: Blob[] = [];
		const startTime = Date.now();

		return {
			start: () => {
				recorder.ondataavailable = (e) => {
					if (e.data.size > 0) {
						chunks.push(e.data);
					}
				};

				try {
					recorder.start();
				} catch (err) {
					// Provide a meaningful error message when MediaRecorder.start() fails
					// Common causes: unsupported codec, invalid stream state, no active tracks
					const errorMessage = err instanceof Error ? err.message : String(err);
					throw new Error(
						`Failed to start recording. This may occur if the codec is not supported, the stream is in an invalid state, or there are no active video tracks. Original error: ${errorMessage}`,
					);
				}
			},
			stop: (): Promise<RecordingChunk> => {
				return new Promise((resolve, reject) => {
					recorder.onstop = () => {
						const blob = new Blob(chunks, { type: mimeType });
						const duration = Date.now() - startTime;
						// Clear chunks array to release memory
						chunks.length = 0;
						// Clear event handlers to help GC
						recorder.ondataavailable = null;
						recorder.onstop = null;
						recorder.onerror = null;
						resolve({ blob, duration });
					};
					recorder.onerror = () => {
						// Clear on error too
						chunks.length = 0;
						recorder.ondataavailable = null;
						recorder.onstop = null;
						recorder.onerror = null;
						reject(new Error("Recording failed"));
					};
					if (recorder.state === "recording") {
						recorder.stop();
					} else {
						reject(new Error("Recorder not in recording state"));
					}
				});
			},
			getState: () => recorder.state,
		};
	},

	/**
	 * Create a video element for playback.
	 */
	createPlaybackElement(): HTMLVideoElement {
		const video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		return video;
	},

	/**
	 * Load a blob into a video element and return the blob URL.
	 * Automatically revokes previous blob URL if present.
	 */
	loadBlob(video: HTMLVideoElement, blob: Blob): string {
		// Revoke previous blob URL if any
		if (video.src?.startsWith("blob:")) {
			URL.revokeObjectURL(video.src);
		}
		const blobUrl = URL.createObjectURL(blob);
		video.src = blobUrl;
		video.load();
		return blobUrl;
	},

	/**
	 * Revoke a blob URL to free memory.
	 */
	revokeObjectUrl(url: string): void {
		if (url.startsWith("blob:")) {
			URL.revokeObjectURL(url);
		}
	},
};

export type MediaRecorderServiceType = typeof MediaRecorderService;
