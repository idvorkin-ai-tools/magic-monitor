import { useEffect, useRef, useState, useCallback } from "react";
import { DiskBufferService, type VideoChunk } from "../services/DiskBufferService";

export interface ChunkPreview {
	id: number;
	timestamp: number;
	imageUrl: string; // Object URL for display
}

export interface DiskTimeMachineControls {
	isReplaying: boolean;
	isPlaying: boolean;
	isRecording: boolean;
	currentTime: number;
	totalDuration: number;
	chunkCount: number;
	previews: ChunkPreview[];
	videoSrc: string | null; // Current chunk video URL
	enterReplay: () => void;
	exitReplay: () => void;
	play: () => void;
	pause: () => void;
	seek: (time: number) => void;
	seekToChunk: (chunkId: number) => void;
	saveVideo: () => Promise<void>;
	clearBuffer: () => Promise<void>;
}

interface DiskTimeMachineConfig {
	streamRef: React.RefObject<MediaStream | null>;
	enabled: boolean;
	chunkDurationMs?: number; // Duration per chunk (default 5000ms)
	maxChunks?: number; // Max chunks to keep (default 6 = 30s at 5s chunks)
}

/**
 * Captures first frame from a video blob as a JPEG preview
 */
async function captureFirstFrame(videoBlob: Blob): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const video = document.createElement("video");
		const url = URL.createObjectURL(videoBlob);

		video.onloadeddata = () => {
			video.currentTime = 0;
		};

		video.onseeked = () => {
			const canvas = document.createElement("canvas");
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				URL.revokeObjectURL(url);
				reject(new Error("Could not get canvas context"));
				return;
			}
			ctx.drawImage(video, 0, 0);
			canvas.toBlob(
				(blob) => {
					URL.revokeObjectURL(url);
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error("Could not create preview blob"));
					}
				},
				"image/jpeg",
				0.7,
			);
		};

		video.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Video load error"));
		};

		video.src = url;
		video.load();
	});
}

export function useDiskTimeMachine({
	streamRef,
	enabled,
	chunkDurationMs = 5000,
	maxChunks = 6,
}: DiskTimeMachineConfig): DiskTimeMachineControls {
	const [isReplaying, setIsReplaying] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [chunkCount, setChunkCount] = useState(0);
	const [previews, setPreviews] = useState<ChunkPreview[]>([]);
	const [videoSrc, setVideoSrc] = useState<string | null>(null);
	const [currentTime, setCurrentTime] = useState(0);
	const [totalDuration, setTotalDuration] = useState(0);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<VideoChunk[]>([]);
	const currentChunkIndexRef = useRef(0);
	const playbackVideoRef = useRef<HTMLVideoElement | null>(null);
	const previewUrlsRef = useRef<string[]>([]);

	// Initialize IndexedDB
	useEffect(() => {
		DiskBufferService.init().catch(console.error);
	}, []);

	// Cleanup preview URLs on unmount
	useEffect(() => {
		return () => {
			for (const url of previewUrlsRef.current) {
				URL.revokeObjectURL(url);
			}
			if (videoSrc) {
				URL.revokeObjectURL(videoSrc);
			}
		};
	}, [videoSrc]);

	// Start/stop recording based on enabled and stream
	useEffect(() => {
		if (!enabled || isReplaying || !streamRef.current) {
			if (mediaRecorderRef.current?.state === "recording") {
				mediaRecorderRef.current.stop();
				setIsRecording(false);
			}
			return;
		}

		const stream = streamRef.current;

		// Determine best supported format
		const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
			? "video/webm;codecs=vp9"
			: MediaRecorder.isTypeSupported("video/webm")
				? "video/webm"
				: "video/mp4";

		try {
			const recorder = new MediaRecorder(stream, { mimeType });
			mediaRecorderRef.current = recorder;

			recorder.ondataavailable = async (event) => {
				if (event.data.size > 0) {
					try {
						// Capture preview from first frame
						const preview = await captureFirstFrame(event.data);
						const timestamp = Date.now();

						// Save to IndexedDB
						await DiskBufferService.saveChunk(
							event.data,
							preview,
							timestamp,
							chunkDurationMs,
						);

						// Prune old chunks
						await DiskBufferService.pruneOldChunks(maxChunks);

						// Update chunk count
						const count = await DiskBufferService.getChunkCount();
						setChunkCount(count);
						setTotalDuration(count * chunkDurationMs);
					} catch (err) {
						console.error("Error saving chunk:", err);
					}
				}
			};

			recorder.onerror = (event) => {
				console.error("MediaRecorder error:", event);
				setIsRecording(false);
			};

			recorder.start(chunkDurationMs);
			setIsRecording(true);

			return () => {
				if (recorder.state === "recording") {
					recorder.stop();
				}
				setIsRecording(false);
			};
		} catch (err) {
			console.error("Failed to create MediaRecorder:", err);
			return;
		}
	}, [enabled, isReplaying, streamRef, chunkDurationMs, maxChunks]);

	// Load previews when entering replay
	const loadPreviews = useCallback(async () => {
		// Revoke old URLs
		for (const url of previewUrlsRef.current) {
			URL.revokeObjectURL(url);
		}
		previewUrlsRef.current = [];

		const previewData = await DiskBufferService.getPreviewFrames();
		const newPreviews: ChunkPreview[] = previewData.map((p) => {
			const url = URL.createObjectURL(p.preview);
			previewUrlsRef.current.push(url);
			return {
				id: p.id,
				timestamp: p.timestamp,
				imageUrl: url,
			};
		});

		// Sort by timestamp
		newPreviews.sort((a, b) => a.timestamp - b.timestamp);
		setPreviews(newPreviews);
	}, []);

	// Load chunks for playback
	const loadChunksForPlayback = useCallback(async () => {
		chunksRef.current = await DiskBufferService.getAllChunks();
		chunksRef.current.sort((a, b) => a.timestamp - b.timestamp);
	}, []);

	const playChunk = useCallback((index: number) => {
		if (index < 0 || index >= chunksRef.current.length) return;

		currentChunkIndexRef.current = index;
		const chunk = chunksRef.current[index];

		// Revoke previous URL
		if (videoSrc) {
			URL.revokeObjectURL(videoSrc);
		}

		const url = URL.createObjectURL(chunk.blob);
		setVideoSrc(url);
		setCurrentTime(index * chunkDurationMs);
	}, [videoSrc, chunkDurationMs]);

	const enterReplay = useCallback(async () => {
		// Stop recording
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.stop();
		}

		await loadPreviews();
		await loadChunksForPlayback();

		if (chunksRef.current.length === 0) {
			console.warn("No chunks available for replay");
			return;
		}

		setIsReplaying(true);
		setIsPlaying(true);
		playChunk(0);
	}, [loadPreviews, loadChunksForPlayback, playChunk]);

	const exitReplay = useCallback(() => {
		setIsReplaying(false);
		setIsPlaying(false);
		setCurrentTime(0);

		if (videoSrc) {
			URL.revokeObjectURL(videoSrc);
			setVideoSrc(null);
		}
	}, [videoSrc]);

	const play = useCallback(() => setIsPlaying(true), []);
	const pause = useCallback(() => setIsPlaying(false), []);

	const seek = useCallback((time: number) => {
		const chunkIndex = Math.floor(time / chunkDurationMs);
		if (chunkIndex >= 0 && chunkIndex < chunksRef.current.length) {
			playChunk(chunkIndex);
		}
	}, [chunkDurationMs, playChunk]);

	const seekToChunk = useCallback((chunkId: number) => {
		const index = chunksRef.current.findIndex((c) => c.id === chunkId);
		if (index >= 0) {
			playChunk(index);
		}
	}, [playChunk]);

	const saveVideo = useCallback(async () => {
		const blob = await DiskBufferService.exportVideo();
		if (!blob) {
			console.warn("No video to save");
			return;
		}

		// Create download link
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `rewind-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, []);

	const clearBuffer = useCallback(async () => {
		await DiskBufferService.clearAll();
		setChunkCount(0);
		setPreviews([]);
		setTotalDuration(0);
	}, []);

	// Handle video ended - advance to next chunk
	useEffect(() => {
		if (!isReplaying || !isPlaying) return;

		const handleChunkEnded = () => {
			const nextIndex = currentChunkIndexRef.current + 1;
			if (nextIndex < chunksRef.current.length) {
				playChunk(nextIndex);
			} else {
				// Loop back to start
				playChunk(0);
			}
		};

		// We need to expose a way to notify when video ends
		// This will be handled by the component using this hook
		// by calling seek or listening to the video element

		return () => {};
	}, [isReplaying, isPlaying, playChunk]);

	return {
		isReplaying,
		isPlaying,
		isRecording,
		currentTime,
		totalDuration,
		chunkCount,
		previews,
		videoSrc,
		enterReplay,
		exitReplay,
		play,
		pause,
		seek,
		seekToChunk,
		saveVideo,
		clearBuffer,
	};
}
