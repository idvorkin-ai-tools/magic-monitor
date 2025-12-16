import { useEffect, useRef } from "react";

interface MinimapProps {
	stream?: MediaStream | null;
	videoSrc?: string; // For blob URLs in replay mode
	zoom: number;
	pan: { x: number; y: number };
	frame?: ImageBitmap | null;
	onPanTo?: (targetPan: { x: number; y: number }) => void;
	isMirror?: boolean;
	/** Reference to main video for syncing playback time in replay mode */
	mainVideoRef?: React.RefObject<HTMLVideoElement | null>;
}

export function Minimap({ stream, videoSrc, zoom, pan, frame, onPanTo, isMirror = false, mainVideoRef }: MinimapProps) {
	const miniVideoRef = useRef<HTMLVideoElement>(null);
	const miniCanvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Track if we're visible (zoom > 1) to re-run effect when video mounts
	const isVisible = zoom > 1;

	// Sync the mini video with the main video stream or blob URL
	useEffect(() => {
		const miniVideo = miniVideoRef.current;
		if (!frame && miniVideo) {
			if (stream) {
				miniVideo.srcObject = stream;
				// Ensure video plays
				miniVideo.play().catch(() => {
					// Autoplay blocked - that's okay, video will still show frames
				});
			} else if (videoSrc) {
				miniVideo.src = videoSrc;
				miniVideo.load();
			}
		}
	}, [stream, videoSrc, frame, isVisible]); // Re-run when becoming visible

	// Sync minimap video time with main video in replay mode
	useEffect(() => {
		const miniVideo = miniVideoRef.current;
		const mainVideo = mainVideoRef?.current;
		if (!miniVideo || !mainVideo || !videoSrc) return;

		const syncTime = () => {
			if (Math.abs(miniVideo.currentTime - mainVideo.currentTime) > 0.5) {
				miniVideo.currentTime = mainVideo.currentTime;
			}
		};

		// Sync on seek and periodically
		mainVideo.addEventListener("seeked", syncTime);
		mainVideo.addEventListener("timeupdate", syncTime);

		// Initial sync
		syncTime();

		return () => {
			mainVideo.removeEventListener("seeked", syncTime);
			mainVideo.removeEventListener("timeupdate", syncTime);
		};
	}, [videoSrc, mainVideoRef, isVisible]); // Re-run when becoming visible

	// Render frame if provided
	useEffect(() => {
		if (frame && miniCanvasRef.current) {
			const ctx = miniCanvasRef.current.getContext("2d");
			if (ctx) {
				miniCanvasRef.current.width = frame.width;
				miniCanvasRef.current.height = frame.height;
				ctx.drawImage(frame, 0, 0);
			}
		}
	}, [frame]);

	if (zoom <= 1) return null;

	// Calculate overlay size
	const widthPercent = 100 / zoom;
	const heightPercent = 100 / zoom;

	// Calculate position as percentage
	// Pan is NORMALIZED (0-1 range), so multiply by 100 for percentage
	const leftPercent = 50 - pan.x * 100 - widthPercent / 2;
	const topPercent = 50 - pan.y * 100 - heightPercent / 2;

	const handleClick = (e: React.MouseEvent) => {
		if (!onPanTo || !containerRef.current) return;

		const rect = containerRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		// Normalized position (0 to 1)
		const u = x / rect.width;
		const v = y / rect.height;

		// Calculate target pan in NORMALIZED coordinates
		// If u = 0.5 (center), targetPan = 0
		// If u = 0 (left edge), targetPan = 0.5 (shift view left to show left edge)
		const targetPanX = 0.5 - u;
		const targetPanY = 0.5 - v;

		onPanTo({ x: targetPanX, y: targetPanY });
	};

	return (
		<div
			ref={containerRef}
			onClick={handleClick}
			className="absolute top-16 right-4 z-50 w-48 aspect-video bg-black/80 border-2 border-white/20 rounded-lg overflow-hidden shadow-lg cursor-pointer"
		>
			{frame ? (
				<canvas
					ref={miniCanvasRef}
					className="w-full h-full object-contain opacity-50 pointer-events-none"
				/>
			) : (
				<video
					ref={miniVideoRef}
					autoPlay
					playsInline
					muted
					className="w-full h-full object-contain opacity-50 pointer-events-none"
					style={{ transform: isMirror ? "scaleX(-1)" : undefined }}
				/>
			)}

			{/* Viewport Rectangle */}
			<div
				className="absolute border-2 border-yellow-400 bg-yellow-400/20 shadow-[0_0_10px_rgba(250,204,21,0.5)] pointer-events-none transition-all duration-75"
				style={{
					width: `${widthPercent}%`,
					height: `${heightPercent}%`,
					left: `${leftPercent}%`,
					top: `${topPercent}%`,
				}}
			/>
		</div>
	);
}
