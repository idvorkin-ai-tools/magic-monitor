import { useEffect, useRef } from "react";
import type { CardDetection } from "../types/cards";

interface CardOverlayProps {
	detectionsRef: React.RefObject<CardDetection[]>;
	videoRef: React.RefObject<HTMLVideoElement | null>;
	isMirror?: boolean;
	showConfidence?: boolean;
}

// Suit color mapping for bounding box styling
const SUIT_BOX_COLORS: Record<string, string> = {
	"\u2660": "#3b82f6", // blue for spades
	"\u2663": "#22c55e", // green for clubs
	"\u2665": "#ef4444", // red for hearts
	"\u2666": "#f97316", // orange for diamonds
};

/**
 * Canvas-based card detection overlay.
 * Uses refs and rAF for 60fps rendering without React re-renders.
 * Follows same pattern as HandSkeleton.
 */
export function CardOverlay({
	detectionsRef,
	videoRef,
	isMirror = false,
	showConfidence = false,
}: CardOverlayProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let rafId: number;

		const draw = () => {
			const video = videoRef.current;
			const detections = detectionsRef.current;

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			if (!video || !detections || detections.length === 0) {
				rafId = requestAnimationFrame(draw);
				return;
			}

			const videoRect = video.getBoundingClientRect();

			// Resize canvas to match window
			if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
			}

			for (const det of detections) {
				const { bbox, label, confidence, card } = det;

				// Convert normalized center coords to screen corner coords
				const bboxLeft = bbox.x - bbox.width / 2;
				const bboxTop = bbox.y - bbox.height / 2;

				const normalizedLeft = isMirror ? 1 - (bboxLeft + bbox.width) : bboxLeft;
				const screenX = videoRect.left + normalizedLeft * videoRect.width;
				const screenY = videoRect.top + bboxTop * videoRect.height;
				const screenW = bbox.width * videoRect.width;
				const screenH = bbox.height * videoRect.height;

				const color = SUIT_BOX_COLORS[card.suit] ?? "#ffffff";

				// Draw bounding box
				ctx.strokeStyle = color;
				ctx.lineWidth = 2;
				ctx.globalAlpha = 0.8;
				ctx.strokeRect(screenX, screenY, screenW, screenH);

				// Draw label background
				const labelText = showConfidence
					? `${label} ${Math.round(confidence * 100)}%`
					: label;
				ctx.font = "bold 14px monospace";
				const metrics = ctx.measureText(labelText);
				const labelH = 20;
				const labelW = metrics.width + 8;

				ctx.globalAlpha = 0.85;
				ctx.fillStyle = color;
				ctx.fillRect(screenX, screenY - labelH, labelW, labelH);

				// Draw label text
				ctx.globalAlpha = 1;
				ctx.fillStyle = "#ffffff";
				ctx.textBaseline = "middle";
				ctx.fillText(labelText, screenX + 4, screenY - labelH / 2);
			}

			ctx.globalAlpha = 1;
			rafId = requestAnimationFrame(draw);
		};

		draw();

		return () => cancelAnimationFrame(rafId);
	}, [detectionsRef, videoRef, isMirror, showConfidence]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none z-30"
			style={{ width: "100%", height: "100%" }}
		/>
	);
}
