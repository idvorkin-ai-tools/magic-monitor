import { useEffect } from "react";

interface UseEscapeKeyOptions {
	isSettingsOpen: boolean;
	isPickingColor: boolean;
	isReplaying: boolean;
	onCloseSettings: () => void;
	onCancelColorPick: () => void;
	onExitReplay: () => void;
}

export function useEscapeKey({
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
				if (isSettingsOpen) {
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
		isSettingsOpen,
		isPickingColor,
		isReplaying,
		onCloseSettings,
		onCancelColorPick,
		onExitReplay,
	]);
}
