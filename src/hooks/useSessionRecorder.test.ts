import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
		extractPreviewFrame: vi.fn().mockResolvedValue("data:image/jpeg;base64,test"),
		createPlaybackElement: vi.fn().mockReturnValue(document.createElement("video")),
		loadBlob: vi.fn().mockReturnValue("blob:test"),
		revokeObjectUrl: vi.fn(),
	};
}

function createMockVideoFix() {
	return {
		fixDuration: vi.fn().mockImplementation((blob) => Promise.resolve(blob)),
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
		mockStorage = createMockSessionStorage();
		mockRecorder = createMockMediaRecorder();
		mockVideoFix = createMockVideoFix();
		mockTimer = createMockTimerService();
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
		// TODO: These tests have timing issues with async effects in jsdom.
		// The recording effect runs async callbacks that don't complete within waitFor timeout.
		// Need to investigate using fake timers or restructuring the tests.
		it.skip("stops recording and returns session", async () => {
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
		});

		it.skip("clears timers when stopping", async () => {
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

			expect(mockTimer.clearInterval).toHaveBeenCalled();
		});
	});

	describe("refreshSessions", () => {
		// TODO: Timing issue with async init effect
		it.skip("refreshes recent and saved sessions from storage", async () => {
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

			// Initial load
			await waitFor(() => {
				expect(mockStorage.getRecentSessions).toHaveBeenCalledTimes(1);
			});

			// Refresh
			await act(async () => {
				await result.current.refreshSessions();
			});

			expect(mockStorage.getRecentSessions).toHaveBeenCalledTimes(2);
			expect(mockStorage.getSavedSessions).toHaveBeenCalledTimes(2);
		});
	});

	describe("error handling", () => {
		// TODO: Timing issue with async recording effect
		it.skip("sets error when camera not available", async () => {
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

			// Wait for timeout check
			await waitFor(() => {
				expect(mockTimer.setInterval).toHaveBeenCalled();
			});
		});
	});
});
