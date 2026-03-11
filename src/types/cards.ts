export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Suit = "\u2660" | "\u2665" | "\u2666" | "\u2663";

export interface PlayingCard {
	rank: Rank;
	suit: Suit;
}

export interface BoundingBox {
	x: number; // normalized center x (0-1)
	y: number; // normalized center y (0-1)
	width: number; // normalized width (0-1)
	height: number; // normalized height (0-1)
}

export interface CardDetection {
	card: PlayingCard;
	label: string; // "A\u2660", "7\u2665", etc.
	bbox: BoundingBox;
	confidence: number; // 0-1
}

// YOLO class index to card mapping
// Standard 52-class playing card dataset order (Roboflow convention)
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["\u2660", "\u2665", "\u2666", "\u2663"];

// Build class map: 0-12 = spades A-K, 13-25 = hearts A-K, etc.
const CLASS_MAP: PlayingCard[] = [];
for (const suit of SUITS) {
	for (const rank of RANKS) {
		CLASS_MAP.push({ rank, suit });
	}
}

export function classIndexToCard(index: number): PlayingCard | null {
	return CLASS_MAP[index] ?? null;
}

export function cardToLabel(card: PlayingCard): string {
	return `${card.rank}${card.suit}`;
}

export const SUIT_COLORS: Record<Suit, string> = {
	"\u2660": "#1a1a2e",
	"\u2665": "#dc2626",
	"\u2666": "#dc2626",
	"\u2663": "#1a1a2e",
};

export const NUM_CLASSES = 52;
