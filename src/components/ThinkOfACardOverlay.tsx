import clsx from "clsx";
import type { ThinkOfACardState } from "../machines/ThinkOfACardMachine";
import type { PlayingCard, Suit } from "../types/cards";

/**
 * Full-screen overlay for a think-of-a-card round: the countdown, then the
 * card the "spectator" thought of.
 *
 * Sized to be read across a room — Igor is standing back from the camera with
 * a deck in his hands, not leaning into the screen.
 */

/** Card width drives every type size below via `em`, so the face scales as one unit. */
const CARD_WIDTH = "min(50vh, 86vw)";

const SUIT_COLORS: Record<Suit, string> = {
	"♠": "#111827", // spades - near black
	"♣": "#111827", // clubs - near black
	"♥": "#dc2626", // hearts - red
	"♦": "#dc2626", // diamonds - red
};

const SUIT_NAMES: Record<Suit, string> = {
	"♠": "spades",
	"♣": "clubs",
	"♥": "hearts",
	"♦": "diamonds",
};

interface ThinkOfACardOverlayProps {
	state: ThinkOfACardState;
	onDismiss: () => void;
}

export function ThinkOfACardOverlay({
	state,
	onDismiss,
}: ThinkOfACardOverlayProps) {
	if (state.type === "idle") return null;

	return (
		<div
			data-testid="think-overlay"
			className="absolute inset-0 z-[60] flex items-center justify-center"
		>
			{/* Scrim doubles as the tap target, so anywhere on screen dismisses. */}
			<button
				type="button"
				onClick={onDismiss}
				aria-label="Dismiss think of a card"
				className="absolute inset-0 bg-black/85 backdrop-blur-sm cursor-pointer"
			/>

			<div className="relative pointer-events-none flex flex-col items-center gap-[3vh]">
				{state.type === "countdown" ? (
					<Countdown secondsLeft={state.secondsLeft} />
				) : (
					<Reveal card={state.card} label={state.label} />
				)}
			</div>
		</div>
	);
}

function Countdown({ secondsLeft }: { secondsLeft: number }) {
	return (
		<>
			{/* key remounts the numeral each second so the pop animation replays */}
			<span
				key={secondsLeft}
				data-testid="think-countdown"
				aria-live="polite"
				className="think-countdown-numeral font-mono font-bold text-white leading-none tabular-nums text-[38vh]"
			>
				{secondsLeft}
			</span>
			<span className="font-mono text-white/40 text-sm tracking-[0.4em] uppercase">
				think of one… now
			</span>
		</>
	);
}

function Reveal({ card, label }: { card: PlayingCard; label: string }) {
	const color = SUIT_COLORS[card.suit];

	return (
		<>
			<div
				data-testid="think-card"
				data-card={label}
				role="img"
				aria-live="assertive"
				aria-label={`${card.rank} of ${SUIT_NAMES[card.suit]}`}
				className="think-card-face relative aspect-[5/7] rounded-[0.05em] bg-white shadow-2xl"
				style={{ width: CARD_WIDTH, fontSize: CARD_WIDTH, color }}
			>
				<CornerIndex card={card} className="top-[0.04em] left-[0.05em]" />
				<CornerIndex
					card={card}
					className="bottom-[0.04em] right-[0.05em] rotate-180"
				/>

				<div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
					<span className="font-bold text-[0.46em]">{card.rank}</span>
					<span className="text-[0.34em]">{card.suit}</span>
				</div>
			</div>

			<span className="font-mono text-white/40 text-sm tracking-[0.3em] uppercase">
				P · tap · esc to clear
			</span>
		</>
	);
}

function CornerIndex({
	card,
	className,
}: {
	card: PlayingCard;
	className?: string;
}) {
	return (
		<div
			className={clsx(
				"absolute flex flex-col items-center leading-none",
				className,
			)}
		>
			<span className="font-bold text-[0.13em]">{card.rank}</span>
			<span className="text-[0.11em]">{card.suit}</span>
		</div>
	);
}
