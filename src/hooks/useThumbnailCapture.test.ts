import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThumbnailCaptureService } from "../services/ThumbnailCaptureService";
import { useThumbnailCapture } from "./useThumbnailCapture";

// Mock ThumbnailCaptureService
vi.mock("../services/ThumbnailCaptureService", () => ({
	ThumbnailCaptureService: {
		captureFromVideo: vi.fn().mockReturnValue("data:image/jpeg;base64,test"),
		captureAtTime: vi.fn(),
	},
}));

function createMockTimerService() {
	let intervalId = 0;
	return {
		now: vi.fn().mockReturnValue(Date.now()),
		setTimeout: vi.fn(),
		setInterval: vi.fn().mockImplementation(() => ++intervalId),
		clearTimeout: vi.fn(),
		clearInterval: vi.fn(),
		performanceNow: vi.fn(),
	};
}

function createMockVideoRef(ready = true) {
	return {
		current: {
			readyState: ready ? 4 : 0,
			videoWidth: 1920,
			videoHeight: 1080,
		} as unknown as HTMLVideoElement,
	};
}

describe("useThumbnailCapture", () => {
	let mockTimer: ReturnType<typeof createMockTimerService>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockTimer = createMockTimerService();
	});

	it("starts with empty thumbnails", () => {
		const videoRef = createMockVideoRef();
		const { result } = renderHook(() =>
			useThumbnailCapture({
				videoRef,
				timerService: mockTimer,
			}),
		);

		expect(result.current.thumbnails).toEqual([]);
	});

	it("captures thumbnail immediately on startCapture", () => {
		const videoRef = createMockVideoRef();
		mockTimer.now.mockReturnValue(1000);

		const { result } = renderHook(() =>
			useThumbnailCapture({
				videoRef,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startCapture(1000);
		});

		expect(result.current.thumbnails).toHaveLength(1);
		expect(result.current.thumbnails[0]).toMatchObject({
			time: 0,
			dataUrl: "data:image/jpeg;base64,test",
		});
	});

	it("sets up interval on startCapture", () => {
		const videoRef = createMockVideoRef();
		const { result } = renderHook(() =>
			useThumbnailCapture({
				videoRef,
				thumbnailIntervalMs: 3000,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startCapture(1000);
		});

		expect(mockTimer.setInterval).toHaveBeenCalledWith(
			expect.any(Function),
			3000,
		);
	});

	it("captures thumbnails at correct times", () => {
		const videoRef = createMockVideoRef();
		mockTimer.now
			.mockReturnValueOnce(1000) // startCapture (time=0)
			.mockReturnValueOnce(4000); // second capture (time=3)

		const { result } = renderHook(() =>
			useThumbnailCapture({
				videoRef,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startCapture(1000);
			result.current.captureNow(1000);
		});

		expect(result.current.thumbnails).toHaveLength(2);
		expect(result.current.thumbnails[0].time).toBe(0);
		expect(result.current.thumbnails[1].time).toBe(3);
	});

	it("does not capture when video not ready", () => {
		const videoRef = createMockVideoRef(false);
		const { result } = renderHook(() =>
			useThumbnailCapture({
				videoRef,
				timerService: mockTimer,
			}),
		);

		result.current.captureNow(1000);

		expect(result.current.thumbnails).toHaveLength(0);
		expect(ThumbnailCaptureService.captureFromVideo).not.toHaveBeenCalled();
	});

	it("handles capture errors gracefully", () => {
		const videoRef = createMockVideoRef();

		const { result } = renderHook(() =>
			useThumbnailCapture({
				videoRef,
				timerService: mockTimer,
			}),
		);

		// Start capture to enable isCapturingRef (so captureNow doesn't return early)
		act(() => {
			result.current.startCapture(1000);
		});

		// First thumbnail captured successfully
		expect(result.current.thumbnails).toHaveLength(1);

		// Now set up error for next capture
		(ThumbnailCaptureService.captureFromVideo as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
			throw new Error("Capture failed");
		});

		// Trigger another capture - should not throw
		act(() => {
			result.current.captureNow(mockTimer.now());
		});

		// Still only 1 thumbnail (error was caught, new one not added)
		expect(result.current.thumbnails).toHaveLength(1);
	});

	it("stops capture and returns thumbnails", () => {
		const videoRef = createMockVideoRef();
		mockTimer.now.mockReturnValue(1000); // Use consistent mock time

		const { result } = renderHook(() =>
			useThumbnailCapture({
				videoRef,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startCapture(1000);
		});
		let captured: ReturnType<typeof result.current.stopCapture> = [];
		act(() => {
			captured = result.current.stopCapture();
		});

		expect(mockTimer.clearInterval).toHaveBeenCalled();
		expect(captured).toHaveLength(1);
		expect(result.current.thumbnails).toEqual([]);
	});

	it("resets thumbnails on new startCapture", () => {
		const videoRef = createMockVideoRef();
		const { result } = renderHook(() =>
			useThumbnailCapture({
				videoRef,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startCapture(1000);
		});
		expect(result.current.thumbnails).toHaveLength(1);

		act(() => {
			result.current.startCapture(2000);
		});
		expect(result.current.thumbnails).toHaveLength(1); // Reset + immediate capture
	});
});
