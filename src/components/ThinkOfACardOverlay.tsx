import clsx from "clsx";
import { useState } from "react";
import type { ThinkOfACardState } from "../machines/ThinkOfACardMachine";
import type { PlayingCard, Suit } from "../types/cards";

/**
 * Think-of-a-card countdown and reveal, in a small translucent panel tucked
 * into the bottom-left corner.
 *
 * Deliberately NOT a full-screen overlay: the camera stage has to keep doing
 * its job while Igor performs, so nothing covers the middle of the frame. The
 * panel sits in the one corner nothing else uses — the minimap is top-right,
 * the status readout bottom-right, the control bar along the bottom. It clears
 * the control bar's height (bottom-28) so it works on the full-width mobile bar
 * as well as the centred desktop one.
 */

/**
 * Panel width: ~20% of the shorter viewport side, floored and capped so it
 * stays legible on a phone without taking over a large monitor. Every type
 * size inside is an `em` of the card's width, so the whole thing scales as one
 * unit.
 */
const PANEL_WIDTH = "clamp(96px, 20vmin, 220px)";
/** Panel padding, as a fraction of panel width. */
const PANEL_PADDING = 0.05;
/** Card fills the panel minus its padding; drives the `em` scale of the face. */
const CARD_WIDTH = `calc(${PANEL_WIDTH} * ${1 - PANEL_PADDING * 2})`;

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

type ActiveState = Exclude<ThinkOfACardState, { type: "idle" }>;

interface ThinkOfACardOverlayProps {
	state: ThinkOfACardState;
	onDismiss: () => void;
}

export function ThinkOfACardOverlay({
	state,
	onDismiss,
}: ThinkOfACardOverlayProps) {
	// Keep the last active content mounted through the fade-out, otherwise the
	// panel would vanish instantly instead of easing away. Adjusted during
	// render (React's documented pattern) rather than in an effect, which would
	// paint an empty panel for a frame first.
	const [content, setContent] = useState<ActiveState | null>(null);
	const visible = state.type !== "idle";
	if (state.type !== "idle" && content !== state) setContent(state);

	// Rendered from mount (hidden) rather than mounted on demand, so the very
	// first round fades in instead of snapping to full opacity.
	return (
		<button
			type="button"
			data-testid="think-overlay"
			onClick={onDismiss}
			title="P · tap · Esc to clear"
			aria-label="Dismiss think of a card"
			className={clsx(
				"absolute bottom-28 left-4 z-[60] rounded-2xl bg-black/75 ring-1 ring-white/10 backdrop-blur-sm",
				// Visibility is transitioned alongside opacity so it flips only once
				// the fade has finished - the panel is genuinely hidden when idle.
				"transition-[opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
				// The whole panel - card face included - sits at 70%, so it reads as
				// a translucent aside rather than something shouting over the stage.
				// The backdrop is darker than that to keep the countdown numeral
				// legible against a bright camera frame.
				visible
					? "visible opacity-[0.7]"
					: "invisible opacity-0 pointer-events-none",
			)}
			style={{
				width: PANEL_WIDTH,
				padding: `calc(${PANEL_WIDTH} * ${PANEL_PADDING})`,
			}}
		>
			<div className="flex aspect-[5/7] w-full items-center justify-center">
				{content?.type === "countdown" && (
					<Countdown secondsLeft={content.secondsLeft} />
				)}
				{content?.type === "reveal" && (
					<CardFace card={content.card} label={content.label} />
				)}
			</div>
		</button>
	);
}

function Countdown({ secondsLeft }: { secondsLeft: number }) {
	return (
		<span
			data-testid="think-countdown"
			aria-live="polite"
			className="font-mono font-bold text-white leading-none tabular-nums"
			style={{ fontSize: `calc(${CARD_WIDTH} * 0.62)` }}
		>
			{secondsLeft}
		</span>
	);
}

function CardFace({ card, label }: { card: PlayingCard; label: string }) {
	return (
		<div
			data-testid="think-card"
			data-card={label}
			role="img"
			aria-live="assertive"
			aria-label={`${card.rank} of ${SUIT_NAMES[card.suit]}`}
			className="relative aspect-[5/7] w-full rounded-[0.05em] bg-white"
			style={{ fontSize: CARD_WIDTH, color: SUIT_COLORS[card.suit] }}
		>
			<CornerIndex card={card} className="top-[0.04em] left-[0.05em]" />
			<CornerIndex
				card={card}
				className="right-[0.05em] bottom-[0.04em] rotate-180"
			/>

			<div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
				<span className="font-bold text-[0.46em]">{card.rank}</span>
				<span className="text-[0.34em]">{card.suit}</span>
			</div>
		</div>
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
