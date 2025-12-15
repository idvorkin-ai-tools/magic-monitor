import type { SessionThumbnail } from "../types/sessions";
import { SESSION_CONFIG } from "../types/sessions";

/**
 * Select thumbnails for display based on clip duration and device type.
 *
 * Rules:
 * - Target count: 4 on mobile, 10 on desktop
 * - Minimum 1 second between displayed thumbnails
 * - Maximum 15 seconds between displayed thumbnails
 *
 * @param thumbnails - All available thumbnails (sorted by time)
 * @param duration - Clip duration in seconds
 * @param isMobile - Whether displaying on mobile device
 * @returns Subset of thumbnails to display
 */
export function selectThumbnailsForDisplay(
	thumbnails: SessionThumbnail[],
	duration: number,
	isMobile: boolean,
): SessionThumbnail[] {
	if (thumbnails.length === 0 || duration <= 0) {
		return [];
	}

	// Single thumbnail for very short clips
	if (thumbnails.length === 1) {
		return thumbnails;
	}

	const targetCount = isMobile
		? SESSION_CONFIG.THUMBNAIL_TARGET_MOBILE
		: SESSION_CONFIG.THUMBNAIL_TARGET_DESKTOP;

	const minInterval = SESSION_CONFIG.THUMBNAIL_MIN_INTERVAL_S;
	const maxInterval = SESSION_CONFIG.THUMBNAIL_MAX_INTERVAL_S;

	// Calculate ideal interval to hit target count
	let idealInterval = duration / targetCount;

	// Clamp to min/max bounds
	idealInterval = Math.max(minInterval, Math.min(maxInterval, idealInterval));

	// Calculate actual count based on clamped interval
	const actualCount = Math.max(1, Math.ceil(duration / idealInterval));

	// If we have fewer thumbnails than needed, return all
	if (thumbnails.length <= actualCount) {
		return thumbnails;
	}

	// Handle single-result case
	if (actualCount <= 1) {
		return thumbnails.length > 0 ? [thumbnails[0]] : [];
	}

	// Select evenly spaced thumbnails
	const selected: SessionThumbnail[] = [];
	const step = (thumbnails.length - 1) / (actualCount - 1);

	for (let i = 0; i < actualCount; i++) {
		const index = Math.round(i * step);
		const thumb = thumbnails[Math.min(index, thumbnails.length - 1)];
		// Avoid duplicates
		if (selected.length === 0 || selected[selected.length - 1] !== thumb) {
			selected.push(thumb);
		}
	}

	return selected;
}
