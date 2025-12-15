/**
 * Types for Practice Session recording and replay.
 * See docs/ARCHITECTURE-practice-recorder.md for full data model.
 */

export interface SessionThumbnail {
	time: number; // seconds into video
	dataUrl: string; // JPEG data URL
}

export interface PracticeSession {
	id: string; // uuid
	createdAt: number; // timestamp ms
	duration: number; // seconds

	// Storage
	blobKey: string; // IndexedDB key for video blob
	thumbnail: string; // JPEG data URL (first frame, for list view)
	thumbnails: SessionThumbnail[]; // every 15s, for timeline view

	// State
	saved: boolean; // false = auto-prune eligible
	name?: string; // user-provided name (saved only)

	// Trim (optional - for saved clips)
	trimIn?: number; // start time in seconds
	trimOut?: number; // end time in seconds
}

export type AppState = "live" | "picker" | "replay" | "error";

export interface AppStateContext {
	state: AppState;
	isRecording: boolean; // true only in 'live'
	currentSession: string | null; // session ID when in 'replay'
	error: {
		message: string;
		recoveryAction: () => void;
	} | null;
}

// Configuration constants
export const SESSION_CONFIG = {
	BLOCK_DURATION_MS: 5 * 60 * 1000, // 5 minutes
	MAX_RECENT_DURATION_SECONDS: 10 * 60, // 10 minutes of history
	VIDEO_BITRATE: 15_000_000, // 15 Mbps for 4K
	THUMBNAIL_QUALITY: 0.7, // JPEG quality
	THUMBNAIL_INTERVAL_MS: 3_000, // every 3 seconds (for fine-grained selection)
	STORAGE_WARNING_BYTES: 3 * 1024 * 1024 * 1024, // 3 GB

	// Thumbnail display settings
	THUMBNAIL_TARGET_MOBILE: 4,
	THUMBNAIL_TARGET_DESKTOP: 10,
	THUMBNAIL_MIN_INTERVAL_S: 1, // minimum 1 second between displayed thumbnails
	THUMBNAIL_MAX_INTERVAL_S: 15, // maximum 15 seconds between displayed thumbnails
} as const;
