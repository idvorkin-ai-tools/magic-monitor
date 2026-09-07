import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerService } from "../services/TimerService";
import type { PlayingCard } from "../types/cards";
import {
	THINK_OF_A_CARD_CONFIG,
	ThinkOfACardMachine,
	type ThinkOfACardRound,
	type ThinkOfACardState,
} from "./ThinkOfACardMachine";

const ACE_OF_SPADES: PlayingCard = { rank: "A", suit: "♠" };
const SEVEN_OF_HEARTS: PlayingCard = { rank: "7", suit: "♥" };

function createMachine(cards: PlayingCard[] = [ACE_OF_SPADES]) {
	let next = 0;
	const states: ThinkOfACardState[] = [];
	const rounds: ThinkOfACardRound[] = [];

	const machine = new ThinkOfACardMachine({
		pickCard: () => cards[Math.min(next++, cards.length - 1)],
		onStateChange: (state) => states.push(state),
		onRoundRevealed: (round) => rounds.push(round),
		timer: TimerService,
		now: () => Date.now(),
	});

	return { machine, states, rounds };
}

/** Advance to the moment the card appears. */
function runCountdown() {
	vi.advanceTimersByTime(
		THINK_OF_A_CARD_CONFIG.COUNTDOWN_SECONDS * THINK_OF_A_CARD_CONFIG.TICK_MS,
	);
}

describe("ThinkOfACardMachine", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("initial state", () => {
		it("starts idle and not busy", () => {
			const { machine } = createMachine();
			expect(machine.getState()).toEqual({ type: "idle" });
			expect(machine.isBusy()).toBe(false);
		});
	});

	describe("countdown", () => {
		it("enters the countdown at the full second count", () => {
			const { machine } = createMachine();
			expect(machine.start("key")).toBe(true);

			expect(machine.getState()).toEqual({
				type: "countdown",
				secondsLeft: THINK_OF_A_CARD_CONFIG.COUNTDOWN_SECONDS,
			});
			expect(machine.isBusy()).toBe(true);
		});

		it("counts down one numeral per second, 5 to 1", () => {
			const { machine, states } = createMachine();
			machine.start("key");

			for (let i = 0; i < THINK_OF_A_CARD_CONFIG.COUNTDOWN_SECONDS - 1; i++) {
				vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.TICK_MS);
			}

			const counts = states
				.filter((s) => s.type === "countdown")
				.map((s) => (s.type === "countdown" ? s.secondsLeft : 0));
			expect(counts).toEqual([5, 4, 3, 2, 1]);
			expect(machine.getState().type).toBe("countdown");
		});

		it("reveals a card when the countdown runs out", () => {
			const { machine } = createMachine([ACE_OF_SPADES]);
			machine.start("key");
			runCountdown();

			expect(machine.getState()).toEqual({
				type: "reveal",
				card: ACE_OF_SPADES,
				label: "A♠",
			});
		});

		it("ignores a second trigger while a round is running", () => {
			const { machine } = createMachine();
			machine.start("key");

			expect(machine.start("gesture")).toBe(false);
			expect(machine.getState()).toEqual({
				type: "countdown",
				secondsLeft: THINK_OF_A_CARD_CONFIG.COUNTDOWN_SECONDS,
			});
		});
	});

	describe("reveal", () => {
		it("returns to idle on its own after the hold", () => {
			const { machine } = createMachine();
			machine.start("key");
			runCountdown();

			vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.REVEAL_HOLD_MS - 1);
			expect(machine.getState().type).toBe("reveal");

			vi.advanceTimersByTime(1);
			expect(machine.getState()).toEqual({ type: "idle" });
		});

		it("does not keep ticking the countdown after the reveal", () => {
			const { machine, states } = createMachine();
			machine.start("key");
			runCountdown();
			vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.TICK_MS * 2);

			// Only the reveal, no further countdown states after it.
			const afterReveal = states.slice(
				states.findIndex((s) => s.type === "reveal"),
			);
			expect(afterReveal.every((s) => s.type === "reveal")).toBe(true);
		});

		it("runs the full idle -> countdown -> reveal -> idle cycle", () => {
			const { machine, states } = createMachine();
			machine.start("key");
			runCountdown();
			vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.REVEAL_HOLD_MS);

			expect(states.map((s) => s.type)).toEqual([
				"countdown",
				"countdown",
				"countdown",
				"countdown",
				"countdown",
				"reveal",
				"idle",
			]);
		});
	});

	describe("dismiss", () => {
		it("cancels a countdown before any card is picked", () => {
			const { machine, rounds } = createMachine();
			machine.start("key");
			vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.TICK_MS * 2);

			expect(machine.dismiss()).toBe(true);
			expect(machine.getState()).toEqual({ type: "idle" });

			// The cancelled countdown must not fire later.
			vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.TICK_MS * 10);
			expect(machine.getState()).toEqual({ type: "idle" });
			expect(rounds).toHaveLength(0);
		});

		it("takes the card down early", () => {
			const { machine } = createMachine();
			machine.start("key");
			runCountdown();

			expect(machine.dismiss()).toBe(true);
			expect(machine.getState()).toEqual({ type: "idle" });
		});

		it("is a no-op when idle", () => {
			const { machine, states } = createMachine();
			expect(machine.dismiss()).toBe(false);
			expect(states).toHaveLength(0);
		});

		it("does not re-fire the auto-hide after an early dismiss", () => {
			const { machine, states } = createMachine();
			machine.start("key");
			runCountdown();
			machine.dismiss();

			const stateCount = states.length;
			vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.REVEAL_HOLD_MS * 2);
			expect(states).toHaveLength(stateCount);
		});
	});

	describe("toggle", () => {
		it("starts a round when idle", () => {
			const { machine } = createMachine();
			machine.toggle("key");
			expect(machine.getState().type).toBe("countdown");
		});

		it("cancels the round when one is up", () => {
			const { machine } = createMachine();
			machine.toggle("key");
			machine.toggle("key");
			expect(machine.getState()).toEqual({ type: "idle" });
		});
	});

	describe("round log", () => {
		it("records the card, the trigger and the timings", () => {
			const { machine, rounds } = createMachine([SEVEN_OF_HEARTS]);
			const startedAt = Date.now();
			machine.start("gesture");
			runCountdown();

			expect(rounds).toHaveLength(1);
			expect(rounds[0]).toMatchObject({
				card: SEVEN_OF_HEARTS,
				label: "7♥",
				trigger: "gesture",
				startedAt,
			});
			expect(rounds[0].revealedAt - rounds[0].startedAt).toBe(
				THINK_OF_A_CARD_CONFIG.COUNTDOWN_SECONDS *
					THINK_OF_A_CARD_CONFIG.TICK_MS,
			);
		});

		it("records one round per trigger across several rounds", () => {
			const { machine, rounds } = createMachine([
				ACE_OF_SPADES,
				SEVEN_OF_HEARTS,
			]);

			machine.start("key");
			runCountdown();
			machine.dismiss();

			machine.start("button");
			runCountdown();

			expect(rounds.map((r) => r.label)).toEqual(["A♠", "7♥"]);
			expect(rounds.map((r) => r.trigger)).toEqual(["key", "button"]);
		});

		it("logs nothing for a countdown that was cancelled", () => {
			const { machine, rounds } = createMachine();
			machine.start("button");
			vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.TICK_MS);
			machine.dismiss();
			vi.advanceTimersByTime(THINK_OF_A_CARD_CONFIG.TICK_MS * 10);

			expect(rounds).toHaveLength(0);
		});
	});

	describe("destroy", () => {
		it("clears pending timers without emitting state", () => {
			const { machine, states } = createMachine();
			machine.start("key");
			const stateCount = states.length;

			machine.destroy();
			vi.advanceTimersByTime(60_000);

			expect(states).toHaveLength(stateCount);
			expect(machine.getState()).toEqual({ type: "idle" });
		});
	});

	describe("defaults", () => {
		it("uses the real timer service when none is injected", () => {
			const machine = new ThinkOfACardMachine({
				pickCard: () => ACE_OF_SPADES,
				onStateChange: () => {},
			});

			machine.start("key");
			runCountdown();
			expect(machine.getState().type).toBe("reveal");
			machine.destroy();
		});
	});
});
