import { useCallback, useEffect, useRef, useState } from "react";
import {
	SessionRecorderMachine,
	type SessionRecorderState,
} from "../machines/SessionRecorderMachine";
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
 * Uses SessionRecorderMachine for state management,
 * delegates to focused hooks for individual concerns.
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
	// State exposed to consumers
	const [isRecording, setIsRecording] = useState(false);
	const [currentBlockDuration, setCurrentBlockDuration] = useState(0);

	// Duration tracking
	const durationTimerRef = useRef<number | null>(null);
	const blockStartTimeRef = useRef<number>(0);

	// Video readiness polling
	const videoReadyIntervalRef = useRef<number | null>(null);

	// Use focused hooks for individual concerns
	const blockRecorder = useBlockRecorder({
		videoRef,
		mediaRecorderService,
		timerService,
	});
	const { startRecording, stopRecording } = blockRecorder;

	const thumbnailCapture = useThumbnailCapture({
		videoRef,
		thumbnailIntervalMs,
		timerService,
	});
	const { startCapture, stopCapture } = thumbnailCapture;

	const sessionList = useSessionList({
		sessionStorageService,
		videoFixService,
	});
	const { saveBlock, refreshSessions, isInitialized } = sessionList;

	// Store callbacks in refs so machine doesn't need to be recreated
	const startRecordingRef = useRef(startRecording);
	const stopRecordingRef = useRef(stopRecording);
	const startCaptureRef = useRef(startCapture);
	const stopCaptureRef = useRef(stopCapture);
	const saveBlockRef = useRef(saveBlock);

	// Keep refs up to date
	useEffect(() => {
		startRecordingRef.current = startRecording;
		stopRecordingRef.current = stopRecording;
		startCaptureRef.current = startCapture;
		stopCaptureRef.current = stopCapture;
		saveBlockRef.current = saveBlock;
	}, [startRecording, stopRecording, startCapture, stopCapture, saveBlock]);

	// Create machine with callbacks that use refs (so they're always current)
	const machineRef = useRef<SessionRecorderMachine | null>(null);

	// Block rotation callback
	const onBlockComplete = useCallback(async () => {
		machineRef.current?.blockTimerFired();
	}, []);

	const blockRotation = useBlockRotation({
		blockDurationMs,
		onBlockComplete,
		timerService,
	});
	const { startRotation, stopRotation } = blockRotation;

	// Store rotation refs
	const startRotationRef = useRef(startRotation);
	const stopRotationRef = useRef(stopRotation);
	useEffect(() => {
		startRotationRef.current = startRotation;
		stopRotationRef.current = stopRotation;
	}, [startRotation, stopRotation]);

	// Initialize machine once
	useEffect(() => {
		if (machineRef.current === null) {
			machineRef.current = new SessionRecorderMachine({
				onStartRecording: () => startRecordingRef.current(),
				onStopRecording: () => stopRecordingRef.current(),
				onStartThumbnails: (blockStartTime: number) =>
					startCaptureRef.current(blockStartTime),
				onStopThumbnails: () => stopCaptureRef.current(),
				onStartBlockTimer: () => startRotationRef.current(),
				onStopBlockTimer: () => stopRotationRef.current(),
				onSaveBlock: async (
					blob: Blob,
					duration: number,
					thumbnails: SessionThumbnail[],
					blockStartTime: number,
				) => {
					return saveBlockRef.current(
						blob,
						duration,
						thumbnails,
						blockStartTime,
					);
				},
				onStateChange: (state: SessionRecorderState) => {
					setIsRecording(state.type === "recording");
					if (state.type === "recording") {
						blockStartTimeRef.current = state.blockStart;
					}
				},
				now: () => timerService.now(),
			});
		}
	}, [timerService]);

	// Duration timer effect - updates display while recording
	useEffect(() => {
		if (isRecording) {
			durationTimerRef.current = timerService.setInterval(() => {
				const elapsed =
					(timerService.now() - blockStartTimeRef.current) / 1000;
				setCurrentBlockDuration(elapsed);
			}, 1000);
		} else {
			if (durationTimerRef.current) {
				timerService.clearInterval(durationTimerRef.current);
				durationTimerRef.current = null;
			}
			// Reset duration display when recording stops - intentional synchronous setState
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setCurrentBlockDuration(0);
		}

		return () => {
			if (durationTimerRef.current) {
				timerService.clearInterval(durationTimerRef.current);
				durationTimerRef.current = null;
			}
		};
	}, [isRecording, timerService]);

	// Storage initialization effect
	useEffect(() => {
		// When sessionList finishes init, notify machine
		if (sessionList.error) {
			machineRef.current?.storageInitFailed();
		} else if (isInitialized) {
			// Only notify machine when storage is actually initialized
			machineRef.current?.storageInitialized();
		}
	}, [sessionList.error, isInitialized]);

	// Video readiness detection effect
	useEffect(() => {
		const checkVideoReady = () => {
			const video = videoRef.current;
			const isReady = video && video.readyState >= 3;

			if (isReady) {
				machineRef.current?.videoIsReady();
				// Stop polling once video is ready to prevent memory leak
				if (videoReadyIntervalRef.current) {
					timerService.clearInterval(videoReadyIntervalRef.current);
					videoReadyIntervalRef.current = null;
				}
			}
		};

		// Check immediately
		checkVideoReady();

		// Poll for readiness changes (only if not already ready)
		if (!videoReadyIntervalRef.current) {
			videoReadyIntervalRef.current = timerService.setInterval(
				checkVideoReady,
				100,
			);
		}

		return () => {
			if (videoReadyIntervalRef.current) {
				timerService.clearInterval(videoReadyIntervalRef.current);
				videoReadyIntervalRef.current = null;
			}
		};
	}, [videoRef, timerService]);

	// Enable/disable effect - reacts to prop changes
	useEffect(() => {
		if (enabled) {
			machineRef.current?.enable();
		} else {
			machineRef.current?.disable();
		}
	}, [enabled]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			machineRef.current?.disable();
		};
	}, []);

	// Stop current block manually - returns the saved session directly from the machine
	const stopCurrentBlock =
		useCallback(async (): Promise<PracticeSession | null> => {
			const session = await machineRef.current?.stopCurrentBlock();
			return session ?? null;
		}, []);

	// Combine errors from all hooks
	const combinedError = blockRecorder.error || sessionList.error || null;

	return {
		// State
		isRecording,
		currentBlockDuration,
		currentThumbnails: thumbnailCapture.thumbnails,
		error: combinedError,

		// Sessions
		recentSessions: sessionList.recentSessions,
		savedSessions: sessionList.savedSessions,

		// Controls
		stopCurrentBlock,
		refreshSessions,
	};
}
