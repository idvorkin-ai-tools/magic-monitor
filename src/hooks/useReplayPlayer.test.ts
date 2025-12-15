import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeSession } from "../types/sessions";
import { useReplayPlayer } from "./useReplayPlayer";

// Create mock services
function createMockSessionStorage() {
	const mockSession: PracticeSession = {
		id: "test-session-id",
		createdAt: Date.now(),
		duration: 60,
		blobKey: "test-blob-key",
		thumbnail: "data:image/jpeg;base64,test",
		thumbnails: [],
		saved: false,
	};

	return {
		getSession: vi.fn().mockResolvedValue(mockSession),
		getBlob: vi
			.fn()
			.mockResolvedValue(new Blob(["test"], { type: "video/webm" })),
		markAsSaved: vi.fn().mockResolvedValue(undefined),
		setTrimPoints: vi.fn().mockResolvedValue(undefined),
		init: vi.fn(),
		saveSession: vi.fn(),
		saveBlob: vi.fn(),
		pruneOldSessions: vi.fn(),
		getRecentSessions: vi.fn(),
		getSavedSessions: vi.fn(),
		getAllSessions: vi.fn(),
		updateSession: vi.fn(),
		deleteSession: vi.fn(),
		deleteBlob: vi.fn(),
		deleteSessionWithBlob: vi.fn(),
		getStorageUsage: vi.fn(),
		clear: vi.fn(),
		close: vi.fn(),
	};
}

function createMockShareService() {
	return {
		canShare: vi.fn().mockReturnValue(true),
		canShareFiles: vi.fn().mockReturnValue(true),
		share: vi.fn().mockResolvedValue(true),
		download: vi.fn(),
		generateFilename: vi.fn().mockReturnValue("practice-clip-2024-01-01.webm"),
	};
}

describe("useReplayPlayer", () => {
	let mockStorage: ReturnType<typeof createMockSessionStorage>;
	let mockShare: ReturnType<typeof createMockShareService>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockStorage = createMockSessionStorage();
		mockShare = createMockShareService();

		// Mock URL.createObjectURL and revokeObjectURL
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn().mockReturnValue("blob:test"),
			revokeObjectURL: vi.fn(),
		});
	});

	describe("initial state", () => {
		it("starts with no session loaded", () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			expect(result.current.session).toBeNull();
			expect(result.current.isPlaying).toBe(false);
			expect(result.current.currentTime).toBe(0);
			expect(result.current.duration).toBe(0);
		});

		it("starts with no trim points", () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			expect(result.current.inPoint).toBeNull();
			expect(result.current.outPoint).toBeNull();
			expect(result.current.hasTrimSelection).toBe(false);
		});

		it("provides video ref", () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			expect(result.current.videoRef).toBeDefined();
		});
	});

	describe("loadSession", () => {
		it("loads session from storage", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-session-id");
			});

			expect(mockStorage.getSession).toHaveBeenCalledWith("test-session-id");
			expect(mockStorage.getBlob).toHaveBeenCalledWith("test-session-id");
			expect(result.current.session).not.toBeNull();
		});

		it("restores trim points from session", async () => {
			mockStorage.getSession.mockResolvedValue({
				id: "test-id",
				createdAt: Date.now(),
				duration: 60,
				blobKey: "blob",
				thumbnail: "data:test",
				thumbnails: [],
				saved: true,
				trimIn: 5,
				trimOut: 55,
			});

			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-id");
			});

			expect(result.current.inPoint).toBe(5);
			expect(result.current.outPoint).toBe(55);
		});

		it("handles missing session gracefully", async () => {
			mockStorage.getSession.mockResolvedValue(null);

			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("non-existent");
			});

			expect(result.current.session).toBeNull();
		});
	});

	describe("unloadSession", () => {
		it("clears session state", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-id");
			});

			expect(result.current.session).not.toBeNull();

			act(() => {
				result.current.unloadSession();
			});

			expect(result.current.session).toBeNull();
			expect(result.current.isPlaying).toBe(false);
			expect(result.current.currentTime).toBe(0);
		});

		it("clears trim points", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-id");
			});

			act(() => {
				result.current.unloadSession();
			});

			expect(result.current.inPoint).toBeNull();
			expect(result.current.outPoint).toBeNull();
		});
	});

	describe("trim controls", () => {
		it("clearTrim resets trim points", () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			act(() => {
				result.current.clearTrim();
			});

			expect(result.current.inPoint).toBeNull();
			expect(result.current.outPoint).toBeNull();
		});
	});

	describe("saveClip", () => {
		it("marks session as saved with name", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-id");
			});

			await act(async () => {
				await result.current.saveClip("My Practice");
			});

			expect(mockStorage.markAsSaved).toHaveBeenCalledWith(
				"test-session-id",
				"My Practice",
			);
		});

		it("returns null when no session loaded", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			let savedSession: PracticeSession | null = null;
			await act(async () => {
				savedSession = await result.current.saveClip("Test");
			});

			expect(savedSession).toBeNull();
		});
	});

	describe("video element handling", () => {
		it("timeout should check actual video element state, not stale closure", async () => {
			// Bug: timeout callback captured stale isReady value (always false at timeout creation)
			// Fix: check videoElement.readyState instead of captured isReady
			vi.useFakeTimers();

			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
					loadTimeoutMs: 1000,
				}),
			);

			// Create mock video element BEFORE loading
			const mockVideo = document.createElement("video");
			Object.defineProperty(mockVideo, "readyState", {
				value: 0, // HAVE_NOTHING (starts not loaded)
				writable: true,
			});
			Object.defineProperty(mockVideo, "duration", {
				value: 60,
				writable: true,
			});

			// Mount video element FIRST
			act(() => {
				result.current.videoRef(mockVideo);
			});

			// Now load session - this creates the timeout with isReady=false captured
			await act(async () => {
				await result.current.loadSession("test-id");
			});

			// Video starts loading immediately (readyState advances)
			Object.defineProperty(mockVideo, "readyState", {
				value: 1, // HAVE_METADATA
				writable: true,
			});

			// Trigger loadedmetadata event to set isReady=true
			act(() => {
				mockVideo.dispatchEvent(new Event("loadedmetadata"));
			});

			// At this point, isReady should be true and video has metadata
			expect(result.current.isReady).toBe(true);

			// Fast-forward past timeout
			// With the bug: timeout sees stale isReady=false (captured at creation) and sets error
			// With the fix: timeout checks videoElement.readyState >= 1 and doesn't error
			await act(async () => {
				vi.advanceTimersByTime(1000);
			});

			// Should NOT have timeout error because video actually loaded successfully
			expect(result.current.error).toBeNull();

			vi.useRealTimers();
		});

		it("stores pending seek when video not ready", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-id");
			});

			// Seek when video ref is null (video not mounted yet)
			// This should store the seek position for later
			act(() => {
				result.current.seek(10);
			});

			// The seek should be stored for when video becomes available
			// (We can't directly test the ref, but the behavior is captured)
			expect(result.current.currentTime).toBe(0); // Not updated because video is null
		});

		it("creates blob URL when loading session", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-id");
			});

			// URL.createObjectURL should have been called with the blob
			expect(URL.createObjectURL).toHaveBeenCalled();
		});

		it("revokes previous blob URL when loading new session", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			// Load first session
			await act(async () => {
				await result.current.loadSession("session-1");
			});

			// Load second session - should revoke first URL
			await act(async () => {
				await result.current.loadSession("session-2");
			});

			expect(URL.revokeObjectURL).toHaveBeenCalled();
		});

		it("handles loadSession when video element is not mounted", async () => {
			// This tests the scenario where loadSession is called before ReplayView renders
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			// At this point, videoRef.current is null (no video element mounted)
			// loadSession should still work and store the blob URL for later
			await act(async () => {
				await result.current.loadSession("test-id");
			});

			// Session should be loaded
			expect(result.current.session).not.toBeNull();
			// Blob URL should have been created
			expect(URL.createObjectURL).toHaveBeenCalled();
		});
	});

	describe("exportVideo", () => {
		it("calls share service with generated filename", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-id");
			});

			await act(async () => {
				await result.current.exportVideo();
			});

			expect(mockShare.generateFilename).toHaveBeenCalled();
			expect(mockShare.share).toHaveBeenCalled();
		});

		it("sets export progress during export", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.loadSession("test-id");
			});

			// Create a promise that resolves after export completes
			await act(async () => {
				await result.current.exportVideo();
			});

			// After export completes, progress should be reset
			expect(result.current.isExporting).toBe(false);
			expect(result.current.exportProgress).toBe(0);
		});

		it("does nothing when no session loaded", async () => {
			const { result } = renderHook(() =>
				useReplayPlayer({
					sessionStorageService: mockStorage,
					shareService: mockShare,
				}),
			);

			await act(async () => {
				await result.current.exportVideo();
			});

			expect(mockShare.share).not.toHaveBeenCalled();
		});
	});
});
