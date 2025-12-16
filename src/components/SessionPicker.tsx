import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useMobileDetection } from "../hooks/useMobileDetection";
import { SessionStorageService } from "../services/SessionStorageService";
import type { PracticeSession } from "../types/sessions";
import { SESSION_CONFIG } from "../types/sessions";
import { formatDuration } from "../utils/formatters";
import { selectThumbnailsForDisplay } from "../utils/thumbnailSelection";
import { SessionThumbnail } from "./SessionThumbnail";

// ===== Types =====

interface SessionPickerProps {
	isOpen: boolean;
	onClose: () => void;
	onSelectSession: (sessionId: string, startTime?: number) => void;
	recentSessions: PracticeSession[];
	savedSessions: PracticeSession[];
	currentRecordingThumbnail?: string;
	currentRecordingDuration?: number;
	isRecording?: boolean;
	onRefresh: () => void;
	activeSessionId?: string;
}

type PickerView = "list" | "timeline";

function formatTimeAgo(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return new Date(timestamp).toLocaleDateString();
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ===== Component =====

export function SessionPicker({
	isOpen,
	onClose,
	onSelectSession,
	recentSessions,
	savedSessions,
	currentRecordingThumbnail,
	currentRecordingDuration = 0,
	isRecording = false,
	onRefresh,
	activeSessionId,
}: SessionPickerProps) {
	const containerRef = useFocusTrap({ isOpen, onClose });

	const [view, setView] = useState<PickerView>("list");
	const [selectedSession, setSelectedSession] = useState<PracticeSession | null>(null);
	const [storageUsage, setStorageUsage] = useState({ used: 0, quota: 0 });
	const [previewSize, setPreviewSize] = useState(50); // 0-100 slider
	const [showPreviews, setShowPreviews] = useState(true);

	const { isMobile } = useMobileDetection();

	// Reset to list view and refresh sessions when picker opens
	useEffect(() => {
		if (isOpen) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional modal reset
			setView("list");
			setSelectedSession(null);
			// Refresh sessions to show latest recordings
			onRefresh();
		}
	}, [isOpen, onRefresh]);

	// Select thumbnails for display based on device and clip duration
	const displayThumbnails = useMemo(() => {
		if (!selectedSession) return [];
		return selectThumbnailsForDisplay(
			selectedSession.thumbnails,
			selectedSession.duration,
			isMobile,
		);
	}, [selectedSession, isMobile]);

	// Load storage usage
	useEffect(() => {
		if (isOpen) {
			SessionStorageService.getStorageUsage().then(setStorageUsage);
		}
	}, [isOpen, recentSessions, savedSessions]);

	// Handle session click (drill down to timeline)
	const handleSessionClick = useCallback((session: PracticeSession) => {
		setSelectedSession(session);
		setView("timeline");
	}, []);

	// Handle thumbnail click in timeline (select time and go to replay)
	const handleTimelineSelect = useCallback(
		(time: number) => {
			if (selectedSession) {
				onSelectSession(selectedSession.id, time);
			}
		},
		[selectedSession, onSelectSession],
	);

	// Handle back from timeline
	const handleBack = useCallback(() => {
		setSelectedSession(null);
		setView("list");
	}, []);


	// Handle close
	const handleClose = useCallback(() => {
		setView("list");
		setSelectedSession(null);
		onClose();
	}, [onClose]);

	// Handle delete session
	const handleDelete = useCallback(
		async (sessionId: string) => {
			try {
				await SessionStorageService.deleteSessionWithBlob(sessionId);
				onRefresh();
				if (selectedSession?.id === sessionId) {
					handleBack();
				}
			} catch (err) {
				console.error("Failed to delete session:", err);
			}
		},
		[selectedSession, onRefresh, handleBack],
	);

	if (!isOpen) return null;

	const isStorageWarning = storageUsage.used > SESSION_CONFIG.STORAGE_WARNING_BYTES;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
			<div ref={containerRef} className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] mx-4 overflow-hidden flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-gray-700">
					{view === "timeline" && selectedSession ? (
						<>
							<button
								onClick={handleBack}
								className="px-3 py-1 text-sm text-gray-300 hover:text-white flex items-center gap-2"
							>
								<span>←</span> Back
							</button>
							<h2 className="text-lg font-semibold text-white">
								{selectedSession.name || formatDuration(selectedSession.duration)}
							</h2>
						</>
					) : (
						<h2 className="text-lg font-semibold text-white">Sessions</h2>
					)}
					<button
						onClick={handleClose}
						className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
					aria-label="Close"
					>
						✕
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4">
					{view === "list" ? (
						<div className="space-y-6">
							{/* Current Recording */}
							{isRecording && currentRecordingThumbnail && (
								<div>
									<h3 className="text-sm font-medium text-gray-400 mb-3">
										Recording Now
									</h3>
									<div className="flex gap-4">
										<div
											className="relative cursor-default"
											title="Recording in progress"
										>
											<div className="w-32 h-20 rounded-lg overflow-hidden bg-gray-800 relative">
												<img
													src={currentRecordingThumbnail}
													alt="Current recording"
													className="w-full h-full object-cover"
												/>
												<div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
													<span className="w-1.5 h-1.5 bg-white rounded-full" />
													REC
												</div>
											</div>
											<p className="text-xs text-gray-400 mt-1 text-center">
												{formatDuration(currentRecordingDuration)}
											</p>
										</div>
									</div>
								</div>
							)}

							{/* Recent Sessions */}
							<div>
								<h3 className="text-sm font-medium text-gray-400 mb-3">
									Recent
								</h3>
								{recentSessions.length === 0 ? (
									<p className="text-gray-500 text-sm">
										No recent recordings
									</p>
								) : (
									<div className="flex flex-wrap gap-4">
										{recentSessions.map((session) => (
											<SessionThumbnail
												key={session.id}
												session={session}
												onClick={() => handleSessionClick(session)}
												onDelete={() => handleDelete(session.id)}
												timeLabel={formatTimeAgo(session.createdAt)}
												isActive={session.id === activeSessionId}
											/>
										))}
									</div>
								)}
							</div>

							{/* Saved Sessions */}
							<div>
								<h3 className="text-sm font-medium text-gray-400 mb-3">
									Saved
								</h3>
								{savedSessions.length === 0 ? (
									<p className="text-gray-500 text-sm">
										No saved clips yet
									</p>
								) : (
									<div className="flex flex-wrap gap-4">
										{savedSessions.map((session) => (
											<SessionThumbnail
												key={session.id}
												session={session}
												onClick={() => handleSessionClick(session)}
												onDelete={() => handleDelete(session.id)}
												showStar
												isActive={session.id === activeSessionId}
											/>
										))}
									</div>
								)}
							</div>

							{/* Storage Indicator */}
							<div className="pt-4 border-t border-gray-700">
								<div className="flex items-center justify-between text-sm">
									<span
										className={clsx(
											"text-gray-400",
											isStorageWarning && "text-yellow-500",
										)}
									>
										Storage: {formatBytes(storageUsage.used)} used
										{storageUsage.quota > 0 &&
											` of ${formatBytes(storageUsage.quota)}`}
									</span>
									<button
										onClick={async () => {
											if (
												confirm(
													"Clear all recent recordings? Saved clips will not be deleted.",
												)
											) {
												for (const session of recentSessions) {
													await SessionStorageService.deleteSessionWithBlob(
														session.id,
													);
												}
												onRefresh();
											}
										}}
										className="text-xs text-gray-500 hover:text-red-400"
									>
										Clear Recent
									</button>
								</div>
							</div>
						</div>
					) : (
						/* Timeline View */
						<div className="space-y-4">
							{selectedSession && (
								<>
									{/* Preview controls */}
									<div className="flex items-center justify-between gap-4">
										{/* Hide/Show toggle */}
										<button
											onClick={() => setShowPreviews(!showPreviews)}
											className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
										>
											<span
												className={clsx(
													"transition-transform duration-200",
													showPreviews ? "rotate-90" : "rotate-0",
												)}
											>
												▶
											</span>
											{displayThumbnails.length} previews
										</button>

										{/* Size slider */}
										{showPreviews && (
											<div className="flex items-center gap-2">
												<span className="text-xs text-gray-500">-</span>
												<input
													type="range"
													min="0"
													max="100"
													value={previewSize}
													onChange={(e) => setPreviewSize(Number(e.target.value))}
													className="w-24 h-1 accent-blue-500 cursor-pointer"
													title="Thumbnail size"
												/>
												<span className="text-xs text-gray-500">+</span>
											</div>
										)}
									</div>

									{/* Thumbnail grid - resizable via slider */}
									{showPreviews && (
										<div
											className="grid gap-2"
											style={{
												// Dynamic columns: slider 0=many small, 100=few large
												// Mobile: 1-4 columns, Desktop: 2-10 columns
												gridTemplateColumns: `repeat(${
													isMobile
														? Math.max(1, Math.round(4 - (previewSize / 100) * 3))
														: Math.max(2, Math.round(10 - (previewSize / 100) * 8))
												}, minmax(0, 1fr))`,
											}}
										>
											{displayThumbnails.map((thumb, index) => (
												<button
													key={index}
													onClick={() => handleTimelineSelect(thumb.time)}
													className="relative aspect-video rounded-lg overflow-hidden bg-gray-800 hover:ring-2 hover:ring-blue-500 transition-all group"
												>
													<img
														src={thumb.dataUrl}
														alt={`Frame at ${formatDuration(thumb.time)}`}
														className="w-full h-full object-cover"
													/>
													<div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
														{formatDuration(thumb.time)}
													</div>
													<div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
												</button>
											))}
										</div>
									)}

									{/* Actions */}
									<div className="flex justify-between items-center pt-4 border-t border-gray-700">
										<button
											onClick={() => onSelectSession(selectedSession.id, 0)}
											className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
										>
											Play from Start
										</button>
										{!selectedSession.saved && (
											<button
												onClick={async () => {
													const name = prompt("Name this clip:");
													if (name) {
														await SessionStorageService.markAsSaved(
															selectedSession.id,
															name,
														);
														await onRefresh();
														handleBack();
													}
												}}
												className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
											>
												<span>⭐</span> Save
											</button>
										)}
									</div>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
