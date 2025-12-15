import clsx from "clsx";
import type { PracticeSession } from "../types/sessions";
import { formatDuration } from "../utils/formatters";

// ===== Types =====

interface SessionThumbnailProps {
	session: PracticeSession;
	onClick: () => void;
	onDelete?: () => void;
	timeLabel?: string;
	showStar?: boolean;
	isActive?: boolean;
}

// ===== Component =====

export function SessionThumbnail({
	session,
	onClick,
	onDelete,
	timeLabel,
	showStar = false,
	isActive = false,
}: SessionThumbnailProps) {
	return (
		<div
			className={clsx(
				"relative cursor-pointer group flex-shrink-0",
				isActive && "ring-2 ring-blue-500 rounded-lg",
			)}
			onClick={onClick}
			data-testid="session-thumbnail"
		>
			{/* Thumbnail image */}
			<div className="w-32 h-20 rounded-lg overflow-hidden bg-gray-800 relative">
				{session.thumbnail ? (
					<img
						src={session.thumbnail}
						alt={session.name || "Session thumbnail"}
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-gray-600">
						No preview
					</div>
				)}

				{/* Hover overlay */}
				<div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />

				{/* Duration badge */}
				<div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
					{formatDuration(session.duration)}
				</div>

				{/* Star badge for saved */}
				{showStar && session.saved && (
					<div className="absolute top-1 left-1 text-yellow-400 text-sm">⭐</div>
				)}

				{/* Delete button (on hover) */}
				{onDelete && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							if (confirm("Delete this recording?")) {
								onDelete();
							}
						}}
						className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
					>
						✕
					</button>
				)}
			</div>

			{/* Label */}
			<div className="mt-1">
				{session.name ? (
					<p className="text-xs text-white font-medium truncate max-w-32">
						{session.name}
					</p>
				) : timeLabel ? (
					<p className="text-xs text-gray-400">{timeLabel}</p>
				) : null}
			</div>
		</div>
	);
}
