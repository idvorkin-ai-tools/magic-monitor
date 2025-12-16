import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBlockRotation } from "./useBlockRotation";

function createMockTimerService() {
	let timerId = 0;
	return {
		now: vi.fn(),
		setTimeout: vi.fn().mockImplementation(() => ++timerId),
		setInterval: vi.fn(),
		clearTimeout: vi.fn(),
		clearInterval: vi.fn(),
		performanceNow: vi.fn(),
	};
}

describe("useBlockRotation", () => {
	let mockTimer: ReturnType<typeof createMockTimerService>;
	let onBlockComplete: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockTimer = createMockTimerService();
		onBlockComplete = vi.fn();
	});

	it("sets up rotation timer on startRotation", () => {
		const { result } = renderHook(() =>
			useBlockRotation({
				blockDurationMs: 5000,
				onBlockComplete,
				timerService: mockTimer,
			}),
		);

		result.current.startRotation();

		expect(mockTimer.setTimeout).toHaveBeenCalledWith(
			expect.any(Function),
			5000,
		);
	});

	it("calls onBlockComplete when timer fires", () => {
		const { result } = renderHook(() =>
			useBlockRotation({
				blockDurationMs: 5000,
				onBlockComplete,
				timerService: mockTimer,
			}),
		);

		result.current.startRotation();

		// Get the callback that was passed to setTimeout
		const callback = (mockTimer.setTimeout as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		callback();

		expect(onBlockComplete).toHaveBeenCalled();
	});

	it("clears timer on stopRotation", () => {
		const { result } = renderHook(() =>
			useBlockRotation({
				blockDurationMs: 5000,
				onBlockComplete,
				timerService: mockTimer,
			}),
		);

		result.current.startRotation();
		const timerId = (mockTimer.setTimeout as ReturnType<typeof vi.fn>).mock
			.results[0].value;

		result.current.stopRotation();

		expect(mockTimer.clearTimeout).toHaveBeenCalledWith(timerId);
	});

	it("clears existing timer when starting new rotation", () => {
		const { result } = renderHook(() =>
			useBlockRotation({
				blockDurationMs: 5000,
				onBlockComplete,
				timerService: mockTimer,
			}),
		);

		result.current.startRotation();
		const firstTimerId = (mockTimer.setTimeout as ReturnType<typeof vi.fn>).mock
			.results[0].value;

		result.current.startRotation();

		expect(mockTimer.clearTimeout).toHaveBeenCalledWith(firstTimerId);
		expect(mockTimer.setTimeout).toHaveBeenCalledTimes(2);
	});

	it("handles stopRotation when not running", () => {
		const { result } = renderHook(() =>
			useBlockRotation({
				blockDurationMs: 5000,
				onBlockComplete,
				timerService: mockTimer,
			}),
		);

		// Should not throw
		result.current.stopRotation();

		expect(mockTimer.clearTimeout).not.toHaveBeenCalled();
	});

	it("uses default block duration", () => {
		const { result } = renderHook(() =>
			useBlockRotation({
				onBlockComplete,
				timerService: mockTimer,
			}),
		);

		result.current.startRotation();

		expect(mockTimer.setTimeout).toHaveBeenCalledWith(
			expect.any(Function),
			5 * 60 * 1000, // SESSION_CONFIG.BLOCK_DURATION_MS
		);
	});
});
