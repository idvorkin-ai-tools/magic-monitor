import { useCallback, useEffect, useRef, useState } from "react";
import {
	MediaRecorderService,
	type MediaRecorderServiceType,
} from "../services/MediaRecorderService";
import {
	SessionStorageService,
	type SessionStorageServiceType,
} from "../services/SessionStorageService";
import { TimerService, type TimerServiceType } from "../services/TimerService";
import {
	VideoFixService,
	type VideoFixServiceType,
} from "../services/VideoFixService";
import type { PracticeSession, SessionThumbnail } from "../types/sessions";
import { SESSION_CONFIG } from "../types/sessions";
import { useBlockRecorder } from "./useBlockRecorder";
import { useBlockRotation } from "./useBlockRotation";
import { useSessionList } from "./useSessionList";
import { useThumbnailCapture } from "./useThumbnailCapture";

// ===== Types =====

export interface SessionRecorderConfig {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	enabled: boolean;
	blockDurationMs?: number;
	thumbnailIntervalMs?: number;
	// Dependency injection for testing
	sessionStorageService?: SessionStorageServiceType;
	mediaRecorderService?: MediaRecorderServiceType;
	videoFixService?: VideoFixServiceType;
	timerService?: TimerServiceType;
}

export interface SessionRecorderControls {
	// State
	isRecording: boolean;
	currentBlockDuration: number; // seconds into current block
	currentThumbnails: SessionThumbnail[]; // thumbnails captured so far
	error: string | null;

	// Sessions
	recentSessions: PracticeSession[];
	savedSessions: PracticeSession[];

	// Controls
	stopCurrentBlock: () => Promise<PracticeSession | null>;
	refreshSessions: () => Promise<void>;
}

// ===== Hook implementation =====

/**
 * Orchestrator hook for Practice Session recording.
 * Coordinates smaller focused hooks following Single Responsibility Principle.
 */
export function useSessionRecorder({
	videoRef,
	enabled,
	blockDurationMs = SESSION_CONFIG.BLOCK_DURATION_MS,
	thumbnailIntervalMs = SESSION_CONFIG.THUMBNAIL_INTERVAL_MS,
	sessionStorageService = SessionStorageService,
	mediaRecorderService = MediaRecorderService,
	videoFixService = VideoFixService,
	timerService = TimerService,
}: SessionRecorderConfig): SessionRecorderControls {
	// Duration tracking
	const [currentBlockDuration, setCurrentBlockDuration] = useState(0);
	const durationTimerRef = useRef<number | null>(null);
	const blockStartTimeRef = useRef<number>(0);
	const checkReadyIntervalRef = useRef<number | null>(null);
	const enabledRef = useRef(enabled);
	const startRecordingBlockRef = useRef<(() => void) | null>(null);
	const blockRotationRef = useRef<{
		startRotation: () => void;
		stopRotation: () => void;
	}>({
		startRotation: () => {},
		stopRotation: () => {},
	});

	// Use focused hooks
	const blockRecorder = useBlockRecorder({
		videoRef,
		mediaRecorderService,
		timerService,
	});

	const thumbnailCapture = useThumbnailCapture({
		videoRef,
		thumbnailIntervalMs,
		timerService,
	});

	const sessionList = useSessionList({
		sessionStorageService,
		videoFixService,
	});
	// Destructure stable callbacks to use in dependency arrays
	const { saveBlock } = sessionList;

	// Keep enabledRef in sync with enabled prop
	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);

	// Stop current recording block
	const stopCurrentBlock =
		useCallback(async (): Promise<PracticeSession | null> => {
			// Stop duration timer
			if (durationTimerRef.current) {
				timerService.clearInterval(durationTimerRef.current);
				durationTimerRef.current = null;
			}

			// Stop block rotation
			blockRotationRef.current.stopRotation();

			// Stop thumbnail capture
			const thumbnails = thumbnailCapture.stopCapture();

			// Stop recording
			const result = await blockRecorder.stopRecording();
			if (!result) {
				setCurrentBlockDuration(0);
				return null;
			}

			// Save the block
			const session = await saveBlock(
				result.blob,
				result.duration,
				thumbnails,
				blockStartTimeRef.current,
			);

			setCurrentBlockDuration(0);
			return session;
		}, [blockRecorder, thumbnailCapture, saveBlock, timerService]);

	// Handle block rotation
	const onBlockComplete = useCallback(async () => {
		const completedSession = await stopCurrentBlock();
		if (completedSession && enabledRef.current) {
			// Start a new block using ref to avoid circular dependency
			startRecordingBlockRef.current?.();
		}
	}, [stopCurrentBlock]);

	const blockRotation = useBlockRotation({
		blockDurationMs,
		onBlockComplete,
		timerService,
	});

	// Update blockRotationRef with the latest blockRotation during render
	blockRotationRef.current = blockRotation;

	// Start a new recording block
	const startRecordingBlock = useCallback(() => {
		blockStartTimeRef.current = timerService.now();
		setCurrentBlockDuration(0);

		// Start recording
		blockRecorder.startRecording();

		// Start thumbnail capture
		thumbnailCapture.startCapture(blockStartTimeRef.current);

		// Set up duration update interval
		durationTimerRef.current = timerService.setInterval(() => {
			const elapsed = (timerService.now() - blockStartTimeRef.current) / 1000;
			setCurrentBlockDuration(elapsed);
		}, 1000);

		// Set up block rotation timer
		blockRotationRef.current.startRotation();
	}, [blockRecorder, thumbnailCapture, timerService]);

	// Keep ref in sync with latest startRecordingBlock
	useEffect(() => {
		startRecordingBlockRef.current = startRecordingBlock;
	}, [startRecordingBlock]);

	// Main recording effect
	useEffect(() => {
		if (!enabled) {
			// Stop recording when disabled
			if (blockRecorder.getState() === "recording") {
				stopCurrentBlock();
			}
			// Clear any pending ready check
			if (checkReadyIntervalRef.current) {
				timerService.clearInterval(checkReadyIntervalRef.current);
				checkReadyIntervalRef.current = null;
			}
			return;
		}

		// Wait for video to be ready
		const video = videoRef.current;
		if (!video || video.readyState < 3) {
			// Clear any existing check interval before starting a new one
			if (checkReadyIntervalRef.current) {
				timerService.clearInterval(checkReadyIntervalRef.current);
				checkReadyIntervalRef.current = null;
			}

			let attempts = 0;
			const MAX_ATTEMPTS = 50; // 5 seconds

			checkReadyIntervalRef.current = timerService.setInterval(() => {
				attempts++;
				if (videoRef.current && videoRef.current.readyState >= 3) {
					// Clear interval before starting recording
					if (checkReadyIntervalRef.current) {
						timerService.clearInterval(checkReadyIntervalRef.current);
						checkReadyIntervalRef.current = null;
					}
					// Verify still enabled before starting
					if (enabledRef.current) {
						startRecordingBlock();
					}
				} else if (attempts >= MAX_ATTEMPTS) {
					if (checkReadyIntervalRef.current) {
						timerService.clearInterval(checkReadyIntervalRef.current);
						checkReadyIntervalRef.current = null;
					}
					// Error is handled by blockRecorder
				}
			}, 100);

			return () => {
				if (checkReadyIntervalRef.current) {
					timerService.clearInterval(checkReadyIntervalRef.current);
					checkReadyIntervalRef.current = null;
				}
			};
		}

		// Video is ready, start recording
		startRecordingBlock();

		return () => {
			// Clear check ready interval if still running
			if (checkReadyIntervalRef.current) {
				timerService.clearInterval(checkReadyIntervalRef.current);
				checkReadyIntervalRef.current = null;
			}
			// Stop active recording session
			if (blockRecorder.getState() === "recording") {
				blockRecorder.stopRecording().catch(console.error);
			}
			// Cleanup duration timer
			if (durationTimerRef.current) {
				timerService.clearInterval(durationTimerRef.current);
			}
		};
	}, [
		enabled,
		videoRef,
		startRecordingBlock,
		stopCurrentBlock,
		timerService,
		blockRecorder,
	]);

	// Combine errors from all hooks
	const combinedError =
		blockRecorder.error || sessionList.error || null;

	return {
		// State
		isRecording: blockRecorder.isRecording,
		currentBlockDuration,
		currentThumbnails: thumbnailCapture.thumbnails,
		error: combinedError,

		// Sessions
		recentSessions: sessionList.recentSessions,
		savedSessions: sessionList.savedSessions,

		// Controls
		stopCurrentBlock,
		refreshSessions: sessionList.refreshSessions,
	};
}
