/**
 * State machine for a "think of a card" round.
 *
 * The app plays the spectator so Igor can rehearse the Particle thought-of-card
 * riff alone. A trigger (P key, on-screen button, or a V sign at the camera)
 * starts a countdown — that is the "think of one… now" beat, and the seconds
 * are his patter time — and when it runs out the app names a card, which is
 * the spectator saying it out loud. He then has to find it.
 *
 * idle → countdown (5s) → reveal (held until dismissed or 8s) → idle
 *
 * No React, no DOM. Timers go through an injected humble object so the whole
 * lifecycle is testable with a fake clock.
 */

import { TimerService, type TimerServiceType } from "../services/TimerService";
import { cardToLabel, type PlayingCard } from "../types/cards";

export type ThinkOfACardState =
	| { type: "idle" }
	| { type: "countdown"; secondsLeft: number }
	| { type: "reveal"; card: PlayingCard; label: string };

/** How the round was started. Recorded on the round so replays can tell them apart. */
export type ThinkOfACardTrigger = "key" | "button" | "gesture";

export interface ThinkOfACardRound {
	card: PlayingCard;
	label: string;
	trigger: ThinkOfACardTrigger;
	/** ms timestamp when the trigger fired. */
	startedAt: number;
	/** ms timestamp when the card went up on screen. */
	revealedAt: number;
}

export const THINK_OF_A_CARD_CONFIG = {
	/** Patter time between "think of one… now" and the spectator naming it. */
	COUNTDOWN_SECONDS: 5,
	TICK_MS: 1000,
	/** The card comes down on its own after this, so a forgotten round self-clears. */
	REVEAL_HOLD_MS: 8000,
} as const;

export interface ThinkOfACardCallbacks {
	/** Supplies the card the "spectator" thought of. */
	pickCard: () => PlayingCard;
	onStateChange: (state: ThinkOfACardState) => void;
	/** Fired once per round, when the card appears. */
	onRoundRevealed?: (round: ThinkOfACardRound) => void;
	/** Injected for tests. Defaults to the real timer service. */
	timer?: TimerServiceType;
	/** Injected for tests. Defaults to the timer service's clock. */
	now?: () => number;
}

export class ThinkOfACardMachine {
	private state: ThinkOfACardState = { type: "idle" };
	private countdownIntervalId: number | null = null;
	private revealTimeoutId: number | null = null;
	private startedAt = 0;
	private trigger: ThinkOfACardTrigger = "key";

	private readonly callbacks: ThinkOfACardCallbacks;
	private readonly timer: TimerServiceType;
	private readonly now: () => number;

	constructor(callbacks: ThinkOfACardCallbacks) {
		this.callbacks = callbacks;
		this.timer = callbacks.timer ?? TimerService;
		this.now = callbacks.now ?? (() => this.timer.now());
	}

	getState(): ThinkOfACardState {
		return this.state;
	}

	/** True while a round is running. Used to swallow repeat triggers. */
	isBusy(): boolean {
		return this.state.type !== "idle";
	}

	/**
	 * Start a round. Ignored (returns false) while one is already running, so
	 * a held gesture or a leaned-on key is still exactly one round.
	 */
	start(trigger: ThinkOfACardTrigger): boolean {
		if (this.isBusy()) return false;

		this.trigger = trigger;
		this.startedAt = this.now();
		this.setState({
			type: "countdown",
			secondsLeft: THINK_OF_A_CARD_CONFIG.COUNTDOWN_SECONDS,
		});

		this.countdownIntervalId = this.timer.setInterval(() => {
			this.tick();
		}, THINK_OF_A_CARD_CONFIG.TICK_MS);

		return true;
	}

	/** Cancel a countdown or take the card down. Returns true if it did anything. */
	dismiss(): boolean {
		if (!this.isBusy()) return false;
		this.clearTimers();
		this.setState({ type: "idle" });
		return true;
	}

	/** One key/tap does both: start when idle, dismiss when a round is up. */
	toggle(trigger: ThinkOfACardTrigger): boolean {
		return this.isBusy() ? this.dismiss() : this.start(trigger);
	}

	/** Tear down without emitting state — for component unmount. */
	destroy(): void {
		this.clearTimers();
		this.state = { type: "idle" };
	}

	private tick(): void {
		if (this.state.type !== "countdown") return;

		const secondsLeft = this.state.secondsLeft - 1;
		if (secondsLeft > 0) {
			this.setState({ type: "countdown", secondsLeft });
			return;
		}

		this.reveal();
	}

	private reveal(): void {
		this.clearTimers();

		const card = this.callbacks.pickCard();
		const label = cardToLabel(card);
		const revealedAt = this.now();

		this.setState({ type: "reveal", card, label });

		this.callbacks.onRoundRevealed?.({
			card,
			label,
			trigger: this.trigger,
			startedAt: this.startedAt,
			revealedAt,
		});

		this.revealTimeoutId = this.timer.setTimeout(() => {
			this.revealTimeoutId = null;
			this.dismiss();
		}, THINK_OF_A_CARD_CONFIG.REVEAL_HOLD_MS);
	}

	private clearTimers(): void {
		if (this.countdownIntervalId !== null) {
			this.timer.clearInterval(this.countdownIntervalId);
			this.countdownIntervalId = null;
		}
		if (this.revealTimeoutId !== null) {
			this.timer.clearTimeout(this.revealTimeoutId);
			this.revealTimeoutId = null;
		}
	}

	private setState(state: ThinkOfACardState): void {
		this.state = state;
		this.callbacks.onStateChange(state);
	}
}
