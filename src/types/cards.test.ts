import { describe, expect, it } from "vitest";
import { classIndexToCard, cardToLabel, NUM_CLASSES } from "./cards";

describe("classIndexToCard", () => {
	it("maps index 0 to Ace of Spades", () => {
		const card = classIndexToCard(0);
		expect(card).toEqual({ rank: "A", suit: "\u2660" });
	});

	it("maps index 12 to King of Spades", () => {
		const card = classIndexToCard(12);
		expect(card).toEqual({ rank: "K", suit: "\u2660" });
	});

	it("maps index 13 to Ace of Hearts", () => {
		const card = classIndexToCard(13);
		expect(card).toEqual({ rank: "A", suit: "\u2665" });
	});

	it("maps index 51 to King of Clubs", () => {
		const card = classIndexToCard(51);
		expect(card).toEqual({ rank: "K", suit: "\u2663" });
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
