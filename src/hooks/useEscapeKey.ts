import { useEffect } from "react";

interface UseEscapeKeyOptions {
	/** A think-of-a-card round is on screen. Optional: omit and Escape ignores it. */
	isThinkingOfACard?: boolean;
	isSettingsOpen: boolean;
	isPickingColor: boolean;
	isReplaying: boolean;
	onDismissThinkOfACard?: () => void;
	onCloseSettings: () => void;
	onCancelColorPick: () => void;
	onExitReplay: () => void;
}

export function useEscapeKey({
	isThinkingOfACard = false,
	onDismissThinkOfACard,
	isSettingsOpen,
	isPickingColor,
	isReplaying,
	onCloseSettings,
	onCancelColorPick,
	onExitReplay,
}: UseEscapeKeyOptions) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// The think-of-a-card overlay sits above everything else, so it
				// takes Escape first.
				if (isThinkingOfACard) {
					onDismissThinkOfACard?.();
				} else if (isSettingsOpen) {
					onCloseSettings();
				} else if (isPickingColor) {
					onCancelColorPick();
				} else if (isReplaying) {
					onExitReplay();
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		isThinkingOfACard,
		onDismissThinkOfACard,
		isSettingsOpen,
		isPickingColor,
		isReplaying,
		onCloseSettings,
		onCancelColorPick,
		onExitReplay,
	]);
}
