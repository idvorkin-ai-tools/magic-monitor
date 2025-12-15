import clsx from "clsx";
import { useMemo, useState } from "react";
import { useMobileDetection } from "../hooks/useMobileDetection";
import type { ReplayPlayerControls } from "../hooks/useReplayPlayer";
import { selectThumbnailsForDisplay } from "../utils/thumbnailSelection";
import { Timeline } from "./Timeline";

// ===== Types =====

interface ReplayControlsProps {
	player: ReplayPlayerControls;
	onExit: () => void;
	onSaveClick: () => void;
	onSessionsClick?: () => void;
	isMobile?: boolean;
}

// ===== Helper =====

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const tenths = Math.floor((seconds % 1) * 10);
	return `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
}

// ===== Component =====

export function ReplayControls({
	player,
	onExit,
	onSaveClick,
	onSessionsClick,
	isMobile = false,
}: ReplayControlsProps) {
	const {
		isReady,
		isPlaying,
		currentTime,
		duration,
		inPoint,
		outPoint,
		hasTrimSelection,
		isExporting,
		exportProgress,
		play,
		pause,
		seek,
		stepFrame,
		setInPoint,
		setOutPoint,
		clearTrim,
		previewTrim,
		exportVideo,
	} = player;

	// Thumbnail display state
	const [showThumbnails, setShowThumbnails] = useState(true);
	const [thumbnailSize, setThumbnailSize] = useState(50); // 0-100 slider

	const { isMobile: detectedMobile } = useMobileDetection();
	const effectiveMobile = isMobile || detectedMobile;

	// Select thumbnails for display based on size slider and device
	const displayThumbnails = useMemo(() => {
		if (!showThumbnails || !player.session?.thumbnails) return undefined;
		return selectThumbnailsForDisplay(
			player.session.thumbnails,
			player.session.duration,
			effectiveMobile,
		);
	}, [showThumbnails, player.session, effectiveMobile]);

	return (
		<div
			className={clsx(
				"absolute left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center z-50 w-full max-w-4xl",
				isMobile ? "bottom-3 px-2" : "bottom-12 px-4",
			)}
		>
			{/* Main control bar */}
			<div
				className={clsx(
					"bg-gray-900/95 backdrop-blur-md flex flex-col w-full",
					isMobile ? "rounded-lg" : "rounded-2xl",
				)}
			>
				{/* Thumbnail controls */}
				{player.session?.thumbnails && player.session.thumbnails.length > 0 && (
					<div className="flex items-center justify-between px-4 pt-2">
						<button
							onClick={() => setShowThumbnails(!showThumbnails)}
							className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
						>
							<span
								className={clsx(
									"transition-transform duration-200",
									showThumbnails ? "rotate-90" : "rotate-0",
								)}
							>
								▶
							</span>
							Previews
						</button>
						{showThumbnails && (
							<div className="flex items-center gap-2">
								<span className="text-xs text-gray-500">-</span>
								<input
									type="range"
									min="0"
									max="100"
									value={thumbnailSize}
									onChange={(e) => setThumbnailSize(Number(e.target.value))}
									className="w-20 h-1 accent-blue-500 cursor-pointer"
								/>
								<span className="text-xs text-gray-500">+</span>
							</div>
						)}
					</div>
				)}

				{/* Timeline */}
				<div className={clsx("px-4", isMobile ? "py-2" : "py-3")}>
					<Timeline
						currentTime={currentTime}
						duration={duration}
						inPoint={inPoint}
						outPoint={outPoint}
						onSeek={seek}
						thumbnails={displayThumbnails}
						isMobile={isMobile}
						disabled={!isReady}
						thumbnailSize={thumbnailSize}
					/>
				</div>

				{/* Transport controls */}
				<div
					className={clsx(
						"flex items-center justify-between border-t border-gray-700",
						isMobile ? "px-2 py-1.5" : "px-4 py-2",
					)}
				>
					{/* Left: Exit, Sessions, and navigation */}
					<div className="flex items-center gap-2">
						<button
							onClick={onExit}
							className={clsx(
								"rounded font-bold bg-white/20 text-white hover:bg-white/30",
								isMobile ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
							)}
						>
							✕ Exit
						</button>

						{onSessionsClick && (
							<button
								onClick={onSessionsClick}
								className={clsx(
									"rounded font-bold bg-blue-600 text-white hover:bg-blue-500 flex items-center gap-1",
									isMobile ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
								)}
							>
								<span>📹</span> Sessions
							</button>
						)}

						<div className="h-6 w-px bg-gray-700" />

						{/* Frame step buttons */}
						<button
							onClick={() => stepFrame(-1)}
							disabled={!isReady}
							className={clsx(
								"rounded transition-colors",
								isMobile ? "p-1 text-sm" : "p-1.5 text-lg",
								isReady ? "hover:bg-white/10" : "opacity-50 cursor-not-allowed",
							)}
							title="Previous frame"
						>
							◀◀
						</button>

						{/* Play/Pause */}
						<button
							onClick={isPlaying ? pause : play}
							disabled={!isReady}
							className={clsx(
								"flex items-center justify-center rounded-full text-white transition-colors",
								isMobile ? "w-8 h-8 text-base" : "w-10 h-10 text-xl",
								isReady
									? "bg-blue-600 hover:bg-blue-500"
									: "bg-blue-600/50 cursor-not-allowed",
							)}
						>
							{isPlaying ? "⏸" : "▶"}
						</button>

						<button
							onClick={() => stepFrame(1)}
							disabled={!isReady}
							className={clsx(
								"rounded transition-colors",
								isMobile ? "p-1 text-sm" : "p-1.5 text-lg",
								isReady ? "hover:bg-white/10" : "opacity-50 cursor-not-allowed",
							)}
							title="Next frame"
						>
							▶▶
						</button>
					</div>

					{/* Center: Time display */}
					<div
						className={clsx(
							"font-mono text-white",
							isMobile ? "text-xs" : "text-sm",
						)}
					>
						{formatTime(currentTime)} / {formatTime(duration)}
					</div>

					{/* Right: Trim and export */}
					<div className="flex items-center gap-2">
						{/* Trim controls */}
						<button
							onClick={setInPoint}
							disabled={!isReady}
							className={clsx(
								"rounded font-medium transition-colors",
								!isReady
									? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
									: inPoint !== null
										? "bg-green-600 text-white"
										: "bg-gray-700 text-gray-300 hover:bg-gray-600",
								isMobile ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
							)}
							title="Set start point"
						>
							In
						</button>

						<button
							onClick={setOutPoint}
							disabled={!isReady}
							className={clsx(
								"rounded font-medium transition-colors",
								!isReady
									? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
									: outPoint !== null
										? "bg-green-600 text-white"
										: "bg-gray-700 text-gray-300 hover:bg-gray-600",
								isMobile ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
							)}
							title="Set end point"
						>
							Out
						</button>

						{hasTrimSelection && (
							<>
								<button
									onClick={previewTrim}
									className={clsx(
										"rounded font-medium bg-blue-600 text-white hover:bg-blue-500",
										isMobile ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
									)}
									title="Preview trimmed clip"
								>
									▶ Preview
								</button>

								<button
									onClick={clearTrim}
									className={clsx(
										"rounded text-gray-400 hover:text-white hover:bg-gray-700",
										isMobile ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
									)}
									title="Clear selection"
								>
									Clear
								</button>
							</>
						)}

						{!isMobile && <div className="h-6 w-px bg-gray-700" />}

						{/* Save and export */}
						{!isMobile && (
							<>
								<button
									onClick={onSaveClick}
									className="px-3 py-1 rounded font-medium bg-green-600 text-white hover:bg-green-500 text-sm flex items-center gap-1"
									title="Save to library"
								>
									<span>⭐</span> Save
								</button>

								<button
									onClick={exportVideo}
									disabled={isExporting}
									className={clsx(
										"px-3 py-1 rounded font-medium text-white text-sm",
										isExporting
											? "bg-yellow-600/80 cursor-wait"
											: "bg-purple-600 hover:bg-purple-500",
									)}
									title="Share or download"
								>
									{isExporting
										? `⏳ ${Math.round(exportProgress * 100)}%`
										: "📤 Share"}
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
