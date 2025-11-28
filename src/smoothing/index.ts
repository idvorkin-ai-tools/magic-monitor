/**
 * Smoothing module for SmartZoom.
 * Provides factory function to create smoothers by preset name.
 */

export { EmaSmoother, emaStep } from "./ema";
export {
	KALMAN_FAST,
	KALMAN_SMOOTH,
	KalmanSmoother,
	kalmanPredict,
} from "./kalman";
export type {
	Measurement,
	SmoothedPosition,
	Smoother,
	SmoothingPreset,
	SmoothingState,
	SpeedClampConfig,
} from "./types";
export { DEFAULT_SPEED_CLAMP } from "./types";

import { EmaSmoother } from "./ema";
import { KALMAN_FAST, KALMAN_SMOOTH, KalmanSmoother } from "./kalman";
import type { SmoothedPosition, Smoother, SmoothingPreset } from "./types";

/**
 * Create a smoother instance for the given preset.
 */
export function createSmoother(preset: SmoothingPreset): Smoother {
	switch (preset) {
		case "ema":
			return new EmaSmoother({ smoothFactor: 0.05 });
		case "kalmanFast":
			return new KalmanSmoother(KALMAN_FAST);
		case "kalmanSmooth":
			return new KalmanSmoother(KALMAN_SMOOTH);
		default: {
			// Exhaustive check
			const _exhaustive: never = preset;
			throw new Error(`Unknown smoothing preset: ${_exhaustive}`);
		}
	}
}

/**
 * Apply speed clamping to limit maximum movement per frame.
 * This prevents jarring camera movements.
 */
export function clampSpeed(
	current: SmoothedPosition,
	target: SmoothedPosition,
	maxPanSpeed: number,
	maxZoomSpeed: number,
): SmoothedPosition {
	const dx = target.x - current.x;
	const dy = target.y - current.y;
	const dZoom = target.zoom - current.zoom;

	// Clamp pan speed (using Euclidean distance)
	const panSpeed = Math.sqrt(dx * dx + dy * dy);
	let clampedX = target.x;
	let clampedY = target.y;

	if (panSpeed > maxPanSpeed) {
		const scale = maxPanSpeed / panSpeed;
		clampedX = current.x + dx * scale;
		clampedY = current.y + dy * scale;
	}

	// Clamp zoom speed
	let clampedZoom = target.zoom;
	if (Math.abs(dZoom) > maxZoomSpeed) {
		clampedZoom = current.zoom + Math.sign(dZoom) * maxZoomSpeed;
	}

	return { x: clampedX, y: clampedY, zoom: clampedZoom };
}

/** Human-readable labels for presets (for UI) */
export const SMOOTHING_PRESET_LABELS: Record<SmoothingPreset, string> = {
	ema: "Standard (EMA)",
	kalmanFast: "Kalman Fast",
	kalmanSmooth: "Kalman Smooth",
};

/** Descriptions for presets (for UI tooltips) */
export const SMOOTHING_PRESET_DESCRIPTIONS: Record<SmoothingPreset, string> = {
	ema: "Simple exponential smoothing - good balance of speed and stability",
	kalmanFast: "Kalman filter tuned for responsiveness - tracks fast movements",
	kalmanSmooth:
		"Kalman filter tuned for stability - very smooth, slower response",
};
