import { useCallback, useEffect, useRef, useState } from "react";
import { useSmartZoom } from "../hooks/useSmartZoom";
import type { ReplayPlayerControls } from "../hooks/useReplayPlayer";
import type { SmoothingPreset } from "../smoothing";
import { Minimap } from "./Minimap";
import { ReplayControls } from "./ReplayControls";

// ===== Types =====

interface ReplayViewProps {
	player: ReplayPlayerControls;
	onExit: () => void;
	onSessionsClick?: () => void;
	isMobile?: boolean;
	videoTransform?: string;
	smoothingPreset?: SmoothingPreset;
}

// ===== Component =====

export function ReplayView({
	player,
	onExit,
	onSessionsClick,
	isMobile = false,
	videoTransform,
	smoothingPreset = "ema",
}: ReplayViewProps) {
	// Destructure player state to avoid eslint false positives about refs
	const {
		isLoading,
		isReady,
		error,
		videoRef: playerVideoRef,
		saveClip,
	} = player;

	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [clipName, setClipName] = useState("");
	const [isSmartZoom, setIsSmartZoom] = useState(false);
	const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);

	// Create a ref for smart zoom (since player uses callback ref)
	const videoRef = useRef<HTMLVideoElement | null>(null);

	// Callback ref that syncs both refs
	const handleVideoRef = useCallback(
		(element: HTMLVideoElement | null) => {
			videoRef.current = element;
			playerVideoRef(element);
		},
		[playerVideoRef],
	);

	// Update videoSrc for minimap when video is ready (blob URL is set)
	// Listen to loadeddata event to catch when src is actually loaded
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		const handleLoadedData = () => {
			if (video.src) {
				setVideoSrc(video.src);
			}
		};

		// Check if already loaded
		if (isReady && video.src) {
			setVideoSrc(video.src);
		} else if (!isReady) {
			setVideoSrc(undefined);
		}

		video.addEventListener("loadeddata", handleLoadedData);
		return () => video.removeEventListener("loadeddata", handleLoadedData);
	}, [isReady]);

	// Smart Zoom for replay video
	const smartZoom = useSmartZoom({
		videoRef,
		enabled: isSmartZoom,
		smoothingPreset,
	});

	// Compute effective transform: use smartZoom when enabled, else passed transform
	const effectiveTransform = isSmartZoom
		? `scale(${smartZoom.zoom}) translate(${(smartZoom.pan.x * 100).toFixed(2)}%, ${(smartZoom.pan.y * 100).toFixed(2)}%)`
		: videoTransform;

	// Handle save clip
	const handleSaveClip = useCallback(async () => {
		if (!clipName.trim()) return;
		await saveClip(clipName.trim());
		setShowSaveDialog(false);
		setClipName("");
	}, [saveClip, clipName]);

	return (
		<div className="absolute inset-0 flex flex-col">
			{/* Replay indicator */}
			<div className="absolute top-8 right-8 z-40 bg-blue-600/80 backdrop-blur text-white px-4 py-2 rounded-lg font-mono text-xl font-bold animate-pulse border border-blue-400">
				REPLAY MODE
			</div>

			{/* Loading overlay */}
			{isLoading && (
				<div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
					<div className="flex flex-col items-center gap-3">
						<div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
						<span className="text-white text-sm">Loading video...</span>
					</div>
				</div>
			)}

			{/* Error overlay */}
			{error && (
				<div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
					<div className="flex flex-col items-center gap-4 text-center px-4">
						<div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
							<span className="text-red-500 text-2xl">!</span>
						</div>
						<span className="text-white text-lg font-medium">
							{error}
						</span>
						<button
							onClick={onExit}
							className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
						>
							Go Back
						</button>
					</div>
				</div>
			)}

			{/* Minimap (zoom indicator) - only when smart zoom is active */}
			{isSmartZoom && (
				<Minimap
					videoSrc={videoSrc}
					zoom={smartZoom.zoom}
					pan={smartZoom.pan}
				/>
			)}

			{/* Video element (managed by player hook) */}
			<video
				ref={handleVideoRef}
				muted
				playsInline
				className="flex-1 w-full h-full object-contain"
				style={{
					transform: effectiveTransform,
				}}
			/>

			{/* Controls */}
			<ReplayControls
				player={player}
				onExit={onExit}
				onSaveClick={() => setShowSaveDialog(true)}
				onSessionsClick={onSessionsClick}
				isMobile={isMobile}
				isSmartZoom={isSmartZoom}
				onSmartZoomChange={setIsSmartZoom}
				isModelLoading={smartZoom.isModelLoading}
			/>

			{/* Save Dialog */}
			{showSaveDialog && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
					<div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4">
						<h3 className="text-lg font-semibold text-white mb-4">
							Save Clip
						</h3>
						<input
							type="text"
							value={clipName}
							onChange={(e) => setClipName(e.target.value)}
							placeholder="Name your clip..."
							className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSaveClip();
								if (e.key === "Escape") setShowSaveDialog(false);
							}}
						/>
						<div className="flex justify-end gap-3 mt-4">
							<button
								onClick={() => setShowSaveDialog(false)}
								className="px-4 py-2 text-gray-400 hover:text-white"
							>
								Cancel
							</button>
							<button
								onClick={handleSaveClip}
								disabled={!clipName.trim()}
								className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
