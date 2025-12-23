/**
 * Format duration in seconds to "M:SS" format.
 * Negative values are treated as 0.
 */
export function formatDuration(seconds: number): string {
	const safeSeconds = Math.max(0, seconds);
	const mins = Math.floor(safeSeconds / 60);
	const secs = Math.floor(safeSeconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}
