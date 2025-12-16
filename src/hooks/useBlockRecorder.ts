import { useCallback, useRef, useState } from "react";
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
}

export interface BlockRecorderControls {
	isRecording: boolean;
	error: string | null;
	startRecording: () => void;
	stopRecording: () => Promise<{ blob: Blob; duration: number } | null>;
	getState: () => RecordingState;
}

/**
 * Hook for managing MediaRecorder lifecycle (start/stop recording).
 * Single Responsibility: MediaRecorder session management.
 */
export function useBlockRecorder({
	videoRef,
	mediaRecorderService = MediaRecorderService,
	timerService = TimerService,
}: BlockRecorderConfig): BlockRecorderControls {
	const [isRecording, setIsRecording] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const recordingSessionRef = useRef<RecordingSession | null>(null);
	const blockStartTimeRef = useRef<number>(0);

	const startRecording = useCallback(() => {
		const video = videoRef.current;
		if (!video || !video.srcObject) {
			setError("Camera not available");
			return;
		}

		const stream = video.srcObject as MediaStream;

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
				videoBitsPerSecond: SESSION_CONFIG.VIDEO_BITRATE,
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
	}, [videoRef, mediaRecorderService, timerService]);

	const stopRecording =
		useCallback(async (): Promise<{ blob: Blob; duration: number } | null> => {
			const session = recordingSessionRef.current;
			if (!session || session.getState() !== "recording") {
				return null;
			}

			try {
				const result = await session.stop();
				recordingSessionRef.current = null;
				setIsRecording(false);
				return result;
			} catch (err) {
				console.error("Failed to stop recording:", err);
				setError("Recording may have been lost - please try again");
				recordingSessionRef.current = null;
				setIsRecording(false);
				return null;
			}
		}, []);

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
