import { useCallback, useState } from "react";
import { DeviceService } from "../services/DeviceService";
import type { SmoothingPreset } from "../smoothing";

// Storage keys for persisted settings
const SMOOTHING_PRESET_STORAGE_KEY = "magic-monitor-smoothing-preset";
const SMART_ZOOM_STORAGE_KEY = "magic-monitor-smart-zoom";
const SHOW_HAND_SKELETON_STORAGE_KEY = "magic-monitor-show-hand-skeleton";
const FLASH_ENABLED_STORAGE_KEY = "magic-monitor-flash-enabled";
const FLASH_THRESHOLD_STORAGE_KEY = "magic-monitor-flash-threshold";
const FLASH_TARGET_COLOR_STORAGE_KEY = "magic-monitor-flash-target-color";
const MIRROR_STORAGE_KEY = "magic-monitor-mirror";

export interface Settings {
	// Flash Detection
	flashEnabled: boolean;
	targetColor: { r: number; g: number; b: number } | null;
	threshold: number;

	// Smart Zoom
	isSmartZoom: boolean;
	showHandSkeleton: boolean;
	smoothingPreset: SmoothingPreset;

	// Mirror
	isMirror: boolean;
}

export interface SettingsSetters {
	setFlashEnabled: (value: boolean) => void;
	setTargetColor: (color: { r: number; g: number; b: number } | null) => void;
	setThreshold: (value: number) => void;
	setIsSmartZoom: (value: boolean) => void;
	setShowHandSkeleton: (value: boolean) => void;
	setSmoothingPreset: (preset: SmoothingPreset) => void;
	setIsMirror: (value: boolean) => void;
}

export interface UseSettingsReturn {
	settings: Settings;
	setters: SettingsSetters;
}

/**
 * Hook for managing all localStorage-persisted settings.
 * Centralizes settings state and persistence logic that was previously in CameraStage.
 */
export function useSettings(): UseSettingsReturn {
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

	// Mirror state (persisted to localStorage)
	const [isMirror, setIsMirrorInternal] = useState(() => {
		return DeviceService.getStorageItem(MIRROR_STORAGE_KEY) === "true";
	});

	// Wrapped setters that persist to localStorage
	const setFlashEnabled = useCallback((value: boolean) => {
		setFlashEnabledInternal(value);
		DeviceService.setStorageItem(FLASH_ENABLED_STORAGE_KEY, String(value));
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

	const setThreshold = useCallback((value: number) => {
		setThresholdInternal(value);
		DeviceService.setStorageItem(FLASH_THRESHOLD_STORAGE_KEY, String(value));
	}, []);

	const setIsSmartZoom = useCallback((value: boolean) => {
		setIsSmartZoomInternal(value);
		DeviceService.setStorageItem(SMART_ZOOM_STORAGE_KEY, String(value));
	}, []);

	const setShowHandSkeleton = useCallback((value: boolean) => {
		setShowHandSkeletonInternal(value);
		DeviceService.setStorageItem(SHOW_HAND_SKELETON_STORAGE_KEY, String(value));
	}, []);

	const setSmoothingPreset = useCallback((preset: SmoothingPreset) => {
		setSmoothingPresetInternal(preset);
		DeviceService.setStorageItem(SMOOTHING_PRESET_STORAGE_KEY, preset);
	}, []);

	const setIsMirror = useCallback((value: boolean) => {
		setIsMirrorInternal(value);
		DeviceService.setStorageItem(MIRROR_STORAGE_KEY, String(value));
	}, []);

	return {
		settings: {
			flashEnabled,
			targetColor,
			threshold,
			isSmartZoom,
			showHandSkeleton,
			smoothingPreset,
			isMirror,
		},
		setters: {
			setFlashEnabled,
			setTargetColor,
			setThreshold,
			setIsSmartZoom,
			setShowHandSkeleton,
			setSmoothingPreset,
			setIsMirror,
		},
	};
}
