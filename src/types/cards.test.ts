import { describe, expect, it } from "vitest";
import { classIndexToCard, cardToLabel, NUM_CLASSES } from "./cards";

describe("classIndexToCard", () => {
	// PD-Mera model: alphabetical ordering 10C,10D,10H,10S, 2C,2D,...
	it("maps index 0 to 10 of Clubs (10C)", () => {
		const card = classIndexToCard(0);
		expect(card).toEqual({ rank: "10", suit: "♣" });
	});

	it("maps index 3 to 10 of Spades (10S)", () => {
		const card = classIndexToCard(3);
		expect(card).toEqual({ rank: "10", suit: "♠" });
	});

	it("maps index 36 to Ace of Clubs (AC)", () => {
		const card = classIndexToCard(36);
		expect(card).toEqual({ rank: "A", suit: "♣" });
	});

	it("maps index 39 to Ace of Spades (AS)", () => {
		const card = classIndexToCard(39);
		expect(card).toEqual({ rank: "A", suit: "♠" });
	});

	it("maps index 51 to Queen of Spades (QS)", () => {
		const card = classIndexToCard(51);
		expect(card).toEqual({ rank: "Q", suit: "♠" });
	});

	it("returns null for out-of-range index", () => {
		expect(classIndexToCard(52)).toBeNull();
		expect(classIndexToCard(-1)).toBeNull();
	});

	it("has 52 classes", () => {
		expect(NUM_CLASSES).toBe(52);
	});
});

describe("cardToLabel", () => {
	it("formats Ace of Spades", () => {
		expect(cardToLabel({ rank: "A", suit: "♠" })).toBe("A♠");
	});

	it("formats 10 of Hearts", () => {
		expect(cardToLabel({ rank: "10", suit: "♥" })).toBe("10♥");
	});
});
