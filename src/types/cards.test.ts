import { describe, expect, it } from "vitest";
import { classIndexToCard, cardToLabel, NUM_CLASSES } from "./cards";

describe("classIndexToCard", () => {
	// Alphabetical dataset order: 0=10C, 1=10D, 2=10H, 3=10S, 4=2C, ...

	it("maps index 0 to 10 of Clubs", () => {
		expect(classIndexToCard(0)).toEqual({ rank: "10", suit: "\u2663" });
	});

	it("maps index 2 to 10 of Hearts", () => {
		expect(classIndexToCard(2)).toEqual({ rank: "10", suit: "\u2665" });
	});

	it("maps index 36 to Ace of Clubs", () => {
		expect(classIndexToCard(36)).toEqual({ rank: "A", suit: "\u2663" });
	});

	it("maps index 39 to Ace of Spades", () => {
		expect(classIndexToCard(39)).toEqual({ rank: "A", suit: "\u2660" });
	});

	it("maps index 51 to Queen of Spades", () => {
		expect(classIndexToCard(51)).toEqual({ rank: "Q", suit: "\u2660" });
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
		expect(cardToLabel({ rank: "A", suit: "\u2660" })).toBe("A\u2660");
	});

	it("formats 10 of Hearts", () => {
		expect(cardToLabel({ rank: "10", suit: "\u2665" })).toBe("10\u2665");
	});
});
