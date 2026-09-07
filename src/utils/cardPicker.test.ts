import { describe, expect, it } from "vitest";
import { cardToLabel } from "../types/cards";
import {
	ALL_CARDS,
	createCardPicker,
	DEFAULT_NO_REPEAT_HISTORY,
} from "./cardPicker";

describe("createCardPicker", () => {
	it("draws from the full 52-card deck", () => {
		expect(ALL_CARDS).toHaveLength(52);
		const labels = new Set(ALL_CARDS.map(cardToLabel));
		expect(labels.size).toBe(52);
	});

	it("returns a real card", () => {
		const picker = createCardPicker({ random: () => 0 });
		const card = picker.pick();
		expect(ALL_CARDS.map(cardToLabel)).toContain(cardToLabel(card));
	});

	it("never repeats a card inside the history window", () => {
		// Always take the first available candidate; with no exclusion this
		// would return the same card every time.
		const picker = createCardPicker({ historySize: 10, random: () => 0 });
		const drawn = Array.from({ length: 10 }, () => cardToLabel(picker.pick()));

		expect(new Set(drawn).size).toBe(10);
	});

	it("lets a card come back once it falls out of the history window", () => {
		const picker = createCardPicker({ historySize: 3, random: () => 0 });
		const drawn = Array.from({ length: 5 }, () => cardToLabel(picker.pick()));

		// Draws 2-4 are excluded by the window at draw 5; the 1st has aged out.
		expect(drawn.slice(0, 4)).toEqual([...new Set(drawn.slice(0, 4))]);
		expect(drawn[4]).toBe(drawn[0]);
	});

	it("keeps at most historySize entries", () => {
		const picker = createCardPicker({ historySize: 3, random: () => 0 });
		for (let i = 0; i < 8; i++) picker.pick();

		expect(picker.getHistory()).toHaveLength(3);
	});

	it("defaults to a 10-card memory", () => {
		const picker = createCardPicker({ random: () => 0 });
		for (let i = 0; i < 20; i++) picker.pick();

		expect(picker.getHistory()).toHaveLength(DEFAULT_NO_REPEAT_HISTORY);
	});

	it("spreads uniformly over the deck", () => {
		// No history so every draw sees all 52 candidates; sweeping random()
		// through the centre of each bucket must hit every card exactly once.
		const picks: string[] = [];
		let i = 0;
		const picker = createCardPicker({
			historySize: 0,
			random: () => (i + 0.5) / 52,
		});
		for (i = 0; i < 52; i++) picks.push(cardToLabel(picker.pick()));

		expect(new Set(picks).size).toBe(52);
	});

	it("survives a random() that returns exactly 1", () => {
		const picker = createCardPicker({ historySize: 0, random: () => 1 });
		expect(picker.pick()).toBeDefined();
	});

	it("clamps an oversized history so a draw always exists", () => {
		const picker = createCardPicker({ historySize: 999, random: () => 0 });
		for (let i = 0; i < 52; i++) expect(picker.pick()).toBeDefined();
		expect(picker.getHistory()).toHaveLength(51);
	});
});
