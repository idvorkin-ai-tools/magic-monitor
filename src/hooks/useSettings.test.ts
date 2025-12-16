import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceService } from "../services/DeviceService";
import { useSettings } from "./useSettings";

// Mock DeviceService
vi.mock("../services/DeviceService", () => ({
	DeviceService: {
		getStorageItem: vi.fn(),
		setStorageItem: vi.fn(),
	},
}));

describe("useSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: return null for all storage items (fresh start)
		vi.mocked(DeviceService.getStorageItem).mockReturnValue(null);
	});

	describe("initialization", () => {
		it("should initialize with default values when no storage values exist", () => {
			const { result } = renderHook(() => useSettings());

			expect(result.current.settings).toEqual({
				flashEnabled: false,
				targetColor: null,
				threshold: 20,
				isSmartZoom: true, // Default on
				showHandSkeleton: false,
				smoothingPreset: "ema",
				isMirror: false,
			});
		});

		it("should load flash settings from localStorage", () => {
			vi.mocked(DeviceService.getStorageItem).mockImplementation((key) => {
				if (key === "magic-monitor-flash-enabled") return "true";
				if (key === "magic-monitor-flash-threshold") return "30";
				if (key === "magic-monitor-flash-target-color")
					return JSON.stringify({ r: 255, g: 0, b: 0 });
				return null;
			});

			const { result } = renderHook(() => useSettings());

			expect(result.current.settings.flashEnabled).toBe(true);
			expect(result.current.settings.threshold).toBe(30);
			expect(result.current.settings.targetColor).toEqual({
				r: 255,
				g: 0,
				b: 0,
			});
		});

		it("should load smart zoom settings from localStorage", () => {
			vi.mocked(DeviceService.getStorageItem).mockImplementation((key) => {
				if (key === "magic-monitor-smart-zoom") return "false";
				if (key === "magic-monitor-show-hand-skeleton") return "true";
				if (key === "magic-monitor-smoothing-preset") return "kalmanFast";
				return null;
			});

			const { result } = renderHook(() => useSettings());

			expect(result.current.settings.isSmartZoom).toBe(false);
			expect(result.current.settings.showHandSkeleton).toBe(true);
			expect(result.current.settings.smoothingPreset).toBe("kalmanFast");
		});

		it("should load mirror setting from localStorage", () => {
			vi.mocked(DeviceService.getStorageItem).mockImplementation((key) => {
				if (key === "magic-monitor-mirror") return "true";
				return null;
			});

			const { result } = renderHook(() => useSettings());

			expect(result.current.settings.isMirror).toBe(true);
		});

		it("should handle invalid JSON for targetColor gracefully", () => {
			vi.mocked(DeviceService.getStorageItem).mockImplementation((key) => {
				if (key === "magic-monitor-flash-target-color") return "invalid-json";
				return null;
			});

			const { result } = renderHook(() => useSettings());

			expect(result.current.settings.targetColor).toBeNull();
		});

		it("should handle invalid threshold gracefully", () => {
			vi.mocked(DeviceService.getStorageItem).mockImplementation((key) => {
				if (key === "magic-monitor-flash-threshold") return "not-a-number";
				return null;
			});

			const { result } = renderHook(() => useSettings());

			expect(result.current.settings.threshold).toBe(20); // Default
		});

		it("should handle invalid smoothing preset gracefully", () => {
			vi.mocked(DeviceService.getStorageItem).mockImplementation((key) => {
				if (key === "magic-monitor-smoothing-preset") return "invalid-preset";
				return null;
			});

			const { result } = renderHook(() => useSettings());

			expect(result.current.settings.smoothingPreset).toBe("ema"); // Default
		});
	});

	describe("setters", () => {
		it("should update flashEnabled and persist to localStorage", () => {
			const { result } = renderHook(() => useSettings());

			act(() => {
				result.current.setters.setFlashEnabled(true);
			});

			expect(result.current.settings.flashEnabled).toBe(true);
			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-flash-enabled",
				"true",
			);
		});

		it("should update threshold and persist to localStorage", () => {
			const { result } = renderHook(() => useSettings());

			act(() => {
				result.current.setters.setThreshold(50);
			});

			expect(result.current.settings.threshold).toBe(50);
			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-flash-threshold",
				"50",
			);
		});

		it("should update targetColor and persist to localStorage", () => {
			const { result } = renderHook(() => useSettings());
			const color = { r: 100, g: 150, b: 200 };

			act(() => {
				result.current.setters.setTargetColor(color);
			});

			expect(result.current.settings.targetColor).toEqual(color);
			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-flash-target-color",
				JSON.stringify(color),
			);
		});

		it("should clear targetColor when set to null", () => {
			const { result } = renderHook(() => useSettings());

			act(() => {
				result.current.setters.setTargetColor({ r: 100, g: 150, b: 200 });
			});

			act(() => {
				result.current.setters.setTargetColor(null);
			});

			expect(result.current.settings.targetColor).toBeNull();
			expect(DeviceService.setStorageItem).toHaveBeenLastCalledWith(
				"magic-monitor-flash-target-color",
				"",
			);
		});

		it("should update isSmartZoom and persist to localStorage", () => {
			const { result } = renderHook(() => useSettings());

			act(() => {
				result.current.setters.setIsSmartZoom(false);
			});

			expect(result.current.settings.isSmartZoom).toBe(false);
			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-smart-zoom",
				"false",
			);
		});

		it("should update showHandSkeleton and persist to localStorage", () => {
			const { result } = renderHook(() => useSettings());

			act(() => {
				result.current.setters.setShowHandSkeleton(true);
			});

			expect(result.current.settings.showHandSkeleton).toBe(true);
			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-show-hand-skeleton",
				"true",
			);
		});

		it("should update smoothingPreset and persist to localStorage", () => {
			const { result } = renderHook(() => useSettings());

			act(() => {
				result.current.setters.setSmoothingPreset("kalmanSmooth");
			});

			expect(result.current.settings.smoothingPreset).toBe("kalmanSmooth");
			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-smoothing-preset",
				"kalmanSmooth",
			);
		});

		it("should update isMirror and persist to localStorage", () => {
			const { result } = renderHook(() => useSettings());

			act(() => {
				result.current.setters.setIsMirror(true);
			});

			expect(result.current.settings.isMirror).toBe(true);
			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-mirror",
				"true",
			);
		});
	});

	describe("setter stability", () => {
		it("should have stable setter references across re-renders", () => {
			const { result, rerender } = renderHook(() => useSettings());

			const initialSetters = result.current.setters;
			rerender();
			const rerenderedSetters = result.current.setters;

			expect(initialSetters.setFlashEnabled).toBe(
				rerenderedSetters.setFlashEnabled,
			);
			expect(initialSetters.setTargetColor).toBe(
				rerenderedSetters.setTargetColor,
			);
			expect(initialSetters.setThreshold).toBe(rerenderedSetters.setThreshold);
			expect(initialSetters.setIsSmartZoom).toBe(
				rerenderedSetters.setIsSmartZoom,
			);
			expect(initialSetters.setShowHandSkeleton).toBe(
				rerenderedSetters.setShowHandSkeleton,
			);
			expect(initialSetters.setSmoothingPreset).toBe(
				rerenderedSetters.setSmoothingPreset,
			);
			expect(initialSetters.setIsMirror).toBe(rerenderedSetters.setIsMirror);
		});
	});
});
