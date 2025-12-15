import { useCallback, useEffect, useRef, useState } from "react";
import {
	MediaRecorderService,
	type MediaRecorderServiceType,
	type RecordingSession,
} from "../services/MediaRecorderService";
import {
	SessionStorageService,
	type SessionStorageServiceType,
} from "../services/SessionStorageService";
import { ThumbnailCaptureService } from "../services/ThumbnailCaptureService";
import { TimerService, type TimerServiceType } from "../services/TimerService";
import {
	VideoFixService,
	type VideoFixServiceType,
} from "../services/VideoFixService";
import type { PracticeSession, SessionThumbnail } from "../types/sessions";
import { SESSION_CONFIG } from "../types/sessions";

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
	// Recording state
	const [isRecording, setIsRecording] = useState(false);
	const [currentBlockDuration, setCurrentBlockDuration] = useState(0);
	const [currentThumbnails, setCurrentThumbnails] = useState<
		SessionThumbnail[]
	>([]);
	const [error, setError] = useState<string | null>(null);

	// Session lists
	const [recentSessions, setRecentSessions] = useState<PracticeSession[]>([]);
	const [savedSessions, setSavedSessions] = useState<PracticeSession[]>([]);

	// Refs
	const recordingSessionRef = useRef<RecordingSession | null>(null);
	const blockStartTimeRef = useRef<number>(0);
	const blockTimerRef = useRef<number | null>(null);
	const thumbnailTimerRef = useRef<number | null>(null);
	const durationTimerRef = useRef<number | null>(null);
	const currentThumbnailsRef = useRef<SessionThumbnail[]>([]);
	const enabledRef = useRef(enabled);
	const checkReadyIntervalRef = useRef<number | null>(null);

	// Initialize storage and load sessions
	useEffect(() => {
		async function init() {
			try {
				await sessionStorageService.init();
				const recent = await sessionStorageService.getRecentSessions();
				const saved = await sessionStorageService.getSavedSessions();
				setRecentSessions(recent);
				setSavedSessions(saved);
			} catch (err) {
				console.error("Failed to initialize session storage:", err);
				setError("Storage unavailable - recording disabled");
			}
		}
		init();
	}, [sessionStorageService]);

	// Keep enabledRef in sync with enabled prop
	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);

	// Refresh sessions from storage
	const refreshSessions = useCallback(async () => {
		try {
			const recent = await sessionStorageService.getRecentSessions();
			const saved = await sessionStorageService.getSavedSessions();
			setRecentSessions(recent);
			setSavedSessions(saved);
		} catch (err) {
			console.error("Failed to refresh sessions:", err);
		}
	}, [sessionStorageService]);

	// Capture a thumbnail from the live video
	const captureThumbnail = useCallback(() => {
		const video = videoRef.current;
		if (!video || video.readyState < 2) return;

		try {
			const dataUrl = ThumbnailCaptureService.captureFromVideo(
				video,
				SESSION_CONFIG.THUMBNAIL_QUALITY,
			);
			const time = (timerService.now() - blockStartTimeRef.current) / 1000;
			const newThumbnail = { time, dataUrl };
			currentThumbnailsRef.current = [
				...currentThumbnailsRef.current,
				newThumbnail,
			];
			setCurrentThumbnails((prev) => [...prev, newThumbnail]);
		} catch (err) {
			console.warn("Failed to capture thumbnail:", err);
		}
	}, [videoRef, timerService]);

	// Finalize a recording block
	const finalizeBlock = useCallback(
		async (
			recordedBlob: Blob,
			duration: number,
			thumbnails: SessionThumbnail[],
		): Promise<PracticeSession | null> => {
			if (recordedBlob.size === 0) return null;

			try {
				// MediaRecorderService.stop() already combines chunks into a single blob
				const rawBlob = recordedBlob;

				// Fix WebM metadata for seekability
				const fixedBlob = videoFixService.needsFix()
					? await videoFixService.fixDuration(rawBlob)
					: rawBlob;

				// Get first frame as thumbnail
				const firstThumbnail =
					thumbnails.length > 0
						? thumbnails[0].dataUrl
						: await ThumbnailCaptureService.captureAtTime(fixedBlob, 0);

				// Create session object
				// Note: blobKey will be same as session.id (set after saveSession returns the id)
				const session: Omit<PracticeSession, "id"> = {
					createdAt: blockStartTimeRef.current,
					duration: duration / 1000, // Convert to seconds
					blobKey: "", // Placeholder - blob is stored and retrieved using session.id
					thumbnail: firstThumbnail,
					thumbnails,
					saved: false,
				};

				// Save to storage
				const id = await sessionStorageService.saveSession(session);
				await sessionStorageService.saveBlob(id, fixedBlob);

				// Prune old sessions
				await sessionStorageService.pruneOldSessions();

				// Refresh session lists
				await refreshSessions();

				// Return session with correct blobKey (same as id)
				return { ...session, id, blobKey: id };
			} catch (err) {
				console.error("Failed to finalize block:", err);
				setError("Failed to save recording block");
				return null;
			}
		},
		[videoFixService, sessionStorageService, refreshSessions],
	);

	// Stop current recording block
	const stopCurrentBlock =
		useCallback(async (): Promise<PracticeSession | null> => {
			const session = recordingSessionRef.current;
			if (!session || session.getState() !== "recording") {
				return null;
			}

			// Clear timers (blockTimer uses setTimeout, others use setInterval)
			if (blockTimerRef.current) {
				timerService.clearTimeout(blockTimerRef.current);
				blockTimerRef.current = null;
			}
			if (thumbnailTimerRef.current) {
				timerService.clearInterval(thumbnailTimerRef.current);
				thumbnailTimerRef.current = null;
			}
			if (durationTimerRef.current) {
				timerService.clearInterval(durationTimerRef.current);
				durationTimerRef.current = null;
			}

			try {
				const result = await session.stop();
				recordingSessionRef.current = null;
				setIsRecording(false);

				// Finalize the block - use ref to avoid dependency on state
				const thumbnails = [...currentThumbnailsRef.current];
				currentThumbnailsRef.current = [];
				setCurrentThumbnails([]);
				setCurrentBlockDuration(0);

				return await finalizeBlock(result.blob, result.duration, thumbnails);
			} catch (err) {
				console.error("Failed to stop recording:", err);
				recordingSessionRef.current = null;
				setIsRecording(false);
				return null;
			}
		}, [finalizeBlock, timerService]);

	// Start a new recording block
	const startRecordingBlock = useCallback(() => {
		const video = videoRef.current;
		if (!video || !video.srcObject) {
			setError("Camera not available");
			return;
		}

		const stream = video.srcObject as MediaStream;

		try {
			const session = mediaRecorderService.startRecording(stream, {
				videoBitsPerSecond: SESSION_CONFIG.VIDEO_BITRATE,
			});

			blockStartTimeRef.current = timerService.now();
			currentThumbnailsRef.current = [];
			setCurrentThumbnails([]);
			setCurrentBlockDuration(0);
			setError(null);

			// Wrap session.start() in try-catch to handle MediaRecorder failures
			try {
				session.start();
			} catch (startErr) {
				// MediaRecorder.start() failed - surface the error to the user
				const errorMessage =
					startErr instanceof Error
						? startErr.message
						: "Failed to start recording";
				console.error("MediaRecorder.start() failed:", startErr);
				setError(errorMessage);
				setIsRecording(false);
				return;
			}

			recordingSessionRef.current = session;
			setIsRecording(true);

			// Capture first thumbnail immediately
			captureThumbnail();

			// Set up thumbnail capture interval
			thumbnailTimerRef.current = timerService.setInterval(
				captureThumbnail,
				thumbnailIntervalMs,
			);

			// Set up duration update interval
			durationTimerRef.current = timerService.setInterval(() => {
				const elapsed = (timerService.now() - blockStartTimeRef.current) / 1000;
				setCurrentBlockDuration(elapsed);
			}, 1000);

			// Set up block rotation timer
			blockTimerRef.current = timerService.setTimeout(async () => {
				const completedSession = await stopCurrentBlock();
				if (completedSession && enabledRef.current) {
					// Start a new block
					startRecordingBlock();
				}
			}, blockDurationMs);
		} catch (err) {
			console.error("Failed to create recording session:", err);
			setError("Recording failed - check camera connection");
			setIsRecording(false);
		}
	}, [
		videoRef,
		mediaRecorderService,
		timerService,
		captureThumbnail,
		thumbnailIntervalMs,
		blockDurationMs,
		stopCurrentBlock,
	]);

	// Main recording effect
	useEffect(() => {
		if (!enabled) {
			// Stop recording when disabled
			if (recordingSessionRef.current) {
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
					setError("Camera not ready - recording could not start");
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
			if (recordingSessionRef.current) {
				const session = recordingSessionRef.current;
				if (session.getState() === "recording") {
					session.stop().catch(console.error);
				}
				recordingSessionRef.current = null;
			}
			// Cleanup on unmount
			if (blockTimerRef.current) {
				timerService.clearTimeout(blockTimerRef.current);
			}
			if (thumbnailTimerRef.current) {
				timerService.clearInterval(thumbnailTimerRef.current);
			}
			if (durationTimerRef.current) {
				timerService.clearInterval(durationTimerRef.current);
			}
		};
	}, [enabled, videoRef, startRecordingBlock, stopCurrentBlock, timerService]);

	return {
		// State
		isRecording,
		currentBlockDuration,
		currentThumbnails,
		error,

		// Sessions
		recentSessions,
		savedSessions,

		// Controls
		stopCurrentBlock,
		refreshSessions,
	};
}
