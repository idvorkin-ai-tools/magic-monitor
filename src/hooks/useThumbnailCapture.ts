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

export interface ThumbnailCaptureControls {
	thumbnails: SessionThumbnail[];
	startCapture: (blockStartTime: number) => void;
	stopCapture: () => SessionThumbnail[];
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
	const blockStartTimeRef = useRef<number>(0);

	const captureNow = useCallback(
		(blockStartTime: number) => {
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
				setThumbnails((prev) => [...prev, newThumbnail]);
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

			// Capture first thumbnail immediately
			captureNow(blockStartTime);

			// Set up interval for subsequent captures
			thumbnailTimerRef.current = timerService.setInterval(() => {
				captureNow(blockStartTimeRef.current);
			}, thumbnailIntervalMs);
		},
		[captureNow, thumbnailIntervalMs, timerService],
	);

	const stopCapture = useCallback(() => {
		if (thumbnailTimerRef.current) {
			timerService.clearInterval(thumbnailTimerRef.current);
			thumbnailTimerRef.current = null;
		}

		const captured = [...thumbnailsRef.current];
		thumbnailsRef.current = [];
		setThumbnails([]);
		return captured;
	}, [timerService]);

	return {
		thumbnails,
		startCapture,
		stopCapture,
		captureNow,
	};
}
