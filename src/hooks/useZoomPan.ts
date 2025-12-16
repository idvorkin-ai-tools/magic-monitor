import { useCallback, useState } from "react";

export interface ZoomPanState {
	zoom: number;
	pan: { x: number; y: number };
}

export interface ZoomPanHandlers {
	handleWheel: (e: React.WheelEvent) => void;
	handleMouseDown: (e: React.MouseEvent) => void;
	handleMouseMove: (e: React.MouseEvent) => void;
	handleMouseUp: () => void;
	resetZoom: () => void;
	setZoom: (zoom: number) => void;
	setPan: (pan: { x: number; y: number }) => void;
}

export interface UseZoomPanOptions {
	videoRef: React.RefObject<HTMLVideoElement>;
	minZoom?: number;
	maxZoom?: number;
	onZoomChange?: () => void;
}

export interface UseZoomPanResult extends ZoomPanState, ZoomPanHandlers {
	isDragging: boolean;
}

/**
 * Hook for managing zoom/pan state and mouse interactions.
 * Handles:
 * - Zoom level (1-10x configurable range)
 * - Pan position { x, y } in normalized coordinates
 * - Mouse wheel zoom
 * - Mouse drag to pan
 *
 * Pan coordinates are normalized (0-1 range) and independent of resolution.
 * Max pan is constrained by zoom level: maxPan = (1 - 1/zoom) / 2
 * See docs/SMART_ZOOM_SPEC.md for details.
 */
export function useZoomPan({
	videoRef,
	minZoom = 1,
	maxZoom = 5,
	onZoomChange,
}: UseZoomPanOptions): UseZoomPanResult {
	const [zoom, setZoomInternal] = useState(1);
	const [pan, setPanInternal] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

	// Helper to clamp NORMALIZED pan values (resolution-independent)
	// See docs/SMART_ZOOM_SPEC.md: maxPan = (1 - 1/zoom) / 2
	const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
		const maxPan = (1 - 1 / z) / 2;
		return {
			x: Math.max(-maxPan, Math.min(maxPan, p.x)),
			y: Math.max(-maxPan, Math.min(maxPan, p.y)),
		};
	}, []);

	const setZoom = useCallback(
		(newZoom: number) => {
			const clampedZoom = Math.min(Math.max(newZoom, minZoom), maxZoom);
			setZoomInternal(clampedZoom);
			// Re-clamp pan with new zoom level
			setPanInternal((prev) => clampPan(prev, clampedZoom));
		},
		[minZoom, maxZoom, clampPan],
	);

	const setPan = useCallback(
		(newPan: { x: number; y: number }) => {
			setZoomInternal((currentZoom) => {
				setPanInternal(clampPan(newPan, currentZoom));
				return currentZoom;
			});
		},
		[clampPan],
	);

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();
			// Notify that manual zoom is happening (so caller can disable smart zoom)
			onZoomChange?.();
			const newZoom = zoom - e.deltaY * 0.001;
			setZoom(newZoom);
		},
		[zoom, setZoom, onZoomChange],
	);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (zoom > 1) {
				setIsDragging(true);
				setLastMousePos({ x: e.clientX, y: e.clientY });
			}
		},
		[zoom],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!isDragging || zoom <= 1) return;

			const dx = e.clientX - lastMousePos.x;
			const dy = e.clientY - lastMousePos.y;

			// Convert pixel delta to normalized coordinates
			// Use video element's rendered size for accurate conversion
			const videoRect = videoRef.current?.getBoundingClientRect();
			const renderedWidth = videoRect?.width || 1;
			const renderedHeight = videoRect?.height || 1;

			// Normalized delta: pixel movement / (rendered size * zoom)
			// The zoom factor accounts for scale(zoom) in CSS transform
			const normalizedDx = dx / (renderedWidth * zoom);
			const normalizedDy = dy / (renderedHeight * zoom);

			setPanInternal((currentPan) => {
				const proposedPan = {
					x: currentPan.x + normalizedDx,
					y: currentPan.y + normalizedDy,
				};
				return clampPan(proposedPan, zoom);
			});
			setLastMousePos({ x: e.clientX, y: e.clientY });
		},
		[isDragging, zoom, lastMousePos, videoRef, clampPan],
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	const resetZoom = useCallback(() => {
		// Notify that manual reset is happening (so caller can disable smart zoom)
		onZoomChange?.();
		setZoomInternal(1);
		setPanInternal({ x: 0, y: 0 });
	}, [onZoomChange]);

	return {
		zoom,
		pan,
		isDragging,
		handleWheel,
		handleMouseDown,
		handleMouseMove,
		handleMouseUp,
		resetZoom,
		setZoom,
		setPan,
	};
}
