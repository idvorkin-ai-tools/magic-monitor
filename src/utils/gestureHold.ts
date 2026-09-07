/**
 * Turns a per-frame "is the gesture showing?" signal into a single, deliberate
 * fire: the pose must survive a hold window, and after it fires the detector
 * goes deaf for a cooldown.
 *
 * Pure and clock-injected — no rAF, no DOM — so the debounce can be tested
 * frame by frame.
 */

export interface GestureHoldOptions {
	/** How long the pose must persist before it counts. */
	holdMs: number;
	/** How long after a fire (or an explicit cooldown) the detector ignores the pose. */
	cooldownMs: number;
}

export class GestureHold {
	private holdStart: number | null = null;
	private cooldownUntil = 0;
	private readonly options: GestureHoldOptions;

	constructor(options: GestureHoldOptions) {
		this.options = options;
	}

	/**
	 * Feed one observation. Returns true on exactly the frame the hold
	 * completes, and never again until the pose drops and the cooldown expires.
	 */
	update(active: boolean, now: number): boolean {
		if (!active) {
			this.holdStart = null;
			return false;
		}

		if (now < this.cooldownUntil) {
			// Hold time accrued during a cooldown does not count, otherwise a hand
			// parked in the pose fires the instant the cooldown lapses.
			this.holdStart = null;
			return false;
		}

		this.holdStart ??= now;
		if (now - this.holdStart < this.options.holdMs) return false;

		this.holdStart = null;
		this.cooldownUntil = now + this.options.cooldownMs;
		return true;
	}

	/** Start the cooldown without a fire — e.g. when a round ends by other means. */
	startCooldown(now: number): void {
		this.holdStart = null;
		this.cooldownUntil = now + this.options.cooldownMs;
	}

	reset(): void {
		this.holdStart = null;
		this.cooldownUntil = 0;
	}
}
