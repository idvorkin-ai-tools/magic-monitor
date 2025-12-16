/**
 * Humble Object for timer operations.
 * Isolates window.setInterval/setTimeout for testability.
 * See docs/ARCHITECTURE-practice-recorder.md for details.
 */

export const TimerService = {
	/**
	 * Set interval (wraps window.setInterval).
	 * Returns the interval ID for clearing.
	 */
	setInterval(callback: () => void, ms: number): number {
		return window.setInterval(callback, ms);
	},

	/**
	 * Clear interval.
	 */
	clearInterval(id: number): void {
		window.clearInterval(id);
	},

	/**
	 * Set timeout (wraps window.setTimeout).
	 * Returns the timeout ID for clearing.
	 */
	setTimeout(callback: () => void, ms: number): number {
		return window.setTimeout(callback, ms);
	},

	/**
	 * Clear timeout.
	 */
	clearTimeout(id: number): void {
		window.clearTimeout(id);
	},

	/**
	 * Get current timestamp in milliseconds.
	 */
	now(): number {
		return Date.now();
	},

	/**
	 * Get high-resolution timestamp (for performance measurements).
	 */
	performanceNow(): number {
		return performance.now();
	},
};

export type TimerServiceType = typeof TimerService;
