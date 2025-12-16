import { useCallback, useRef } from "react";
import { TimerService, type TimerServiceType } from "../services/TimerService";
import { SESSION_CONFIG } from "../types/sessions";

export interface BlockRotationConfig {
	blockDurationMs?: number;
	onBlockComplete: () => void;
	timerService?: TimerServiceType;
}

export interface BlockRotationControls {
	startRotation: () => void;
	stopRotation: () => void;
}

/**
 * Hook for managing automatic 5-minute block rotation.
 * Single Responsibility: Block rotation timing logic.
 */
export function useBlockRotation({
	blockDurationMs = SESSION_CONFIG.BLOCK_DURATION_MS,
	onBlockComplete,
	timerService = TimerService,
}: BlockRotationConfig): BlockRotationControls {
	const blockTimerRef = useRef<number | null>(null);

	const startRotation = useCallback(() => {
		// Clear any existing timer
		if (blockTimerRef.current) {
			timerService.clearTimeout(blockTimerRef.current);
		}

		// Set up new rotation timer
		blockTimerRef.current = timerService.setTimeout(() => {
			blockTimerRef.current = null;
			onBlockComplete();
		}, blockDurationMs);
	}, [blockDurationMs, onBlockComplete, timerService]);

	const stopRotation = useCallback(() => {
		if (blockTimerRef.current) {
			timerService.clearTimeout(blockTimerRef.current);
			blockTimerRef.current = null;
		}
	}, [timerService]);

	return {
		startRotation,
		stopRotation,
	};
}
