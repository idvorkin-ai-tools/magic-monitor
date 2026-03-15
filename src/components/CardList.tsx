import clsx from "clsx";
import type { CardDetection } from "../types/cards";

interface CardListProps {
	detections: CardDetection[];
}

const SUIT_TEXT_COLORS: Record<string, string> = {
	"\u2660": "text-blue-300",
	"\u2663": "text-green-300",
	"\u2665": "text-red-400",
	"\u2666": "text-orange-400",
};

/**
 * Small panel showing currently detected cards.
 * Uses React state (not refs) since it updates at ~10Hz.
 */
export function CardList({ detections }: CardListProps) {
	if (detections.length === 0) return null;

	return (
		<div className="absolute top-4 right-4 z-40 bg-black/60 backdrop-blur-sm rounded-lg p-3 min-w-[80px]">
			<div className="text-xs text-gray-400 mb-2 font-medium">Cards</div>
			<div className="flex flex-col gap-1">
				{detections.map((det, i) => (
					<div
						key={`${det.label}-${i}`}
						className={clsx(
							"text-lg font-bold font-mono leading-tight",
							SUIT_TEXT_COLORS[det.card.suit] ?? "text-white",
						)}
					>
						{det.label}
					</div>
				))}
			</div>
		</div>
	);
}
