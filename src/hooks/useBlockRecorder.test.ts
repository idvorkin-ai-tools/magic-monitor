import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordingSession } from "../services/MediaRecorderService";
import { useBlockRecorder } from "./useBlockRecorder";

// Mock MediaStream for jsdom with stream health properties
class MockMediaStream {
	active = true;
	getVideoTracks() {
		return [{ readyState: "live" }];
	}
	getAudioTracks() {
		return [];
	}
}
// @ts-expect-error - jsdom doesn't have MediaStream
globalThis.MediaStream = MockMediaStream;

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
		createPlaybackElement: vi.fn(),
		loadBlob: vi.fn(),
		revokeObjectUrl: vi.fn(),
	};
}

function createMockTimerService() {
	return {
		now: vi.fn().mockReturnValue(Date.now()),
		setTimeout: vi.fn(),
		setInterval: vi.fn(),
		clearTimeout: vi.fn(),
		clearInterval: vi.fn(),
		performanceNow: vi.fn(),
	};
}

function createMockStream() {
	const stream = new MediaStream();
	// Add clone method that returns a new stream with same tracks
	stream.clone = vi.fn(() => {
		const cloned = new MediaStream();
		// Mock getTracks for cleanup verification
		cloned.getTracks = vi.fn(() => [
			{ stop: vi.fn(), kind: "video" } as unknown as MediaStreamTrack,
		]);
		return cloned;
	});
	return stream;
}

function createMockVideoRef(hasStream = true) {
	return {
		current: {
			readyState: 4,
			srcObject: hasStream ? createMockStream() : null,
			videoWidth: 1920,
			videoHeight: 1080,
		} as unknown as HTMLVideoElement,
	};
}

describe("useBlockRecorder", () => {
	let mockRecorder: ReturnType<typeof createMockMediaRecorder>;
	let mockTimer: ReturnType<typeof createMockTimerService>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRecorder = createMockMediaRecorder();
		mockTimer = createMockTimerService();
	});

	it("starts not recording", () => {
		const videoRef = createMockVideoRef();
		const { result } = renderHook(() =>
			useBlockRecorder({
				videoRef,
				mediaRecorderService: mockRecorder,
				timerService: mockTimer,
			}),
		);

		expect(result.current.isRecording).toBe(false);
		expect(result.current.getState()).toBe("inactive");
	});

	it("starts recording when startRecording is called", () => {
		const videoRef = createMockVideoRef();
		const { result } = renderHook(() =>
			useBlockRecorder({
				videoRef,
				mediaRecorderService: mockRecorder,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startRecording();
		});

		expect(mockRecorder.startRecording).toHaveBeenCalled();
		expect(result.current.isRecording).toBe(true);
	});

	it("sets error when camera not available", () => {
		const videoRef = createMockVideoRef(false);
		const { result } = renderHook(() =>
			useBlockRecorder({
				videoRef,
				mediaRecorderService: mockRecorder,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startRecording();
		});

		expect(result.current.error).toBe("Camera not available");
		expect(result.current.isRecording).toBe(false);
	});

	it("handles MediaRecorder.start() failure", () => {
		const videoRef = createMockVideoRef();
		const mockSession = mockRecorder.startRecording(
			new MediaStream(),
			{},
		) as RecordingSession;
		(mockSession.start as ReturnType<typeof vi.fn>).mockImplementation(() => {
			throw new Error("MediaRecorder start failed");
		});

		const { result } = renderHook(() =>
			useBlockRecorder({
				videoRef,
				mediaRecorderService: mockRecorder,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startRecording();
		});

		expect(result.current.error).toBe("MediaRecorder start failed");
		expect(result.current.isRecording).toBe(false);
	});

	it("stops recording and returns result", async () => {
		const videoRef = createMockVideoRef();
		const { result } = renderHook(() =>
			useBlockRecorder({
				videoRef,
				mediaRecorderService: mockRecorder,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startRecording();
		});
		expect(result.current.isRecording).toBe(true);

		let stopResult: Awaited<ReturnType<typeof result.current.stopRecording>>;
		await act(async () => {
			stopResult = await result.current.stopRecording();
		});

		expect(result.current.isRecording).toBe(false);
		expect(stopResult!).not.toBeNull();
		expect(stopResult!.blob).toBeInstanceOf(Blob);
		expect(stopResult!.duration).toBe(5000);
	});

	it("returns null when stopping while not recording", async () => {
		const videoRef = createMockVideoRef();
		const { result } = renderHook(() =>
			useBlockRecorder({
				videoRef,
				mediaRecorderService: mockRecorder,
				timerService: mockTimer,
			}),
		);

		const stopResult = await result.current.stopRecording();

		expect(stopResult).toBeNull();
	});

	it("handles stop errors gracefully", async () => {
		const videoRef = createMockVideoRef();
		const mockSession = mockRecorder.startRecording(
			new MediaStream(),
			{},
		) as RecordingSession;
		(mockSession.stop as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("Stop failed"),
		);

		const { result } = renderHook(() =>
			useBlockRecorder({
				videoRef,
				mediaRecorderService: mockRecorder,
				timerService: mockTimer,
			}),
		);

		act(() => {
			result.current.startRecording();
		});

		let stopResult: Awaited<ReturnType<typeof result.current.stopRecording>>;
		await act(async () => {
			stopResult = await result.current.stopRecording();
		});

		expect(stopResult!).toBeNull();
		expect(result.current.isRecording).toBe(false);
		expect(result.current.error).toBe(
			"Recording may have been lost - please try again",
		);
	});
});
