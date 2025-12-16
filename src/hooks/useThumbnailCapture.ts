import { useCallback, useRef, useState } from "react";
import { ThumbnailCaptureService } from "../services/ThumbnailCaptureService";
import { TimerService, type TimerServiceType } from "../services/TimerService";
import type { SessionThumbnail } from "../types/sessions";
import { SESSION_CONFIG } from "../types/sessions";

export interface ThumbnailCaptureConfig {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	thumbnailIntervalMs?: number;
	timerService?: TimerServiceType;
}

export interface StopCaptureOptions {
	/** Skip state updates - use during cleanup/unmount */
	forCleanup?: boolean;
}

export interface ThumbnailCaptureControls {
	thumbnails: SessionThumbnail[];
	startCapture: (blockStartTime: number) => void;
	stopCapture: (options?: StopCaptureOptions) => SessionThumbnail[];
	captureNow: (blockStartTime: number) => void;
}

/**
 * Hook for capturing thumbnails from live video during recording.
 * Single Responsibility: Thumbnail generation.
 */
export function useThumbnailCapture({
	videoRef,
	thumbnailIntervalMs = SESSION_CONFIG.THUMBNAIL_INTERVAL_MS,
	timerService = TimerService,
}: ThumbnailCaptureConfig): ThumbnailCaptureControls {
	const [thumbnails, setThumbnails] = useState<SessionThumbnail[]>([]);
	const thumbnailsRef = useRef<SessionThumbnail[]>([]);
	const thumbnailTimerRef = useRef<number | null>(null);
	const firstFrameRetryRef = useRef<number | null>(null);
	const blockStartTimeRef = useRef<number>(0);
	const isCapturingRef = useRef(false); // Track if capture is active to avoid setState after stop

	const captureNow = useCallback(
		(blockStartTime: number) => {
			// Skip if capture was stopped (prevents setState after unmount)
			if (!isCapturingRef.current) return;

			const video = videoRef.current;
			if (!video || video.readyState < 2) return;

			try {
				const dataUrl = ThumbnailCaptureService.captureFromVideo(
					video,
					SESSION_CONFIG.THUMBNAIL_QUALITY,
				);
				const time = (timerService.now() - blockStartTime) / 1000;
				const newThumbnail = { time, dataUrl };
				thumbnailsRef.current = [...thumbnailsRef.current, newThumbnail];
				// Double-check still capturing before setState
				if (isCapturingRef.current) {
					setThumbnails((prev) => [...prev, newThumbnail]);
				}
			} catch (err) {
				console.warn("Failed to capture thumbnail:", err);
			}
		},
		[videoRef, timerService],
	);

	const startCapture = useCallback(
		(blockStartTime: number) => {
			blockStartTimeRef.current = blockStartTime;
			thumbnailsRef.current = [];
			setThumbnails([]);
			isCapturingRef.current = true;

			// Clear any existing first frame retry
			if (firstFrameRetryRef.current) {
				timerService.clearInterval(firstFrameRetryRef.current);
				firstFrameRetryRef.current = null;
			}

			// Try to capture first thumbnail immediately
			const video = videoRef.current;
			const videoReady = video && video.readyState >= 2;

			if (videoReady) {
				captureNow(blockStartTime);
			} else {
				// Video not ready - retry until we get the first frame
				let retryCount = 0;
				const MAX_RETRIES = 50; // 5 seconds max
				firstFrameRetryRef.current = timerService.setInterval(() => {
					retryCount++;
					// Stop retrying if we got a thumbnail, stopped capturing, or hit max
					if (thumbnailsRef.current.length > 0 || !isCapturingRef.current || retryCount >= MAX_RETRIES) {
						if (firstFrameRetryRef.current) {
							timerService.clearInterval(firstFrameRetryRef.current);
							firstFrameRetryRef.current = null;
						}
						return;
					}
					// Try to capture
					captureNow(blockStartTimeRef.current);
				}, 100);
			}

			// Set up interval for subsequent captures
			thumbnailTimerRef.current = timerService.setInterval(() => {
				captureNow(blockStartTimeRef.current);
			}, thumbnailIntervalMs);
		},
		[captureNow, thumbnailIntervalMs, timerService, videoRef],
	);

	const stopCapture = useCallback(
		(options?: StopCaptureOptions) => {
			const { forCleanup = false } = options ?? {};

			// Mark as not capturing FIRST to prevent any pending interval callbacks from setState
			isCapturingRef.current = false;

			if (thumbnailTimerRef.current) {
				timerService.clearInterval(thumbnailTimerRef.current);
				thumbnailTimerRef.current = null;
			}

			if (firstFrameRetryRef.current) {
				timerService.clearInterval(firstFrameRetryRef.current);
				firstFrameRetryRef.current = null;
			}

			const captured = [...thumbnailsRef.current];
			thumbnailsRef.current = [];
			// Skip state updates during cleanup to avoid setState on unmount
			if (!forCleanup) {
				setThumbnails([]);
			}
			return captured;
		},
		[timerService],
	);

	return {
		thumbnails,
		startCapture,
		stopCapture,
		captureNow,
	};
}
