import { useCallback, useRef, useState } from "react";
import {
	DeviceService,
	type DeviceServiceType,
} from "../services/DeviceService";
import {
	MediaRecorderService,
	type MediaRecorderServiceType,
	type RecordingSession,
} from "../services/MediaRecorderService";
import { TimerService, type TimerServiceType } from "../services/TimerService";
import { SESSION_CONFIG } from "../types/sessions";

export interface BlockRecorderConfig {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	mediaRecorderService?: MediaRecorderServiceType;
	timerService?: TimerServiceType;
	deviceService?: DeviceServiceType;
}

export interface StopRecordingOptions {
	/** Skip state updates - use during cleanup/unmount */
	forCleanup?: boolean;
}

export interface BlockRecorderControls {
	isRecording: boolean;
	error: string | null;
	startRecording: () => void;
	stopRecording: (options?: StopRecordingOptions) => Promise<{ blob: Blob; duration: number } | null>;
	getState: () => RecordingState;
}

/**
 * Get the appropriate video bitrate based on device type.
 * Mobile devices use lower bitrate to reduce encoder strain.
 */
function getVideoBitrate(deviceService: DeviceServiceType): number {
	return deviceService.isMobileDevice()
		? SESSION_CONFIG.VIDEO_BITRATE_MOBILE
		: SESSION_CONFIG.VIDEO_BITRATE_DESKTOP;
}

/**
 * Hook for managing MediaRecorder lifecycle (start/stop recording).
 * Single Responsibility: MediaRecorder session management.
 */
export function useBlockRecorder({
	videoRef,
	mediaRecorderService = MediaRecorderService,
	timerService = TimerService,
	deviceService = DeviceService,
}: BlockRecorderConfig): BlockRecorderControls {
	const [isRecording, setIsRecording] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const recordingSessionRef = useRef<RecordingSession | null>(null);
	const blockStartTimeRef = useRef<number>(0);
	const clonedStreamRef = useRef<MediaStream | null>(null); // Track cloned stream for cleanup

	const startRecording = useCallback(() => {
		const video = videoRef.current;
		if (!video || !video.srcObject) {
			setError("Camera not available");
			return;
		}

		// Clone the stream for recording to avoid affecting the main video display
		// This prevents encoder state from impacting MediaPipe hand tracking
		const originalStream = video.srcObject as MediaStream;
		const stream = originalStream.clone();
		clonedStreamRef.current = stream; // Store for cleanup on stop

		// Validate stream health before attempting to record
		if (!stream.active) {
			setError("Camera stream is not active. Try refreshing the page.");
			return;
		}

		const videoTracks = stream.getVideoTracks();
		if (videoTracks.length === 0) {
			setError("No video track available from camera.");
			return;
		}

		const liveTrack = videoTracks.find((t) => t.readyState === "live");
		if (!liveTrack) {
			setError("Camera video track has ended. Try selecting a different camera.");
			return;
		}

		try {
			const session = mediaRecorderService.startRecording(stream, {
				videoBitsPerSecond: getVideoBitrate(deviceService),
			});

			blockStartTimeRef.current = timerService.now();
			setError(null);

			// Wrap session.start() in try-catch to handle MediaRecorder failures
			try {
				session.start();
			} catch (startErr) {
				const errorMessage =
					startErr instanceof Error
						? startErr.message
						: "Failed to start recording";
				// Log diagnostic info to help debug MediaRecorder failures
				console.error("MediaRecorder.start() failed:", startErr);
				console.error("[MediaRecorder Debug]", {
					streamActive: stream.active,
					videoTracks: stream.getVideoTracks().map((t) => ({
						id: t.id,
						label: t.label,
						readyState: t.readyState,
						enabled: t.enabled,
						muted: t.muted,
					})),
					audioTracks: stream.getAudioTracks().length,
					mimeType: mediaRecorderService.getBestCodec(),
				});
				setError(errorMessage);
				setIsRecording(false);
				return;
			}

			recordingSessionRef.current = session;
			setIsRecording(true);
		} catch (err) {
			console.error("Failed to create recording session:", err);
			setError("Recording failed - check camera connection");
			setIsRecording(false);
		}
	}, [videoRef, mediaRecorderService, timerService, deviceService]);

	// Helper to clean up cloned stream
	const cleanupClonedStream = useCallback(() => {
		if (clonedStreamRef.current) {
			// Stop all tracks to release encoder resources
			clonedStreamRef.current.getTracks().forEach((track) => track.stop());
			clonedStreamRef.current = null;
		}
	}, []);

	const stopRecording = useCallback(
		async (options?: StopRecordingOptions): Promise<{ blob: Blob; duration: number } | null> => {
			const { forCleanup = false } = options ?? {};
			const session = recordingSessionRef.current;
			if (!session || session.getState() !== "recording") {
				cleanupClonedStream();
				return null;
			}

			try {
				const result = await session.stop();
				recordingSessionRef.current = null;
				cleanupClonedStream(); // Release cloned stream tracks
				// Skip state updates during cleanup to avoid setState on unmount
				if (!forCleanup) {
					setIsRecording(false);
				}
				return result;
			} catch (err) {
				console.error("Failed to stop recording:", err);
				recordingSessionRef.current = null;
				cleanupClonedStream(); // Cleanup on error too
				// Skip state updates during cleanup to avoid setState on unmount
				if (!forCleanup) {
					setError("Recording may have been lost - please try again");
					setIsRecording(false);
				}
				return null;
			}
		},
		[cleanupClonedStream],
	);

	const getState = useCallback(() => {
		return recordingSessionRef.current?.getState() ?? "inactive";
	}, []);

	return {
		isRecording,
		error,
		startRecording,
		stopRecording,
		getState,
	};
}
