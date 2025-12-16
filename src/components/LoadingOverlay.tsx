import clsx from "clsx";

// ===== Types =====

export interface LoadingOverlayProps {
	/** Message to display below spinner */
	message?: string;
	/** Additional CSS classes for the container */
	className?: string;
	/** Z-index for positioning (default: 30) */
	zIndex?: number;
	/** Test ID for testing */
	testId?: string;
}

// ===== Component =====

/**
 * Full-screen loading overlay with spinner and optional message.
 * Used during async operations like video loading.
 */
export function LoadingOverlay({
	message = "Loading...",
	className,
	zIndex = 30,
	testId = "loading-overlay",
}: LoadingOverlayProps) {
	return (
		<div
			className={clsx(
				"absolute inset-0 flex items-center justify-center bg-black/60",
				className,
			)}
			style={{ zIndex }}
			data-testid={testId}
			role="status"
			aria-live="polite"
		>
			<div className="flex flex-col items-center gap-3">
				<div
					className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
					aria-hidden="true"
				/>
				<span className="text-white text-sm">{message}</span>
			</div>
		</div>
	);
}
