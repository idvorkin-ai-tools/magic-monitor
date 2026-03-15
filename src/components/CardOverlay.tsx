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
 * Compute the actual rendered image rectangle inside a video element
 * that uses object-contain. Accounts for letterboxing/pillarboxing.
 */
function getRenderedVideoRect(video: HTMLVideoElement): {
	left: number;
	top: number;
	width: number;
	height: number;
} {
	const videoW = video.videoWidth;
	const videoH = video.videoHeight;
	if (!videoW || !videoH) return { left: 0, top: 0, width: 0, height: 0 };

	// Use offsetWidth/Height (CSS layout size, before transforms)
	const elemW = video.offsetWidth;
	const elemH = video.offsetHeight;

	const videoAR = videoW / videoH;
	const elemAR = elemW / elemH;

	let imgW: number;
	let imgH: number;
	if (videoAR > elemAR) {
		// Video is wider than element → pillarbox (bars top/bottom)
		imgW = elemW;
		imgH = elemW / videoAR;
	} else {
		// Video is taller than element → letterbox (bars left/right)
		imgH = elemH;
		imgW = elemH * videoAR;
	}

	// Centered within the element's layout box
	const left = (elemW - imgW) / 2;
	const top = (elemH - imgH) / 2;

	return { left, top, width: imgW, height: imgH };
}

/**
 * Canvas-based card detection overlay.
 * Uses refs and rAF for 60fps rendering without React re-renders.
 *
 * Coordinate pipeline:
 * 1. Detection bbox is in video-normalized space (0-1), from parseYoloOutput
 * 2. We compute the rendered video rect (accounting for object-contain)
 * 3. We map normalized coords to canvas pixel coords
 * 4. Canvas bitmap matches its CSS layout size (offsetWidth/Height)
 *    so 1 canvas pixel = 1 CSS pixel, no scaling issues
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

			// Bug 2 fix: size canvas bitmap to its own CSS layout size
			const cw = canvas.offsetWidth;
			const ch = canvas.offsetHeight;
			if (canvas.width !== cw || canvas.height !== ch) {
				canvas.width = cw;
				canvas.height = ch;
			}

			// Bug 3 fix: compute actual rendered image rect (not element rect)
			const imgRect = getRenderedVideoRect(video);

			for (const det of detections) {
				const { bbox, label, confidence, card } = det;

				// Convert normalized center coords to corner coords
				const bboxLeft = bbox.x - bbox.width / 2;
				const bboxTop = bbox.y - bbox.height / 2;

				const normalizedLeft = isMirror ? 1 - (bboxLeft + bbox.width) : bboxLeft;

				// Map to canvas coords using the rendered image rect
				const screenX = imgRect.left + normalizedLeft * imgRect.width;
				const screenY = imgRect.top + bboxTop * imgRect.height;
				const screenW = bbox.width * imgRect.width;
				const screenH = bbox.height * imgRect.height;

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
