import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";
import type { SessionThumbnail } from "../types/sessions";

// ===== Types =====

interface TimelineProps {
	currentTime: number;
	duration: number;
	inPoint: number | null;
	outPoint: number | null;
	onSeek: (time: number) => void;
	thumbnails?: SessionThumbnail[];
	isMobile?: boolean;
	disabled?: boolean;
	thumbnailSize?: number; // 0-100, controls thumbnail dimensions
}

// ===== Component =====

export function Timeline({
	currentTime,
	duration,
	inPoint,
	outPoint,
	onSeek,
	thumbnails,
	isMobile = false,
	disabled = false,
	thumbnailSize = 50,
}: TimelineProps) {
	// Calculate thumbnail dimensions based on size slider (0=small, 100=large)
	// Width ranges from 32px to 96px, height maintains 16:9 aspect
	const thumbWidth = Math.round(32 + (thumbnailSize / 100) * 64);
	const thumbHeight = Math.round(thumbWidth * (9 / 16));
	const trackRef = useRef<HTMLDivElement>(null);
	const activeHandlersRef = useRef<{
		move: ((e: PointerEvent) => void) | null;
		up: ((e: PointerEvent) => void) | null;
	}>({ move: null, up: null });

	// Calculate time from click position
	const getTimeFromPosition = useCallback(
		(clientX: number): number => {
			if (!trackRef.current || duration <= 0) return 0;

			const rect = trackRef.current.getBoundingClientRect();
			const x = clientX - rect.left;
			const percent = Math.max(0, Math.min(1, x / rect.width));
			return percent * duration;
		},
		[duration],
	);

	// Handle click/drag on timeline
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			// Don't call preventDefault - causes issues with passive event listeners
			const track = trackRef.current;
			if (!track || disabled) return;

			// Capture pointer for drag tracking
			track.setPointerCapture(e.pointerId);

			// Seek to click position
			const time = getTimeFromPosition(e.clientX);
			onSeek(time);

			// Set up drag using pointer capture (no need for document listeners)
			const handleMove = (moveEvent: PointerEvent) => {
				const newTime = getTimeFromPosition(moveEvent.clientX);
				onSeek(newTime);
			};

			const handleUp = (upEvent: PointerEvent) => {
				track.releasePointerCapture(upEvent.pointerId);
				track.removeEventListener("pointermove", handleMove);
				track.removeEventListener("pointerup", handleUp);
				track.removeEventListener("pointercancel", handleUp);
				activeHandlersRef.current = { move: null, up: null };
			};

			activeHandlersRef.current = { move: handleMove, up: handleUp };
			track.addEventListener("pointermove", handleMove);
			track.addEventListener("pointerup", handleUp);
			track.addEventListener("pointercancel", handleUp);
		},
		[getTimeFromPosition, onSeek, disabled],
	);


	// Cleanup effect to remove event listeners if component unmounts during drag
	useEffect(() => {
		const track = trackRef.current;
		return () => {
			const handlers = activeHandlersRef.current;
			if (track && handlers.move) {
				track.removeEventListener("pointermove", handlers.move);
				track.removeEventListener("pointerup", handlers.up!);
				track.removeEventListener("pointercancel", handlers.up!);
			}
		};
	}, []);
	// Calculate positions as percentages
	const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
	const inPercent = inPoint !== null && duration > 0 ? (inPoint / duration) * 100 : null;
	const outPercent = outPoint !== null && duration > 0 ? (outPoint / duration) * 100 : null;

	return (
		<div className="w-full">
			{/* Thumbnail strip (if available) */}
			{thumbnails && thumbnails.length > 0 && (
				<div className="flex gap-1 mb-2 overflow-x-auto pb-1">
					{thumbnails.map((thumb, index) => (
						<button
							key={index}
							onClick={() => onSeek(thumb.time)}
							style={{ width: thumbWidth, height: thumbHeight }}
							className={clsx(
								"flex-shrink-0 rounded overflow-hidden",
								"hover:ring-2 hover:ring-blue-500 transition-all",
								currentTime >= thumb.time &&
									(index === thumbnails.length - 1 ||
										currentTime < thumbnails[index + 1]?.time) &&
									"ring-2 ring-blue-500",
							)}
						>
							<img
								src={thumb.dataUrl}
								alt=""
								className="w-full h-full object-cover"
							/>
						</button>
					))}
				</div>
			)}

			{/* Timeline track */}
			<div
				ref={trackRef}
				className={clsx(
					"relative w-full bg-gray-700 rounded-full touch-none",
					isMobile ? "h-2" : "h-3",
					disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
				)}
				onPointerDown={handlePointerDown}
			>
				{/* Trim selection highlight */}
				{inPercent !== null && outPercent !== null && (
					<div
						className="absolute top-0 bottom-0 bg-green-600/50 rounded-full"
						style={{
							left: `${inPercent}%`,
							width: `${outPercent - inPercent}%`,
						}}
					/>
				)}

				{/* Progress fill */}
				<div
					className="absolute top-0 left-0 bottom-0 bg-blue-500 rounded-full"
					style={{ width: `${currentPercent}%` }}
				/>

				{/* In point marker */}
				{inPercent !== null && (
					<div
						className="absolute top-0 bottom-0 w-1 bg-green-500"
						style={{ left: `${inPercent}%` }}
						title="In point"
					>
						<div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-green-500 rotate-45" />
					</div>
				)}

				{/* Out point marker */}
				{outPercent !== null && (
					<div
						className="absolute top-0 bottom-0 w-1 bg-green-500"
						style={{ left: `${outPercent}%` }}
						title="Out point"
					>
						<div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-green-500 rotate-45" />
					</div>
				)}

				{/* Playhead */}
				<div
					className={clsx(
						"absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg",
						isMobile ? "w-3 h-3" : "w-4 h-4",
					)}
					style={{ left: `${currentPercent}%` }}
				/>
			</div>
		</div>
	);
}
