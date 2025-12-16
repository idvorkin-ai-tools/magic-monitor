import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	SessionRecorderMachine,
	type SessionRecorderState,
} from "./SessionRecorderMachine";

function createMockCallbacks() {
	return {
		onStartRecording: vi.fn(),
		onStopRecording: vi.fn().mockResolvedValue({
			blob: new Blob(["test"], { type: "video/webm" }),
			duration: 5000,
		}),
		onStartThumbnails: vi.fn(),
		onStopThumbnails: vi.fn().mockReturnValue([]),
		onStartBlockTimer: vi.fn(),
		onStopBlockTimer: vi.fn(),
		onSaveBlock: vi.fn().mockResolvedValue(undefined),
		onStateChange: vi.fn(),
		now: vi.fn().mockReturnValue(1000),
	};
}

describe("SessionRecorderMachine", () => {
	let callbacks: ReturnType<typeof createMockCallbacks>;
	let machine: SessionRecorderMachine;

	beforeEach(() => {
		vi.clearAllMocks();
		callbacks = createMockCallbacks();
		machine = new SessionRecorderMachine(callbacks);
	});

	describe("initial state", () => {
		it("starts in idle state", () => {
			expect(machine.getState()).toEqual({ type: "idle" });
		});

		it("is not recording initially", () => {
			expect(machine.isRecording()).toBe(false);
		});
	});

	describe("enable/disable", () => {
		it("transitions to initializing when enabled", () => {
			machine.enable();

			expect(machine.getState()).toEqual({ type: "initializing" });
			expect(callbacks.onStateChange).toHaveBeenCalledWith({
				type: "initializing",
			});
		});

		it("transitions to idle when disabled", async () => {
			machine.enable();
			await machine.disable();

			expect(machine.getState()).toEqual({ type: "idle" });
		});

		it("does nothing if already enabled", () => {
			machine.enable();
			callbacks.onStateChange.mockClear();

			machine.enable();

			expect(callbacks.onStateChange).not.toHaveBeenCalled();
		});

		it("does nothing if already disabled", async () => {
			await machine.disable();

			expect(callbacks.onStateChange).not.toHaveBeenCalled();
		});
	});

	describe("storage initialization", () => {
		it("transitions to waitingForVideo when storage ready", () => {
			machine.enable();
			machine.storageInitialized();

			expect(machine.getState()).toEqual({ type: "waitingForVideo" });
		});

		it("stays in initializing if not enabled", () => {
			machine.storageInitialized();

			expect(machine.getState()).toEqual({ type: "idle" });
		});

		it("transitions to idle on storage init failure", () => {
			machine.enable();
			machine.storageInitFailed();

			expect(machine.getState()).toEqual({ type: "idle" });
		});
	});

	describe("video readiness", () => {
		it("starts recording when video becomes ready", () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			expect(machine.getState()).toEqual({
				type: "recording",
				blockStart: 1000,
			});
			expect(machine.isRecording()).toBe(true);
		});

		it("calls all start callbacks when recording starts", () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			expect(callbacks.onStartRecording).toHaveBeenCalled();
			expect(callbacks.onStartThumbnails).toHaveBeenCalledWith(1000);
			expect(callbacks.onStartBlockTimer).toHaveBeenCalled();
		});

		it("does not start if not enabled", () => {
			machine.storageInitialized();
			machine.videoIsReady();

			expect(machine.isRecording()).toBe(false);
		});

		it("does not start if storage not ready", () => {
			machine.enable();
			machine.videoIsReady();

			expect(machine.isRecording()).toBe(false);
			expect(machine.getState()).toEqual({ type: "initializing" });
		});
	});

	describe("stopCurrentBlock", () => {
		it("stops recording and saves block", async () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			await machine.stopCurrentBlock();

			expect(callbacks.onStopBlockTimer).toHaveBeenCalled();
			expect(callbacks.onStopThumbnails).toHaveBeenCalled();
			expect(callbacks.onStopRecording).toHaveBeenCalled();
			expect(callbacks.onSaveBlock).toHaveBeenCalledWith(
				expect.any(Blob),
				5000,
				[],
				1000,
			);
		});

		it("does not save if recording returns null", async () => {
			callbacks.onStopRecording.mockResolvedValue(null);

			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			await machine.stopCurrentBlock();

			expect(callbacks.onSaveBlock).not.toHaveBeenCalled();
		});

		it("does not save if blob is empty", async () => {
			callbacks.onStopRecording.mockResolvedValue({
				blob: new Blob([], { type: "video/webm" }),
				duration: 0,
			});

			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			await machine.stopCurrentBlock();

			expect(callbacks.onSaveBlock).not.toHaveBeenCalled();
		});

		it("transitions to waitingForVideo if still enabled and ready", async () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			await machine.stopCurrentBlock();

			expect(machine.getState()).toEqual({ type: "waitingForVideo" });
		});

		it("transitions to idle if disabled during stop", async () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();
			await machine.disable();

			// After disable completes its stopCurrentBlock
			expect(machine.getState()).toEqual({ type: "idle" });
		});

		it("does nothing if not recording", async () => {
			await machine.stopCurrentBlock();

			expect(callbacks.onStopRecording).not.toHaveBeenCalled();
		});
	});

	describe("blockTimerFired", () => {
		it("stops current block and starts new one", async () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			callbacks.onStartRecording.mockClear();
			callbacks.now.mockReturnValue(2000);

			await machine.blockTimerFired();

			// Should have stopped and started again
			expect(callbacks.onStopRecording).toHaveBeenCalled();
			expect(callbacks.onSaveBlock).toHaveBeenCalled();
			expect(callbacks.onStartRecording).toHaveBeenCalled();
			expect(machine.getState()).toEqual({
				type: "recording",
				blockStart: 2000,
			});
		});

		it("does not start new block if disabled", async () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			callbacks.onStartRecording.mockClear();

			// Disable and wait for it to complete
			await machine.disable();

			expect(machine.getState()).toEqual({ type: "idle" });
			// startRecording should not have been called again after disable
			expect(callbacks.onStartRecording).not.toHaveBeenCalled();
		});

		it("does not start new block if video not ready", async () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			callbacks.onStartRecording.mockClear();
			await machine.videoNotReady();

			// After video becomes unavailable, should stop and not restart
			expect(machine.isRecording()).toBe(false);
		});

		it("does nothing if not recording", async () => {
			await machine.blockTimerFired();

			expect(callbacks.onStopRecording).not.toHaveBeenCalled();
		});
	});

	describe("videoNotReady", () => {
		it("stops recording when video becomes unavailable", async () => {
			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();

			await machine.videoNotReady();

			expect(callbacks.onStopRecording).toHaveBeenCalled();
		});

		it("does nothing if not recording", async () => {
			await machine.videoNotReady();

			expect(callbacks.onStopRecording).not.toHaveBeenCalled();
		});
	});

	describe("state transitions sequence", () => {
		it("full lifecycle: enable -> init -> video -> record -> stop -> idle", async () => {
			const states: string[] = [];
			callbacks.onStateChange.mockImplementation((state: SessionRecorderState) => {
				states.push(state.type);
			});

			machine.enable();
			machine.storageInitialized();
			machine.videoIsReady();
			await machine.stopCurrentBlock();
			await machine.disable();

			expect(states).toEqual([
				"initializing",
				"waitingForVideo",
				"recording",
				"stopping",
				"waitingForVideo",
				"idle",
			]);
		});

		it("handles rapid enable/disable without crash", async () => {
			machine.enable();
			await machine.disable();
			machine.enable();
			await machine.disable();
			machine.enable();

			expect(machine.getState()).toEqual({ type: "initializing" });
		});
	});
});
