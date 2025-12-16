import type { PracticeSession, SessionThumbnail } from "../types/sessions";

// ===== State Types =====

export type SessionRecorderState =
	| { type: "idle" }
	| { type: "initializing" } // waiting for storage init
	| { type: "waitingForVideo" } // storage ready, waiting for video
	| { type: "recording"; blockStart: number }
	| { type: "stopping" };

// ===== Callback Types =====

export interface SessionRecorderCallbacks {
	// Recording lifecycle
	onStartRecording: () => void;
	onStopRecording: () => Promise<{ blob: Blob; duration: number } | null>;

	// Thumbnail lifecycle
	onStartThumbnails: (blockStartTime: number) => void;
	onStopThumbnails: () => SessionThumbnail[];

	// Block timer lifecycle
	onStartBlockTimer: () => void;
	onStopBlockTimer: () => void;

	// Persistence - returns saved session or null
	onSaveBlock: (
		blob: Blob,
		duration: number,
		thumbnails: SessionThumbnail[],
		blockStartTime: number,
	) => Promise<PracticeSession | null>;

	// State observation
	onStateChange: (state: SessionRecorderState) => void;

	// Time provider (for testing)
	now: () => number;
}

// ===== State Machine =====

/**
 * Pure state machine for session recording coordination.
 * No React, no timers, no async - just state transitions.
 * All side effects happen through injected callbacks.
 */
export class SessionRecorderMachine {
	private state: SessionRecorderState = { type: "idle" };
	private enabled = false;
	private videoReady = false;
	private storageReady = false;
	private callbacks: SessionRecorderCallbacks;

	constructor(callbacks: SessionRecorderCallbacks) {
		this.callbacks = callbacks;
	}

	// ===== State Accessors =====

	getState(): SessionRecorderState {
		return this.state;
	}

	isRecording(): boolean {
		return this.state.type === "recording";
	}

	// ===== Input Methods =====

	/**
	 * Called when recording is enabled by the user.
	 */
	enable(): void {
		if (this.enabled) return;
		this.enabled = true;
		this.tryTransition();
	}

	/**
	 * Called when recording is disabled by the user.
	 * Returns a promise that resolves when any in-progress recording is stopped.
	 */
	async disable(): Promise<void> {
		if (!this.enabled) return;
		this.enabled = false;

		// If recording, trigger stop and wait for it
		if (this.state.type === "recording") {
			await this.stopCurrentBlock();
		} else {
			this.setState({ type: "idle" });
		}
	}

	/**
	 * Called when storage initialization completes.
	 */
	storageInitialized(): void {
		if (this.storageReady) return;
		this.storageReady = true;
		this.tryTransition();
	}

	/**
	 * Called when storage initialization fails.
	 */
	storageInitFailed(): void {
		this.storageReady = false;
		this.setState({ type: "idle" });
	}

	/**
	 * Called when video element becomes ready (readyState >= 3).
	 */
	videoIsReady(): void {
		if (this.videoReady) return;
		this.videoReady = true;
		this.tryTransition();
	}

	/**
	 * Called when video element is no longer available.
	 * Returns a promise that resolves when any in-progress recording is stopped.
	 */
	async videoNotReady(): Promise<void> {
		if (!this.videoReady) return;
		this.videoReady = false;

		// If recording, we need to stop
		if (this.state.type === "recording") {
			await this.stopCurrentBlock();
		}
	}

	/**
	 * Called when the block rotation timer fires.
	 * Completes current block and starts a new one if still enabled.
	 */
	async blockTimerFired(): Promise<void> {
		if (this.state.type !== "recording") return;

		await this.stopCurrentBlock();

		// Start new block if still enabled and ready
		if (this.enabled && this.videoReady && this.storageReady) {
			this.startRecordingBlock();
		}
	}

	/**
	 * Manually stop the current recording block.
	 * Returns the saved session or null if not recording or save failed.
	 */
	async stopCurrentBlock(): Promise<PracticeSession | null> {
		if (this.state.type !== "recording") return null;

		const blockStart = this.state.blockStart;
		this.setState({ type: "stopping" });

		// Stop all components
		this.callbacks.onStopBlockTimer();
		const thumbnails = this.callbacks.onStopThumbnails();
		const result = await this.callbacks.onStopRecording();

		// Save if we got a recording
		let savedSession: PracticeSession | null = null;
		if (result && result.blob.size > 0) {
			savedSession = await this.callbacks.onSaveBlock(
				result.blob,
				result.duration,
				thumbnails,
				blockStart,
			);
		}

		// Transition to appropriate next state
		if (this.enabled && this.videoReady && this.storageReady) {
			this.setState({ type: "waitingForVideo" });
		} else {
			this.setState({ type: "idle" });
		}

		return savedSession;
	}

	// ===== Private Methods =====

	private setState(newState: SessionRecorderState): void {
		this.state = newState;
		this.callbacks.onStateChange(newState);
	}

	/**
	 * Attempt to transition based on current conditions.
	 */
	private tryTransition(): void {
		// Not enabled? Stay idle
		if (!this.enabled) {
			if (this.state.type !== "idle") {
				this.setState({ type: "idle" });
			}
			return;
		}

		// Enabled but storage not ready? Initialize
		if (!this.storageReady) {
			if (this.state.type !== "initializing") {
				this.setState({ type: "initializing" });
			}
			return;
		}

		// Storage ready but video not ready? Wait
		if (!this.videoReady) {
			if (this.state.type !== "waitingForVideo") {
				this.setState({ type: "waitingForVideo" });
			}
			return;
		}

		// Everything ready and not already recording/stopping? Start!
		if (
			this.state.type !== "recording" &&
			this.state.type !== "stopping"
		) {
			this.startRecordingBlock();
		}
	}

	private startRecordingBlock(): void {
		const blockStart = this.callbacks.now();
		this.setState({ type: "recording", blockStart });

		// Start all components
		this.callbacks.onStartRecording();
		this.callbacks.onStartThumbnails(blockStart);
		this.callbacks.onStartBlockTimer();
	}
}
