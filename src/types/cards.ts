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
// PD-Mera model uses alphabetical ordering: 10C,10D,10H,10S, 2C,2D,..., QS
// Ranks in alphabetical order, each with suits C(♣), D(♦), H(♥), S(♠)
const PD_MERA_RANKS: Rank[] = ["10", "2", "3", "4", "5", "6", "7", "8", "9", "A", "J", "K", "Q"];
const PD_MERA_SUITS: Suit[] = ["♣", "♦", "♥", "♠"];

const CLASS_MAP: PlayingCard[] = [];
for (const rank of PD_MERA_RANKS) {
	for (const suit of PD_MERA_SUITS) {
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
