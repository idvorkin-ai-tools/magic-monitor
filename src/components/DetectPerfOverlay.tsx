import { useEffect, useRef } from "react";

interface DetectPerfOverlayProps {
	detectTimeMsRef: React.RefObject<number>;
	videoRef: React.RefObject<HTMLVideoElement | null>;
	processingResRef: React.RefObject<{ width: number; height: number }>;
}

/**
 * Lightweight perf overlay showing hand detection timing and resolution info.
 * Uses refs and rAF to avoid React re-renders (same pattern as HandSkeleton).
 * Smooths the detect time with EMA to reduce jitter.
 */
export function DetectPerfOverlay({ detectTimeMsRef, videoRef, processingResRef }: DetectPerfOverlayProps) {
	const spanRef = useRef<HTMLSpanElement>(null);
	const smoothedMsRef = useRef(0);

	useEffect(() => {
		let rafId: number;
		const EMA_ALPHA = 0.1; // Low alpha = more smoothing

		const update = () => {
			if (spanRef.current) {
				const raw = detectTimeMsRef.current;
				// EMA: smoothed = alpha * raw + (1 - alpha) * previous
				smoothedMsRef.current =
					smoothedMsRef.current === 0
						? raw
						: EMA_ALPHA * raw + (1 - EMA_ALPHA) * smoothedMsRef.current;

				const video = videoRef.current;
				const camRes = video ? `${video.videoWidth}×${video.videoHeight}` : "—";

				const pr = processingResRef.current;
				spanRef.current.textContent =
					`Detect: ${smoothedMsRef.current.toFixed(1)}ms | Camera: ${camRes} | Process: ${pr.width}×${pr.height}`;
			}
			rafId = requestAnimationFrame(update);
		};

		update();
		return () => cancelAnimationFrame(rafId);
	}, [detectTimeMsRef, videoRef, processingResRef]);

	return (
		<div className="absolute top-2 left-2 z-50 pointer-events-none">
			<span
				ref={spanRef}
				className="bg-black/60 text-green-400 font-mono text-xs px-2 py-1 rounded"
			/>
		</div>
	);
}
