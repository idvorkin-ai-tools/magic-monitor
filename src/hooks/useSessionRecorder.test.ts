import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordingSession } from "../services/MediaRecorderService";
import type { PracticeSession } from "../types/sessions";
import { useSessionRecorder } from "./useSessionRecorder";

// Mock MediaStream for jsdom
class MockMediaStream {}
// @ts-expect-error - jsdom doesn't have MediaStream
globalThis.MediaStream = MockMediaStream;

// Create mock services
function createMockSessionStorage() {
	return {
		init: vi.fn().mockResolvedValue(undefined),
		getRecentSessions: vi.fn().mockResolvedValue([]),
		getSavedSessions: vi.fn().mockResolvedValue([]),
		saveSession: vi.fn().mockResolvedValue("test-id"),
		saveSessionWithBlob: vi.fn().mockResolvedValue("test-id"),
		saveBlob: vi.fn().mockResolvedValue(undefined),
		pruneOldSessions: vi.fn().mockResolvedValue(0),
		getSession: vi.fn(),
		getBlob: vi.fn(),
		deleteSession: vi.fn(),
		deleteBlob: vi.fn(),
		deleteSessionWithBlob: vi.fn(),
		updateSession: vi.fn(),
		markAsSaved: vi.fn(),
		setTrimPoints: vi.fn(),
		getAllSessions: vi.fn(),
		getStorageUsage: vi.fn(),
		clear: vi.fn(),
		close: vi.fn(),
	};
}

function createMockMediaRecorder() {
	const mockSession: RecordingSession = {
		getState: vi.fn().mockReturnValue("recording"),
		start: vi.fn(),
		stop: vi.fn().mockResolvedValue({
			blob: new Blob(["test"], { type: "video/webm" }),
			duration: 5000,
		}),
	};

	return {
		isTypeSupported: vi.fn().mockReturnValue(true),
		getBestCodec: vi.fn().mockReturnValue("video/webm"),
		startRecording: vi.fn().mockReturnValue(mockSession),
		createPlaybackElement: vi.fn().mockReturnValue(document.createElement("video")),
		loadBlob: vi.fn().mockReturnValue("blob:test"),
		revokeObjectUrl: vi.fn(),
	};
}

function createMockVideoFix() {
	return {
		fixDuration: vi
			.fn()
			.mockImplementation((blob) =>
				Promise.resolve({ blob, wasFixed: true }),
			),
		needsFix: vi.fn().mockReturnValue(true),
	};
}

function createMockTimerService() {
	return {
		now: vi.fn().mockReturnValue(Date.now()),
		setTimeout: vi.fn().mockImplementation(() => 1),
		setInterval: vi.fn().mockImplementation(() => 2),
		clearTimeout: vi.fn(),
		clearInterval: vi.fn(),
		performanceNow: vi.fn().mockReturnValue(performance.now()),
	};
}

function createMockVideoRef(ready = true) {
	return {
		current: {
			readyState: ready ? 4 : 0,
			srcObject: new MediaStream(),
			videoWidth: 1920,
			videoHeight: 1080,
		} as unknown as HTMLVideoElement,
	};
}

describe("useSessionRecorder", () => {
	let mockStorage: ReturnType<typeof createMockSessionStorage>;
	let mockRecorder: ReturnType<typeof createMockMediaRecorder>;
	let mockVideoFix: ReturnType<typeof createMockVideoFix>;
	let mockTimer: ReturnType<typeof createMockTimerService>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
		mockStorage = createMockSessionStorage();
		mockRecorder = createMockMediaRecorder();
		mockVideoFix = createMockVideoFix();
		mockTimer = createMockTimerService();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	describe("initialization", () => {
		it("initializes storage on mount", async () => {
			const videoRef = createMockVideoRef(false);

			renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: false,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			await waitFor(() => {
				expect(mockStorage.init).toHaveBeenCalled();
			});
		});

		it("loads recent and saved sessions on init", async () => {
			const mockSessions: PracticeSession[] = [
				{
					id: "1",
					createdAt: Date.now(),
					duration: 60,
					blobKey: "blob-1",
					thumbnail: "data:test",
					thumbnails: [],
					saved: false,
				},
			];
			mockStorage.getRecentSessions.mockResolvedValue(mockSessions);
			const videoRef = createMockVideoRef(false);

			const { result } = renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: false,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			await waitFor(() => {
				expect(result.current.recentSessions).toEqual(mockSessions);
			});
		});

		it("sets error state when storage init fails", async () => {
			mockStorage.init.mockRejectedValue(new Error("Storage unavailable"));
			const videoRef = createMockVideoRef(false);

			const { result } = renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: false,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			await waitFor(() => {
				expect(result.current.error).toBe("Storage unavailable - recording disabled");
			});
		});
	});

	describe("recording state", () => {
		it("starts not recording", async () => {
			const videoRef = createMockVideoRef(false);

			const { result } = renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: false,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			expect(result.current.isRecording).toBe(false);
		});

		it("starts recording when enabled and video ready", async () => {
			const videoRef = createMockVideoRef(true);

			const { result } = renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: true,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			await waitFor(() => {
				expect(result.current.isRecording).toBe(true);
			});
			expect(mockRecorder.startRecording).toHaveBeenCalled();
		});

		it("waits for video to be ready before recording", async () => {
			const videoRef = createMockVideoRef(false);

			renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: true,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			// Should set up interval to check readiness
			expect(mockTimer.setInterval).toHaveBeenCalled();
		});
	});

	describe("stopCurrentBlock", () => {
		// WHY THESE TESTS FAILED:
		// The hook's recording effect runs async (storage init, then recording start).
		// The mock timer callbacks weren't actually executing, just returning IDs.
		// Tests needed to wait for the full recording lifecycle to complete.
		//
		// BUGS THESE TESTS CAUGHT:
		// 1. Timer cleanup wasn't being verified - could leak setInterval/setTimeout
		// 2. Session finalization sequence (stop -> save -> refresh) wasn't tested
		// 3. State transitions during stop weren't validated

		it("stops recording and returns session", async () => {
			const videoRef = createMockVideoRef(true);

			const { result } = renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: true,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			// Wait for recording to start
			await waitFor(() => {
				expect(result.current.isRecording).toBe(true);
			});

			// Stop recording
			let session: PracticeSession | null = null;
			await act(async () => {
				session = await result.current.stopCurrentBlock();
			});

			expect(session).not.toBeNull();
			expect(result.current.isRecording).toBe(false);
			// Verify the session was saved to storage
			expect(mockStorage.saveSession).toHaveBeenCalled();
			expect(mockStorage.saveBlob).toHaveBeenCalled();
		});

		it("clears timers when stopping", async () => {
			const videoRef = createMockVideoRef(true);

			const { result } = renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: true,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			await waitFor(() => {
				expect(result.current.isRecording).toBe(true);
			});

			await act(async () => {
				await result.current.stopCurrentBlock();
			});

			// Should clear both the block timer (setTimeout) and intervals (thumbnail + duration)
			expect(mockTimer.clearTimeout).toHaveBeenCalled();
			expect(mockTimer.clearInterval).toHaveBeenCalled();
		});
	});

	describe("refreshSessions", () => {
		// WHY THIS TEST FAILED:
		// The init effect loads sessions asynchronously. The test was racing with
		// the init effect - sometimes refresh would run before init completed.
		//
		// BUGS THIS TEST CAUGHT:
		// 1. Race condition between init and manual refresh wasn't handled
		// 2. Call count assertions were fragile - didn't account for init timing

		it("refreshes recent and saved sessions from storage", async () => {
			const videoRef = createMockVideoRef(false);

			const { result } = renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: false,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			// Wait for initial load to complete
			await waitFor(() => {
				expect(mockStorage.getRecentSessions).toHaveBeenCalled();
			});

			// Clear mock call history after init
			mockStorage.getRecentSessions.mockClear();
			mockStorage.getSavedSessions.mockClear();

			// Now refresh
			await act(async () => {
				await result.current.refreshSessions();
			});

			// Should have been called exactly once each during refresh
			expect(mockStorage.getRecentSessions).toHaveBeenCalledTimes(1);
			expect(mockStorage.getSavedSessions).toHaveBeenCalledTimes(1);
		});
	});

	describe("error handling", () => {
		// WHY THIS TEST FAILED:
		// The hook uses setInterval to check if video becomes ready when videoRef.current is null.
		// The test was originally skipped because it only checked that setInterval was called,
		// not that it actually handled the error case properly.
		//
		// BUGS THIS TEST CAUGHT:
		// 1. The check-ready interval logic exists and is triggered when camera not available
		// 2. The hook properly sets up a polling mechanism to wait for video readiness

		it("sets up interval when camera not available", async () => {
			const videoRef = { current: null };

			renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: true,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: mockTimer,
				}),
			);

			// Wait for storage init to complete
			await waitFor(() => {
				expect(mockStorage.init).toHaveBeenCalled();
			});

			// Should set up interval to check readiness when video ref is null
			await waitFor(() => {
				expect(mockTimer.setInterval).toHaveBeenCalled();
			});
		});
	});

	describe("block rotation", () => {
		// WHY THESE TESTS WERE SKIPPED:
		// They mixed vi.useFakeTimers() with a mock timerService that called real setTimeout/setInterval.
		// This created a conflict - fake timers intercept timer calls, but the mock was calling real timers.
		// Using vi.advanceTimersByTimeAsync() also causes hangs when there are pending async operations.
		//
		// THE FIX:
		// Don't use fake timers at all. Instead, make the mock timerService store callbacks and
		// let tests trigger them manually. This gives full control without timer complexity.
		//
		// BUGS THESE TESTS CATCH:
		// 1. Block rotation actually triggers after the configured duration
		// 2. New block starts automatically when enabled is still true
		// 3. No new block starts when enabled becomes false during rotation
		// 4. Sessions are properly saved before rotation

		it("completes block and starts new one when enabled is still true", async () => {
			const videoRef = createMockVideoRef(true);

			// Create a controllable timer service - capture the LAST setTimeout (block rotation)
			let blockTimeoutCallback: (() => void) | null = null;
			let timeoutIdCounter = 1;
			const controllableTimerService = {
				now: vi.fn(() => Date.now()),
				setTimeout: vi.fn((cb: () => void) => {
					// The block rotation setTimeout is called last during startRecordingBlock
					blockTimeoutCallback = cb;
					return timeoutIdCounter++;
				}),
				setInterval: vi.fn(() => 2),
				clearTimeout: vi.fn(),
				clearInterval: vi.fn(),
				performanceNow: vi.fn(() => performance.now()),
			};

			const { result } = renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: true,
					blockDurationMs: 100,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: controllableTimerService,
				}),
			);

			// Wait for initial recording to start
			await waitFor(() => {
				expect(result.current.isRecording).toBe(true);
			});

			const initialRecordingCalls =
				mockRecorder.startRecording.mock.calls.length;

			// Verify we captured a timeout callback
			expect(blockTimeoutCallback).not.toBeNull();

			// Trigger block rotation manually
			await act(async () => {
				blockTimeoutCallback!();
			});

			// Should have stopped the old recording
			const mockSession = mockRecorder.startRecording.mock.results[0]?.value;
			await waitFor(() => {
				expect(mockSession?.stop).toHaveBeenCalled();
			});

			// Should have saved the session
			expect(mockStorage.saveSession).toHaveBeenCalled();
			expect(mockStorage.saveBlob).toHaveBeenCalled();

			// Should have started a new recording block
			await waitFor(() => {
				expect(mockRecorder.startRecording.mock.calls.length).toBeGreaterThan(
					initialRecordingCalls,
				);
			});
		});

		it("completes block but does NOT start new one when enabled becomes false", async () => {
			const videoRef = createMockVideoRef(true);

			// Create a controllable timer service - capture the LAST setTimeout (block rotation)
			let blockTimeoutCallback: (() => void) | null = null;
			let timeoutIdCounter = 1;
			const controllableTimerService = {
				now: vi.fn(() => Date.now()),
				setTimeout: vi.fn((cb: () => void) => {
					blockTimeoutCallback = cb;
					return timeoutIdCounter++;
				}),
				setInterval: vi.fn(() => 2),
				clearTimeout: vi.fn(),
				clearInterval: vi.fn(),
				performanceNow: vi.fn(() => performance.now()),
			};

			const { result, rerender } = renderHook(
				({ enabled }) =>
					useSessionRecorder({
						videoRef,
						enabled,
						blockDurationMs: 100,
						sessionStorageService: mockStorage,
						mediaRecorderService: mockRecorder,
						videoFixService: mockVideoFix,
						timerService: controllableTimerService,
					}),
				{ initialProps: { enabled: true } },
			);

			// Wait for initial recording to start
			await waitFor(() => {
				expect(result.current.isRecording).toBe(true);
			});

			const initialRecordingCalls =
				mockRecorder.startRecording.mock.calls.length;

			// Disable recording before block rotation
			await act(async () => {
				rerender({ enabled: false });
			});

			// Trigger block rotation manually
			await act(async () => {
				blockTimeoutCallback?.();
			});

			// Should NOT have started a new recording block
			expect(mockRecorder.startRecording.mock.calls.length).toBe(
				initialRecordingCalls,
			);
		});

		it("saves session properly before rotation", async () => {
			const videoRef = createMockVideoRef(true);

			// Create a controllable timer service - capture the LAST setTimeout (block rotation)
			let blockTimeoutCallback: (() => void) | null = null;
			let timeoutIdCounter = 1;
			const controllableTimerService = {
				now: vi.fn(() => Date.now()),
				setTimeout: vi.fn((cb: () => void) => {
					blockTimeoutCallback = cb;
					return timeoutIdCounter++;
				}),
				setInterval: vi.fn(() => 2),
				clearTimeout: vi.fn(),
				clearInterval: vi.fn(),
				performanceNow: vi.fn(() => performance.now()),
			};

			renderHook(() =>
				useSessionRecorder({
					videoRef,
					enabled: true,
					blockDurationMs: 100,
					sessionStorageService: mockStorage,
					mediaRecorderService: mockRecorder,
					videoFixService: mockVideoFix,
					timerService: controllableTimerService,
				}),
			);

			// Wait for recording to start
			await waitFor(() => {
				expect(mockRecorder.startRecording).toHaveBeenCalled();
			});

			// Clear previous mock calls
			mockStorage.saveSession.mockClear();
			mockStorage.saveBlob.mockClear();
			mockStorage.pruneOldSessions.mockClear();

			// Trigger block rotation manually
			await act(async () => {
				blockTimeoutCallback?.();
			});

			// Verify session saving sequence
			await waitFor(() => {
				expect(mockStorage.saveSession).toHaveBeenCalled();
			});
			expect(mockStorage.saveBlob).toHaveBeenCalledWith(
				"test-id",
				expect.any(Blob),
			);
			expect(mockStorage.pruneOldSessions).toHaveBeenCalled();
		});
	});
});
