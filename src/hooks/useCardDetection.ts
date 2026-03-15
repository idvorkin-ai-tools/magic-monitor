import { useEffect, useRef, useState } from "react";
import {
	CardDetectorService,
	type LoadingState,
} from "../services/CardDetectorService";
import type { CardDetection } from "../types/cards";

interface CardDetectionConfig {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	enabled: boolean;
	confidenceThreshold?: number; // 0-1, default 0.5
}

export function useCardDetection({
	videoRef,
	enabled,
	confidenceThreshold = 0.5,
}: CardDetectionConfig) {
	const [isModelLoading, setIsModelLoading] = useState(false);
	const [loadingProgress, setLoadingProgress] = useState(0);
	const [loadingPhase, setLoadingPhase] = useState<"downloading" | "initializing">("downloading");
	const [modelError, setModelError] = useState<string | null>(null);

	// Detections stored in ref for 60fps reads (overlay), throttled to state for UI
	const detectionsRef = useRef<CardDetection[]>([]);
	const [detections, setDetections] = useState<CardDetection[]>([]);

	// Perf timing
	const detectTimeMsRef = useRef(0);

	const requestRef = useRef<number>(0);
	const lastVideoTimeRef = useRef<number>(-1);
	const frameCountRef = useRef(0);

	// Throttle React state updates to ~10Hz (every 3 frames at 30fps)
	const UI_UPDATE_INTERVAL = 3;

	// Subscribe to service loading state
	useEffect(() => {
		const handleStateChange = (state: LoadingState) => {
			setIsModelLoading(state.phase === "downloading" || state.phase === "initializing");
			setLoadingProgress(state.progress);
			setLoadingPhase(state.phase === "initializing" ? "initializing" : "downloading");
			setModelError(state.phase === "error" ? (state.error?.message ?? "Unknown error") : null);
		};

		const unsubscribe = CardDetectorService.subscribe(handleStateChange);

		if (enabled) {
			CardDetectorService.load();
		}

		return unsubscribe;
	}, [enabled]);

	// Detection loop
	// biome-ignore lint/correctness/useExhaustiveDependencies: isModelLoading triggers re-run when model loads
	useEffect(() => {
		if (!enabled || !CardDetectorService.isReady() || !videoRef.current) return;

		let running = true;

		const detect = async () => {
			if (!running) return;

			const video = videoRef.current;
			if (!video || video.paused || video.ended) {
				requestRef.current = requestAnimationFrame(() => {
					detect();
				});
				return;
			}

			// Only process if video time changed
			if (video.currentTime !== lastVideoTimeRef.current) {
				lastVideoTimeRef.current = video.currentTime;
				frameCountRef.current++;

				// Skip every other frame to reduce GPU contention with hand tracking
				if (frameCountRef.current % 2 === 0) {
					const t0 = performance.now();
					const results = await CardDetectorService.detect(video, confidenceThreshold);
					detectTimeMsRef.current = performance.now() - t0;

					detectionsRef.current = results;

					// Throttle React state updates
					if (frameCountRef.current % UI_UPDATE_INTERVAL === 0) {
						setDetections(results);
					}
				}
			}

			requestRef.current = requestAnimationFrame(() => {
				detect();
			});
		};

		detect();

		return () => {
			running = false;
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, [enabled, videoRef, confidenceThreshold, isModelLoading]);

	// Clear detections when disabled
	useEffect(() => {
		if (!enabled) {
			detectionsRef.current = [];
			setDetections([]);
		}
	}, [enabled]);

	return {
		isModelLoading,
		loadingProgress,
		loadingPhase,
		modelError,
		detections,
		detectionsRef,
		detectTimeMsRef,
	};
}
