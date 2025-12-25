// ===== Types =====

export interface PreviewSizeSliderProps {
	value: number;
	onChange: (value: number) => void;
	/** Width of the slider input */
	width?: string;
	/** Title/tooltip for the slider */
	title?: string;
	/** Additional handler for pointer down (e.g., to stop propagation in draggable panels) */
	onPointerDown?: (e: React.PointerEvent) => void;
}

// ===== Component =====

/**
 * Slider control for adjusting thumbnail preview size.
 * Shows - / + labels on either side of a range input.
 */
export function PreviewSizeSlider({
	value,
	onChange,
	width = "w-20",
	title = "Preview size",
	onPointerDown,
}: PreviewSizeSliderProps) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-xs text-gray-500">-</span>
			<input
				type="range"
				min="0"
				max="100"
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				onPointerDown={onPointerDown}
				className={`${width} h-1 accent-blue-500 cursor-pointer`}
				title={title}
			/>
			<span className="text-xs text-gray-500">+</span>
		</div>
	);
}
