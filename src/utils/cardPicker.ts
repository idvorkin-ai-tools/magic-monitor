/**
 * Picks the card the imaginary spectator "thought of" for a
 * think-of-a-card round.
 *
 * Uniform over all 52 cards, except that the last few cards drawn are held
 * back so practice does not keep serving the same card. Igor is rehearsing a
 * memorised-deck riff where the finish depends on where the named card sits,
 * so hearing "seven of clubs" twice in a row wastes a rep.
 */

import {
	classIndexToCard,
	NUM_CLASSES,
	type PlayingCard,
} from "../types/cards";

/**
 * All 52 cards, one of each. Built from the card detector's class map so
 * there is a single definition of "the deck" in the app.
 */
export const ALL_CARDS: readonly PlayingCard[] = Array.from(
	{ length: NUM_CLASSES },
	(_, i) => classIndexToCard(i),
).filter((card): card is PlayingCard => card !== null);

/** How many recent cards are held back from the next draw. */
export const DEFAULT_NO_REPEAT_HISTORY = 10;

export interface CardPickerOptions {
	/** Cards drawn this recently are excluded. Clamped to 51 so a draw always exists. */
	historySize?: number;
	/** Injectable randomness so tests can pin the draw. Defaults to Math.random. */
	random?: () => number;
}

export interface CardPicker {
	pick: () => PlayingCard;
	/** Most-recent-last. Exposed for assertions and debugging, not for UI. */
	getHistory: () => PlayingCard[];
}

export function createCardPicker(options: CardPickerOptions = {}): CardPicker {
	const { random = Math.random } = options;
	const historySize = Math.min(
		Math.max(options.historySize ?? DEFAULT_NO_REPEAT_HISTORY, 0),
		ALL_CARDS.length - 1,
	);

	const history: PlayingCard[] = [];

	const wasRecent = (card: PlayingCard) =>
		history.some((h) => h.rank === card.rank && h.suit === card.suit);

	const pick = (): PlayingCard => {
		const candidates = ALL_CARDS.filter((card) => !wasRecent(card));
		// Clamp: a random() stub that returns exactly 1 would otherwise index past the end.
		const index = Math.min(
			Math.floor(random() * candidates.length),
			candidates.length - 1,
		);
		const card = candidates[index];

		history.push(card);
		if (history.length > historySize) history.shift();

		return card;
	};

	return { pick, getHistory: () => [...history] };
}
