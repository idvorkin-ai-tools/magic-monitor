import clsx from "clsx";
import type { SessionThumbnail } from "../types/sessions";
import { formatDuration } from "../utils/formatters";

// ===== Types =====

export interface ThumbnailGridProps {
	thumbnails: SessionThumbnail[];
	onSelect: (time: number) => void;
	/** Current playback time - if set, highlights the active thumbnail */
	currentTime?: number;
	/** Layout mode: 'aspect' uses CSS aspect-ratio, 'fixed' uses explicit dimensions */
	layout?: "aspect" | "fixed";
	/** For 'fixed' layout: thumbnail width in pixels */
	thumbWidth?: number;
	/** For 'fixed' layout: thumbnail height in pixels */
	thumbHeight?: number;
	/** Number of columns for grid layout (aspect mode only) */
	columns?: number;
	/** Whether to use mobile-optimized styling */
	isMobile?: boolean;
	/** Additional handler for pointer down (e.g., to stop propagation) */
	onPointerDown?: (e: React.PointerEvent) => void;
	/** Gap between thumbnails in pixels */
	gap?: number;
	/** CSS class for the container */
	className?: string;
}

// ===== Helpers =====

/**
 * Determines if a thumbnail is "active" based on current playback time.
 * A thumbnail is active if currentTime is >= its time and < the next thumbnail's time.
 */
function isThumbnailActive(
	thumb: SessionThumbnail,
	index: number,
	thumbnails: SessionThumbnail[],
	currentTime?: number,
): boolean {
	if (currentTime === undefined) return false;
	if (currentTime < thumb.time) return false;

	// Active if this is the last thumbnail or current time is before the next thumbnail
	const isLast = index === thumbnails.length - 1;
	const isBeforeNext = !isLast && currentTime < thumbnails[index + 1].time;

	return isLast || isBeforeNext;
}

/**
 * Formats time for thumbnail display.
 * Uses compact format (M:SS) for brevity.
 */
function formatThumbnailTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ===== Component =====

/**
 * Grid of clickable thumbnail images with time labels.
 * Supports two layout modes:
 * - 'aspect': Uses CSS aspect-ratio with grid columns (default)
 * - 'fixed': Uses explicit pixel dimensions with flex-wrap
 */
export function ThumbnailGrid({
	thumbnails,
	onSelect,
	currentTime,
	layout = "aspect",
	thumbWidth = 80,
	thumbHeight = 45,
	columns = 4,
	isMobile = false,
	onPointerDown,
	gap = 8,
	className,
}: ThumbnailGridProps) {
	if (thumbnails.length === 0) return null;

	const isFixedLayout = layout === "fixed";

	return (
		<div
			className={clsx(
				isFixedLayout ? "flex flex-wrap justify-center" : "grid",
				className,
			)}
			style={
				isFixedLayout
					? { gap: `${Math.min(gap, 4)}px` }
					: {
							gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
							gap: `${gap}px`,
						}
			}
		>
			{thumbnails.map((thumb, index) => {
				const isActive = isThumbnailActive(thumb, index, thumbnails, currentTime);

				return (
					<button
						key={`${thumb.time}-${index}`}
						onClick={() => onSelect(thumb.time)}
						onPointerDown={onPointerDown}
						style={
							isFixedLayout
								? { width: thumbWidth, height: thumbHeight }
								: undefined
						}
						className={clsx(
							"relative rounded overflow-hidden bg-gray-800 transition-all",
							"hover:ring-2 hover:ring-blue-500",
							!isFixedLayout && "aspect-video",
							isFixedLayout && "flex-shrink-0",
							isActive && "ring-2 ring-blue-500",
						)}
					>
						<img
							src={thumb.dataUrl}
							alt={`Frame at ${formatDuration(thumb.time)}`}
							className="w-full h-full object-contain"
						/>
						<div
							className={clsx(
								"absolute bg-black/70 text-white font-mono rounded",
								isMobile || isFixedLayout
									? "bottom-0.5 left-0.5 text-[10px] px-1"
									: "bottom-1 left-1 text-xs px-1.5 py-0.5",
							)}
						>
							{formatThumbnailTime(thumb.time)}
						</div>
						{/* Hover overlay for non-fixed layout */}
						{!isFixedLayout && (
							<div className="absolute inset-0 bg-blue-500/20 opacity-0 hover:opacity-100 transition-opacity" />
						)}
					</button>
				);
			})}
		</div>
	);
}
