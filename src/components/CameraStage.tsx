import clsx from "clsx";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBugReporter } from "../hooks/useBugReporter";
import { useCamera } from "../hooks/useCamera";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { useFlashDetector } from "../hooks/useFlashDetector";
import { useMobileDetection } from "../hooks/useMobileDetection";
import { useReplayPlayer } from "../hooks/useReplayPlayer";
import { useSessionRecorder } from "../hooks/useSessionRecorder";
import { useShakeDetector } from "../hooks/useShakeDetector";
import { useSmartZoom } from "../hooks/useSmartZoom";
import { useVersionCheck } from "../hooks/useVersionCheck";
import { DeviceService } from "../services/DeviceService";
import type { SmoothingPreset } from "../smoothing";
import type { AppState } from "../types/sessions";
import { AboutModal } from "./AboutModal";
import { BugReportModal } from "./BugReportModal";
import { HandSkeleton } from "./HandSkeleton";
import { Minimap } from "./Minimap";
import { ReplayView } from "./ReplayView";
import { SessionPicker } from "./SessionPicker";
import { SettingsModal } from "./SettingsModal";
import { StatusButton } from "./StatusButton";

// Storage keys for persisted settings
const SMOOTHING_PRESET_STORAGE_KEY = "magic-monitor-smoothing-preset";
const SMART_ZOOM_STORAGE_KEY = "magic-monitor-smart-zoom";
const SHOW_HAND_SKELETON_STORAGE_KEY = "magic-monitor-show-hand-skeleton";
const FLASH_ENABLED_STORAGE_KEY = "magic-monitor-flash-enabled";
const FLASH_THRESHOLD_STORAGE_KEY = "magic-monitor-flash-threshold";
const FLASH_TARGET_COLOR_STORAGE_KEY = "magic-monitor-flash-target-color";
const MIRROR_STORAGE_KEY = "magic-monitor-mirror";

export function CameraStage() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Zoom/Pan State
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

	// Mobile Detection
	const { isMobile } = useMobileDetection();

	// App state: live (recording), picker (viewing sessions), replay (playing back)
	const [appState, setAppState] = useState<AppState>("live");

	// Recording pause state
	const [isRecordingPaused, setIsRecordingPaused] = useState(false);

	// Flash Detection State (persisted to localStorage)
	const [flashEnabled, setFlashEnabledInternal] = useState(() => {
		return DeviceService.getStorageItem(FLASH_ENABLED_STORAGE_KEY) === "true";
	});
	const [targetColor, setTargetColorInternal] = useState<{
		r: number;
		g: number;
		b: number;
	} | null>(() => {
		const stored = DeviceService.getStorageItem(FLASH_TARGET_COLOR_STORAGE_KEY);
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {
				return null;
			}
		}
		return null;
	});
	const [threshold, setThresholdInternal] = useState(() => {
		const stored = DeviceService.getStorageItem(FLASH_THRESHOLD_STORAGE_KEY);
		if (stored) {
			const parsed = Number.parseInt(stored, 10);
			if (!Number.isNaN(parsed)) return parsed;
		}
		return 20;
	});
	const [isPickingColor, setIsPickingColor] = useState(false);

	// Smart Zoom State (persisted to localStorage)
	const [isSmartZoom, setIsSmartZoomInternal] = useState(() => {
		const stored = DeviceService.getStorageItem(SMART_ZOOM_STORAGE_KEY);
		if (stored !== null) return stored === "true";
		return true; // Default on
	});
	const [showHandSkeleton, setShowHandSkeletonInternal] = useState(() => {
		return (
			DeviceService.getStorageItem(SHOW_HAND_SKELETON_STORAGE_KEY) === "true"
		);
	});
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isAboutOpen, setIsAboutOpen] = useState(false);

	// Mirror state (persisted to localStorage)
	const [isMirror, setIsMirrorInternal] = useState(() => {
		return DeviceService.getStorageItem(MIRROR_STORAGE_KEY) === "true";
	});

	// Smoothing preset state (persisted to localStorage)
	const [smoothingPreset, setSmoothingPresetInternal] =
		useState<SmoothingPreset>(() => {
			const stored = DeviceService.getStorageItem(SMOOTHING_PRESET_STORAGE_KEY);
			if (
				stored === "ema" ||
				stored === "kalmanFast" ||
				stored === "kalmanSmooth"
			) {
				return stored;
			}
			return "ema";
		});

	// Wrapped setters that persist to localStorage
	const setSmoothingPreset = useCallback((preset: SmoothingPreset) => {
		setSmoothingPresetInternal(preset);
		DeviceService.setStorageItem(SMOOTHING_PRESET_STORAGE_KEY, preset);
	}, []);

	const setIsSmartZoom = useCallback((value: boolean) => {
		setIsSmartZoomInternal(value);
		DeviceService.setStorageItem(SMART_ZOOM_STORAGE_KEY, String(value));
	}, []);

	const setShowHandSkeleton = useCallback((value: boolean) => {
		setShowHandSkeletonInternal(value);
		DeviceService.setStorageItem(SHOW_HAND_SKELETON_STORAGE_KEY, String(value));
	}, []);

	const setFlashEnabled = useCallback((value: boolean) => {
		setFlashEnabledInternal(value);
		DeviceService.setStorageItem(FLASH_ENABLED_STORAGE_KEY, String(value));
	}, []);

	const setThreshold = useCallback((value: number) => {
		setThresholdInternal(value);
		DeviceService.setStorageItem(FLASH_THRESHOLD_STORAGE_KEY, String(value));
	}, []);

	const setTargetColor = useCallback(
		(color: { r: number; g: number; b: number } | null) => {
			setTargetColorInternal(color);
			if (color) {
				DeviceService.setStorageItem(
					FLASH_TARGET_COLOR_STORAGE_KEY,
					JSON.stringify(color),
				);
			} else {
				DeviceService.setStorageItem(FLASH_TARGET_COLOR_STORAGE_KEY, "");
			}
		},
		[],
	);

	const setIsMirror = useCallback((value: boolean) => {
		setIsMirrorInternal(value);
		DeviceService.setStorageItem(MIRROR_STORAGE_KEY, String(value));
	}, []);

	// Helper to clamp NORMALIZED pan values (resolution-independent)
	// See docs/SMART_ZOOM_SPEC.md: maxPan = (1 - 1/zoom) / 2
	const clampPan = useCallback((p: { x: number; y: number }, z: number) => {
		const maxPan = (1 - 1 / z) / 2;
		return {
			x: Math.max(-maxPan, Math.min(maxPan, p.x)),
			y: Math.max(-maxPan, Math.min(maxPan, p.y)),
		};
	}, []);

	// Smart Zoom
	const smartZoom = useSmartZoom({
		videoRef,
		enabled: isSmartZoom,
		smoothingPreset,
	});

	// Compute effective zoom/pan: use smartZoom values when enabled, else local state
	const effectiveZoom = isSmartZoom ? smartZoom.zoom : zoom;
	const effectivePan = isSmartZoom ? smartZoom.pan : pan;

	// Helper to build video/canvas transform string
	// Combines mirror, zoom, and pan transforms
	const getVideoTransform = useCallback(() => {
		const mirrorTransform = isMirror ? "scaleX(-1) " : "";
		return `${mirrorTransform}scale(${effectiveZoom}) translate(${(effectivePan.x * 100).toFixed(2)}%, ${(effectivePan.y * 100).toFixed(2)}%)`;
	}, [isMirror, effectiveZoom, effectivePan]);

	// Session Recording (5-minute blocks with thumbnails)
	const sessionRecorder = useSessionRecorder({
		videoRef,
		enabled: appState === "live" && !isRecordingPaused,
	});

	// Replay Player
	const replayPlayer = useReplayPlayer();

	const isFlashing = useFlashDetector({
		videoRef,
		enabled: flashEnabled,
		targetColor,
		threshold,
	});

	// Camera State via Humble Object Hook
	const { stream, error, devices, selectedDeviceId, setSelectedDeviceId, retry } =
		useCamera();

	// Version check for updates
	const {
		updateAvailable,
		reload: reloadForUpdate,
		checkForUpdate,
		isChecking: isCheckingUpdate,
		lastCheckTime,
	} = useVersionCheck();

	// Bug Reporter
	const bugReporter = useBugReporter();

	// Shake detector for bug reporting
	const {
		isSupported: isShakeSupported,
		requestPermission: requestShakePermission,
	} = useShakeDetector({
		enabled: bugReporter.shakeEnabled,
		onShake: bugReporter.open,
	});

	// Detect platform for keyboard shortcut display
	const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
	const bugReportShortcut = isMac ? "⌘I" : "Ctrl+I";

	// Keyboard shortcut for bug reporting (Ctrl/Cmd + I)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "i") {
				e.preventDefault();
				bugReporter.open();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [bugReporter]);

	// Sync stream to video element
	useEffect(() => {
		if (videoRef.current) {
			videoRef.current.srcObject = stream;
		}
	}, [stream]);

	// App state transitions
	const handleOpenPicker = useCallback(() => {
		setAppState("picker");
	}, []);

	const handleClosePicker = useCallback(() => {
		// If we have an active session, return to replay; otherwise go to live
		if (replayPlayer.session) {
			setAppState("replay");
		} else {
			setAppState("live");
		}
	}, [replayPlayer.session]);

	const handleSelectSession = useCallback(
		async (sessionId: string, startTime?: number) => {
			await replayPlayer.loadSession(sessionId);
			if (startTime !== undefined) {
				replayPlayer.seek(startTime);
			}
			setAppState("replay");
		},
		[replayPlayer],
	);

	const handleExitReplay = useCallback(() => {
		replayPlayer.unloadSession();
		setAppState("live");
	}, [replayPlayer]);

	const handleSessionsFromReplay = useCallback(() => {
		// Go to picker without unloading the session (so it shows as active)
		setAppState("picker");
	}, []);

	// Escape key handler
	useEscapeKey({
		isSettingsOpen,
		isPickingColor,
		isReplaying: appState === "replay",
		onCloseSettings: () => setIsSettingsOpen(false),
		onCancelColorPick: () => setIsPickingColor(false),
		onExitReplay: handleExitReplay,
	});

	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault();
		// Manual zoom takes control from smart zoom
		if (isSmartZoom) setIsSmartZoom(false);
		const newZoom = Math.min(Math.max(zoom - e.deltaY * 0.001, 1), 5);
		setZoom(newZoom);

		// Re-clamp pan with new zoom level
		setPan((prev) => clampPan(prev, newZoom));
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		if (isPickingColor) {
			pickColor(e.clientX, e.clientY);
			return;
		}

		if (zoom > 1) {
			setIsDragging(true);
			setLastMousePos({ x: e.clientX, y: e.clientY });
		}
	};

	const pickColor = (x: number, y: number) => {
		if (!videoRef.current || !containerRef.current) return;

		const video = videoRef.current;
		const rect = video.getBoundingClientRect();

		const scaleX = video.videoWidth / rect.width;
		const scaleY = video.videoHeight / rect.height;

		const videoX = (x - rect.left) * scaleX;
		const videoY = (y - rect.top) * scaleY;

		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.drawImage(video, 0, 0);
		const pixel = ctx.getImageData(videoX, videoY, 1, 1).data;

		setTargetColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
		setIsPickingColor(false);
		setFlashEnabled(true);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging && zoom > 1 && !isPickingColor) {
			const dx = e.clientX - lastMousePos.x;
			const dy = e.clientY - lastMousePos.y;

			// Convert pixel delta to normalized coordinates
			// Use video element's rendered size for accurate conversion
			const videoRect = videoRef.current?.getBoundingClientRect();
			const renderedWidth = videoRect?.width || 1;
			const renderedHeight = videoRect?.height || 1;

			// Normalized delta: pixel movement / (rendered size * zoom)
			// The zoom factor accounts for scale(zoom) in CSS transform
			const normalizedDx = dx / (renderedWidth * zoom);
			const normalizedDy = dy / (renderedHeight * zoom);

			const proposedPan = {
				x: pan.x + normalizedDx,
				y: pan.y + normalizedDy,
			};

			setPan(clampPan(proposedPan, zoom));
			setLastMousePos({ x: e.clientX, y: e.clientY });
		}
	};

	const handleMouseUp = () => {
		setIsDragging(false);
	};

	const handlePanTo = (target: { x: number; y: number }) => {
		setPan(clampPan(target, zoom));
	};

	return (
		<div
			ref={containerRef}
			className={`relative w-full h-full bg-black overflow-hidden flex items-center justify-center ${isPickingColor ? "cursor-crosshair" : "cursor-move"}`}
			onWheel={handleWheel}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
		>
			{/* Flash Warning Overlay */}
			<div
				className={`absolute inset-0 border-[20px] border-red-600 z-40 pointer-events-none transition-opacity duration-100 ${isFlashing ? "opacity-100" : "opacity-0"}`}
			/>

			{/* Pan Boundary Debug Overlay (see docs/SMART_ZOOM_SPEC.md) */}
			{isSmartZoom && (
				<>
					<div
						className={`absolute left-0 top-0 bottom-0 w-2 bg-red-500 z-40 pointer-events-none transition-opacity duration-150 ${smartZoom.clampedEdges.left ? "opacity-100" : "opacity-0"}`}
					/>
					<div
						className={`absolute right-0 top-0 bottom-0 w-2 bg-red-500 z-40 pointer-events-none transition-opacity duration-150 ${smartZoom.clampedEdges.right ? "opacity-100" : "opacity-0"}`}
					/>
					<div
						className={`absolute top-0 left-0 right-0 h-2 bg-red-500 z-40 pointer-events-none transition-opacity duration-150 ${smartZoom.clampedEdges.top ? "opacity-100" : "opacity-0"}`}
					/>
					<div
						className={`absolute bottom-0 left-0 right-0 h-2 bg-red-500 z-40 pointer-events-none transition-opacity duration-150 ${smartZoom.clampedEdges.bottom ? "opacity-100" : "opacity-0"}`}
					/>
				</>
			)}

			{/* Bug Report Modal */}
			<BugReportModal
				isOpen={bugReporter.isOpen}
				onClose={bugReporter.close}
				onOpen={bugReporter.open}
				onSubmit={bugReporter.submit}
				isSubmitting={bugReporter.isSubmitting}
				defaultData={bugReporter.getDefaultData()}
				shakeEnabled={bugReporter.shakeEnabled}
				onShakeEnabledChange={bugReporter.setShakeEnabled}
				isShakeSupported={isShakeSupported}
				onRequestShakePermission={requestShakePermission}
				isFirstTime={bugReporter.isFirstTime}
				onFirstTimeShown={bugReporter.markFirstTimeShown}
				shortcut={bugReportShortcut}
			/>

			<SettingsModal
				isOpen={isSettingsOpen}
				onClose={() => setIsSettingsOpen(false)}
				devices={devices}
				selectedDeviceId={selectedDeviceId}
				onDeviceChange={setSelectedDeviceId}
				isMirror={isMirror}
				onMirrorChange={setIsMirror}
				isSmartZoom={isSmartZoom}
				isModelLoading={smartZoom.isModelLoading}
				onSmartZoomChange={setIsSmartZoom}
				smoothingPreset={smoothingPreset}
				onSmoothingPresetChange={setSmoothingPreset}
				showHandSkeleton={showHandSkeleton}
				onShowHandSkeletonChange={setShowHandSkeleton}
				flashEnabled={flashEnabled}
				onFlashEnabledChange={setFlashEnabled}
				threshold={threshold}
				onThresholdChange={setThreshold}
				isPickingColor={isPickingColor}
				onPickColorClick={() => setIsPickingColor(true)}
				targetColor={targetColor}
				updateAvailable={updateAvailable}
				isCheckingUpdate={isCheckingUpdate}
				lastCheckTime={lastCheckTime}
				onCheckForUpdate={checkForUpdate}
				onReloadForUpdate={reloadForUpdate}
				shakeEnabled={bugReporter.shakeEnabled}
				onShakeEnabledChange={bugReporter.setShakeEnabled}
				isShakeSupported={isShakeSupported}
				onOpenAbout={() => setIsAboutOpen(true)}
			/>

			<AboutModal
				isOpen={isAboutOpen}
				onClose={() => setIsAboutOpen(false)}
				githubRepoUrl={bugReporter.githubRepoUrl}
				onReportBug={bugReporter.open}
				bugReportShortcut={bugReportShortcut}
			/>

			{/* Session Picker Modal */}
			<SessionPicker
				isOpen={appState === "picker"}
				onClose={handleClosePicker}
				onSelectSession={handleSelectSession}
				recentSessions={sessionRecorder.recentSessions}
				savedSessions={sessionRecorder.savedSessions}
				currentRecordingThumbnail={sessionRecorder.currentThumbnails[0]?.dataUrl}
				currentRecordingDuration={sessionRecorder.currentBlockDuration}
				isRecording={sessionRecorder.isRecording}
				onRefresh={sessionRecorder.refreshSessions}
				activeSessionId={replayPlayer.session?.id}
			/>

			{/* Minimap (Only when zoomed) */}
			<Minimap
				stream={stream}
				zoom={effectiveZoom}
				pan={effectivePan}
				frame={null}
				onPanTo={handlePanTo}
			/>

			{/* Status Bar */}
			<div className="absolute bottom-8 right-8 z-40 text-white/50 font-mono text-xs pointer-events-none flex flex-col items-end gap-1">
				{smartZoom.isModelLoading && (
					<span className="text-blue-400 animate-pulse">
						Loading AI model...
					</span>
				)}
				{sessionRecorder.error ? (
					<span className="text-red-400">{sessionRecorder.error}</span>
				) : appState === "live" ? (
					<span>
						{isRecordingPaused ? (
							<span className="text-yellow-400 mr-2">⏸ PAUSED</span>
						) : sessionRecorder.isRecording ? (
							<span className="text-red-400 mr-2">● REC</span>
						) : null}
						{Math.floor(sessionRecorder.currentBlockDuration)}s |{" "}
						{sessionRecorder.recentSessions.length + sessionRecorder.savedSessions.length} sessions
					</span>
				) : null}
			</div>

			{error && (
				<div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80">
					<div className="flex flex-col items-center gap-4 max-w-md mx-4 text-center">
						<p className="text-xl font-bold text-red-500">{error}</p>
						<button
							onClick={retry}
							className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-lg transition-colors"
						>
							Try Again
						</button>
						<p className="text-white/60 text-sm">
							If camera access was denied, you may need to enable it in your browser settings:
						</p>
						<ul className="text-white/50 text-xs text-left list-disc pl-4 space-y-1">
							<li><strong>iOS Safari:</strong> Settings → Safari → Camera → Allow</li>
							<li><strong>Chrome/Edge:</strong> Click the lock icon in the address bar → Camera → Allow</li>
							<li><strong>Firefox:</strong> Click the lock icon → Connection secure → More information → Permissions</li>
						</ul>
					</div>
				</div>
			)}

			{/* Live Video */}
			<video
				data-testid="main-video"
				ref={videoRef}
				autoPlay
				playsInline
				muted
				className={`max-w-full max-h-full object-contain transition-transform duration-75 ease-out ${appState === "replay" ? "hidden" : "block"}`}
				style={{
					// See docs/SMART_ZOOM_SPEC.md for transform details
					transform: getVideoTransform(),
				}}
			/>

			{/* Hand Skeleton Debug Overlay */}
			{showHandSkeleton && isSmartZoom && appState === "live" && (
				<HandSkeleton
					landmarks={smartZoom.debugLandmarks}
					videoRef={videoRef}
					isMirror={isMirror}
				/>
			)}

			{/* Replay View */}
			{appState === "replay" && (
				<ReplayView
					player={replayPlayer}
					onExit={handleExitReplay}
					onSessionsClick={handleSessionsFromReplay}
					isMobile={isMobile}
					videoTransform={getVideoTransform()}
				/>
			)}

			{/* Controls Overlay (shown only in live mode) */}
			{appState === "live" && (
				<div
					className={`absolute left-1/2 -translate-x-1/2 flex flex-col gap-4 items-center z-50 w-full max-w-4xl ${isMobile ? "bottom-3 px-0" : "bottom-12 px-4"}`}
				>
					<div className="bg-black/50 backdrop-blur-md p-3 rounded-2xl flex items-center gap-3">
						{/* Sessions Button */}
						<button
							onClick={handleOpenPicker}
							className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 flex items-center gap-1.5"
						>
							<span>📹</span> Sessions
						</button>

						{/* Pause/Resume Recording Button */}
						<button
							onClick={() => setIsRecordingPaused(!isRecordingPaused)}
							className={clsx(
								"px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5",
								isRecordingPaused
									? "bg-yellow-600 text-white hover:bg-yellow-500"
									: "bg-gray-700 text-white hover:bg-gray-600",
							)}
							title={isRecordingPaused ? "Resume recording" : "Pause recording"}
						>
							{isRecordingPaused ? (
								<>
									<span>▶</span> Resume
								</>
							) : (
								<>
									<span>⏸</span> Pause
								</>
							)}
						</button>

						<div className="h-6 w-px bg-white/20" />

						{/* Status Toggles */}
						<StatusButton
							onClick={() => setIsSmartZoom(!isSmartZoom)}
							disabled={smartZoom.isModelLoading}
							active={isSmartZoom && !smartZoom.isModelLoading}
							color="green"
							title="Smart Zoom - Auto-follow movement"
						>
							{smartZoom.isModelLoading
								? "Loading..."
								: isSmartZoom
									? "Smart ✓"
									: "Smart"}
						</StatusButton>

						<StatusButton
							onClick={() => setFlashEnabled(!flashEnabled)}
							active={flashEnabled}
							color="red"
							title="Flash Detection"
						>
							{flashEnabled ? "⚡ ARMED" : "⚡ Flash"}
						</StatusButton>

						{/* Zoom Controls - hidden on mobile (no mouse wheel) */}
						{!isMobile && (
							<>
								<div className="h-6 w-px bg-white/20" />
								<button
									onClick={() => {
										// Manual reset takes control from smart zoom
										if (isSmartZoom) setIsSmartZoom(false);
										setZoom(1);
										setPan({ x: 0, y: 0 });
									}}
									className="text-white font-bold px-3 py-1 rounded hover:bg-white/20 text-sm"
								>
									Reset
								</button>
								<input
									type="range"
									min="1"
									max="5"
									step="0.1"
									value={effectiveZoom}
									onChange={(e) => {
										const newZoom = Number.parseFloat(e.target.value);
										// Manual zoom takes control from smart zoom
										if (isSmartZoom) setIsSmartZoom(false);
										setZoom(newZoom);
										setPan((prev) => clampPan(prev, newZoom));
									}}
									className="w-32 accent-blue-500"
								/>
								<span className="text-white font-mono w-12 text-right">
									{effectiveZoom.toFixed(1)}x
								</span>
								<div className="h-6 w-px bg-white/20" />
							</>
						)}

						{/* Settings */}
						<button
							onClick={() => setIsSettingsOpen(true)}
							className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
							title="Settings"
						>
							<Settings size={18} />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
