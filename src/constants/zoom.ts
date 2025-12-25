/**
 * Zoom and pan constants for smart zoom and manual zoom features.
 * See docs/SMART_ZOOM_SPEC.md for algorithm details.
 */

/**
 * Zoom level constraints.
 */
export const ZOOM_CONSTANTS = {
	/** Minimum zoom level (1x = full frame) */
	MIN_ZOOM: 1,
	/** Maximum zoom level for smart zoom */
	MAX_ZOOM: 3,
	/** Maximum zoom level for manual zoom */
	MAX_MANUAL_ZOOM: 5,
	/** Minimum zoom change to trigger update (prevents jitter) */
	THRESHOLD: 0.1,
	/** Wheel scroll sensitivity (zoom delta per pixel of scroll) */
	WHEEL_SENSITIVITY: 0.001,
} as const;

/**
 * Pan position constraints.
 */
export const PAN_CONSTANTS = {
	/** Minimum pan change to trigger update (prevents jitter) */
	THRESHOLD: 0.025,
} as const;

/**
 * Calculate maximum pan distance for a given zoom level.
 * Pan coordinates are normalized (0-1 range).
 * maxPan = (1 - 1/zoom) / 2
 */
export function calculateMaxPan(zoom: number): number {
	return (1 - 1 / zoom) / 2;
}
