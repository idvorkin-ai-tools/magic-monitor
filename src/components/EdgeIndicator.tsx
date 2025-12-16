import clsx from "clsx";

interface EdgeIndicatorProps {
	edge: "left" | "right" | "top" | "bottom";
	visible: boolean;
}

/**
 * Visual indicator for pan boundary clamping (see docs/SMART_ZOOM_SPEC.md)
 * Shows a red bar at the specified edge when visible.
 */
export function EdgeIndicator({ edge, visible }: EdgeIndicatorProps) {
	const positionClasses = {
		left: "left-0 top-0 bottom-0 w-2",
		right: "right-0 top-0 bottom-0 w-2",
		top: "top-0 left-0 right-0 h-2",
		bottom: "bottom-0 left-0 right-0 h-2",
	};

	return (
		<div
			className={clsx(
				"absolute bg-red-500 z-40 pointer-events-none transition-opacity duration-150",
				positionClasses[edge],
				visible ? "opacity-100" : "opacity-0",
			)}
		/>
	);
}
