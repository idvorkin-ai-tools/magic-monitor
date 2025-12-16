import { StatusButton } from "./StatusButton";

export interface SmartZoomToggleProps {
	isSmartZoom: boolean;
	onSmartZoomChange: (enabled: boolean) => void;
	isModelLoading: boolean;
	loadingProgress: number;
	loadingPhase: "downloading" | "initializing";
}

/**
 * Toggle button for Smart Zoom feature with loading state display.
 * Shows download/initialization progress when model is loading.
 */
export function SmartZoomToggle({
	isSmartZoom,
	onSmartZoomChange,
	isModelLoading,
	loadingProgress,
	loadingPhase,
}: SmartZoomToggleProps) {
	const getButtonText = () => {
		if (isModelLoading) {
			return loadingPhase === "initializing"
				? "Initializing..."
				: `Downloading ${loadingProgress}%`;
		}
		return isSmartZoom ? "Smart \u2713" : "Smart";
	};

	return (
		<StatusButton
			onClick={() => onSmartZoomChange(!isSmartZoom)}
			disabled={isModelLoading}
			active={isSmartZoom && !isModelLoading}
			color="green"
			title="Smart Zoom - Auto-follow movement"
		>
			{getButtonText()}
		</StatusButton>
	);
}
