import clsx from "clsx";

// ===== Types =====

export interface ErrorOverlayProps {
	/** Error message to display */
	message: string;
	/** Primary action button (e.g., "Go Back", "Try Again") */
	onAction?: () => void;
	/** Label for the action button */
	actionLabel?: string;
	/** Additional help text or instructions */
	helpText?: string;
	/** List of troubleshooting tips */
	tips?: string[];
	/** Additional CSS classes for the container */
	className?: string;
	/** Z-index for positioning (default: 30) */
	zIndex?: number;
	/** Test ID for testing */
	testId?: string;
}

// ===== Component =====

/**
 * Full-screen error overlay with message, action button, and optional tips.
 * Used when an operation fails and requires user attention.
 */
export function ErrorOverlay({
	message,
	onAction,
	actionLabel = "Go Back",
	helpText,
	tips,
	className,
	zIndex = 30,
	testId = "error-overlay",
}: ErrorOverlayProps) {
	return (
		<div
			className={clsx(
				"absolute inset-0 flex items-center justify-center bg-black/80",
				className,
			)}
			style={{ zIndex }}
			data-testid={testId}
			role="alert"
		>
			<div className="flex flex-col items-center gap-4 text-center px-4 max-w-md mx-4">
				{/* Error icon */}
				<div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
					<span className="text-red-500 text-2xl" aria-hidden="true">!</span>
				</div>

				{/* Error message */}
				<span className="text-white text-lg font-medium">{message}</span>

				{/* Action button */}
				{onAction && (
					<button
						onClick={onAction}
						className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
					>
						{actionLabel}
					</button>
				)}

				{/* Help text */}
				{helpText && (
					<p className="text-white/60 text-sm">{helpText}</p>
				)}

				{/* Troubleshooting tips */}
				{tips && tips.length > 0 && (
					<ul className="text-white/50 text-xs text-left list-disc pl-4 space-y-1">
						{tips.map((tip, index) => (
							<li key={index} dangerouslySetInnerHTML={{ __html: tip }} />
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
