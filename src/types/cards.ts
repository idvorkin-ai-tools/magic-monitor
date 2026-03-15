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
// Alphabetical order from Roboflow data.yaml:
// 0=10C, 1=10D, 2=10H, 3=10S, 4=2C, 5=2D, ... 36=AC, 37=AD, 38=AH, 39=AS, ...
const DATASET_LABELS = [
	"10C","10D","10H","10S","2C","2D","2H","2S","3C","3D","3H","3S",
	"4C","4D","4H","4S","5C","5D","5H","5S","6C","6D","6H","6S",
	"7C","7D","7H","7S","8C","8D","8H","8S","9C","9D","9H","9S",
	"AC","AD","AH","AS","JC","JD","JH","JS","KC","KD","KH","KS",
	"QC","QD","QH","QS",
] as const;

const SUIT_CHAR_MAP: Record<string, Suit> = { C: "\u2663", D: "\u2666", H: "\u2665", S: "\u2660" };

const CLASS_MAP: PlayingCard[] = DATASET_LABELS.map((label) => {
	const suitChar = label.slice(-1);
	const rankStr = label.slice(0, -1);
	return { rank: rankStr as Rank, suit: SUIT_CHAR_MAP[suitChar] };
});

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
