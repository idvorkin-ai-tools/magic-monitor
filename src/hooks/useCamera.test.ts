import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as CameraService from "../services/CameraService";
import { DeviceService } from "../services/DeviceService";
import { useCamera } from "./useCamera";

// Mock CameraService
vi.mock("../services/CameraService", () => ({
	getVideoDevices: vi.fn(),
	start: vi.fn(),
	stop: vi.fn(),
	addDeviceChangeListener: vi.fn(),
	InsecureContextError: class InsecureContextError extends Error {
		constructor() {
			super(
				"Camera requires HTTPS. Access this page via localhost or a secure connection.",
			);
			this.name = "InsecureContextError";
		}
	},
}));

// Mock DeviceService
vi.mock("../services/DeviceService", () => ({
	DeviceService: {
		getStorageItem: vi.fn(),
		setStorageItem: vi.fn(),
	},
}));

// Helper to create mock MediaStream
function createMockStream(deviceId = "device-1"): MediaStream {
	const mockTrack = {
		kind: "video",
		stop: vi.fn(),
		getSettings: () => ({ deviceId }),
	};
	return {
		getTracks: () => [mockTrack],
		getVideoTracks: () => [mockTrack],
		getAudioTracks: () => [],
		active: true,
	} as unknown as MediaStream;
}

// Helper to create mock device
function createMockDevice(
	id: string,
	label: string,
): MediaDeviceInfo {
	return {
		deviceId: id,
		kind: "videoinput",
		label,
		groupId: "group-1",
		toJSON: () => ({}),
	};
}

describe("useCamera", () => {
	let deviceChangeCallback: (() => void) | null = null;

	beforeEach(() => {
		vi.clearAllMocks();
		deviceChangeCallback = null;

		// Default mock implementations
		vi.mocked(CameraService.getVideoDevices).mockResolvedValue([]);
		vi.mocked(CameraService.start).mockResolvedValue(createMockStream());
		vi.mocked(CameraService.stop).mockImplementation(() => {});
		vi.mocked(CameraService.addDeviceChangeListener).mockImplementation(
			(cb) => {
				deviceChangeCallback = cb;
				return () => {
					deviceChangeCallback = null;
				};
			},
		);
		vi.mocked(DeviceService.getStorageItem).mockReturnValue(null);
		vi.mocked(DeviceService.setStorageItem).mockImplementation(() => {});
	});

	afterEach(() => {
		deviceChangeCallback = null;
	});

	describe("initialization", () => {
		it("starts with null stream and no error", async () => {
			const { result } = renderHook(() => useCamera());

			// Initial state before effects run
			expect(result.current.stream).toBeNull();
			expect(result.current.error).toBeNull();
		});

		it("uses initialDeviceId if provided", async () => {
			renderHook(() => useCamera("initial-device"));

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalledWith("initial-device", "4k", "landscape");
			});
		});

		it("uses stored device ID from DeviceService", async () => {
			vi.mocked(DeviceService.getStorageItem).mockReturnValue("stored-device");

			renderHook(() => useCamera());

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalledWith("stored-device", "4k", "landscape");
			});
		});

		it("prefers initialDeviceId over stored value", async () => {
			vi.mocked(DeviceService.getStorageItem).mockReturnValue("stored-device");

			renderHook(() => useCamera("initial-device"));

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalledWith("initial-device", "4k", "landscape");
			});
		});
	});

	describe("device enumeration", () => {
		it("fetches devices on mount", async () => {
			const devices = [
				createMockDevice("device-1", "Camera 1"),
				createMockDevice("device-2", "Camera 2"),
			];
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue(devices);

			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(result.current.devices).toEqual(devices);
			});
		});

		it("selects first device if none selected", async () => {
			const devices = [
				createMockDevice("device-1", "Camera 1"),
				createMockDevice("device-2", "Camera 2"),
			];
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue(devices);

			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(result.current.selectedDeviceId).toBe("device-1");
			});
		});

		it("registers device change listener", async () => {
			renderHook(() => useCamera());

			await waitFor(() => {
				expect(CameraService.addDeviceChangeListener).toHaveBeenCalled();
			});
		});

		it("refreshes devices when device change event fires", async () => {
			const initialDevices = [createMockDevice("device-1", "Camera 1")];
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue(initialDevices);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(result.current.devices).toHaveLength(1);
			});

			// Simulate device change
			const newDevices = [
				createMockDevice("device-1", "Camera 1"),
				createMockDevice("device-2", "Camera 2"),
			];
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue(newDevices);

			act(() => {
				deviceChangeCallback?.();
			});

			await waitFor(() => {
				expect(result.current.devices).toHaveLength(2);
			});
		});

		it("cleans up device change listener on unmount", async () => {
			const cleanup = vi.fn();
			vi.mocked(CameraService.addDeviceChangeListener).mockReturnValue(cleanup);

			const { unmount } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(CameraService.addDeviceChangeListener).toHaveBeenCalled();
			});

			unmount();

			expect(cleanup).toHaveBeenCalled();
		});
	});

	describe("stream management", () => {
		it("starts camera stream", async () => {
			const mockStream = createMockStream();
			vi.mocked(CameraService.start).mockResolvedValue(mockStream);

			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(result.current.stream).toBe(mockStream);
			});
		});

		it("stops previous stream when device changes", async () => {
			const stream1 = createMockStream("device-1");
			const stream2 = createMockStream("device-2");

			// Set up devices so hook doesn't auto-detect and trigger extra re-renders
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
				createMockDevice("device-2", "Camera 2"),
			]);

			vi.mocked(CameraService.start)
				.mockResolvedValueOnce(stream1)
				.mockResolvedValueOnce(stream2);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(result.current.stream).toBe(stream1);
			});

			// Change device which triggers effect re-run
			act(() => {
				result.current.setSelectedDeviceId("device-2");
			});

			await waitFor(() => {
				expect(result.current.stream).toBe(stream2);
			});

			// Stream1 should have been stopped (either in cleanup or setupCamera)
			expect(CameraService.stop).toHaveBeenCalledWith(stream1);
		});

		it("stops stream on unmount", async () => {
			const mockStream = createMockStream();
			vi.mocked(CameraService.start).mockResolvedValue(mockStream);

			const { result, unmount } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(result.current.stream).toBe(mockStream);
			});

			unmount();

			expect(CameraService.stop).toHaveBeenCalledWith(mockStream);
		});
	});

	describe("error handling", () => {
		it("sets generic error on camera failure", async () => {
			vi.mocked(CameraService.start).mockRejectedValue(
				new Error("Permission denied"),
			);

			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(result.current.error).toBe(
					"Could not access camera. Please allow permissions.",
				);
			});
			expect(result.current.stream).toBeNull();
		});

		it("sets specific error for InsecureContextError", async () => {
			vi.mocked(CameraService.start).mockRejectedValue(
				new CameraService.InsecureContextError(),
			);

			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(result.current.error).toBe(
					"Camera requires HTTPS. Access this page via localhost or a secure connection.",
				);
			});
		});
	});

	describe("retry", () => {
		it("clears error and retries on retry()", async () => {
			vi.mocked(CameraService.start)
				.mockRejectedValueOnce(new Error("Failed"))
				.mockResolvedValueOnce(createMockStream());

			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(result.current.error).not.toBeNull();
			});

			act(() => {
				result.current.retry();
			});

			await waitFor(() => {
				expect(result.current.error).toBeNull();
				expect(result.current.stream).not.toBeNull();
			});
		});
	});

	describe("device selection", () => {
		it("persists device selection to storage", async () => {
			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalled();
			});

			act(() => {
				result.current.setSelectedDeviceId("new-device");
			});

			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-camera-device-id",
				"new-device",
			);
		});

		it("updates selectedDeviceId state", async () => {
			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalled();
			});

			act(() => {
				result.current.setSelectedDeviceId("new-device");
			});

			expect(result.current.selectedDeviceId).toBe("new-device");
		});

		it("extracts device ID from stream when not set", async () => {
			const mockStream = createMockStream("auto-detected-device");
			vi.mocked(CameraService.start).mockResolvedValue(mockStream);

			const { result } = renderHook(() => useCamera());

			await waitFor(() => {
				expect(result.current.selectedDeviceId).toBe("auto-detected-device");
			});

			expect(DeviceService.setStorageItem).toHaveBeenCalledWith(
				"magic-monitor-camera-device-id",
				"auto-detected-device",
			);
		});
	});

	describe("resolution handling", () => {
		it("starts with default 4k resolution", async () => {
			// Set up devices to avoid auto-selection triggering extra renders
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
			]);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalled();
			});

			expect(result.current.resolution).toBe("4k");
		});

		it("passes resolution to CameraService.start", async () => {
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
			]);

			renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalledWith(
					"device-1",
					"4k",
					"landscape",
				);
			});
		});

		it("restarts stream when resolution changes", async () => {
			const stream1 = createMockStream("device-1");
			const stream2 = createMockStream("device-1");

			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
			]);
			vi.mocked(CameraService.start)
				.mockResolvedValueOnce(stream1)
				.mockResolvedValueOnce(stream2);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(result.current.stream).toBe(stream1);
			});

			act(() => {
				result.current.setResolution("1080p");
			});

			await waitFor(() => {
				expect(result.current.stream).toBe(stream2);
			});

			// Verify CameraService.start was called with new resolution
			expect(CameraService.start).toHaveBeenCalledWith(
				"device-1",
				"1080p",
				"landscape",
			);
		});

		it("updates resolution state when setResolution is called", async () => {
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
			]);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalled();
			});

			act(() => {
				result.current.setResolution("720p");
			});

			expect(result.current.resolution).toBe("720p");
		});

		it("stops previous stream when resolution changes", async () => {
			const stream1 = createMockStream("device-1");
			const stream2 = createMockStream("device-1");

			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
			]);
			vi.mocked(CameraService.start)
				.mockResolvedValueOnce(stream1)
				.mockResolvedValueOnce(stream2);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(result.current.stream).toBe(stream1);
			});

			act(() => {
				result.current.setResolution("1080p");
			});

			await waitFor(() => {
				expect(result.current.stream).toBe(stream2);
			});

			expect(CameraService.stop).toHaveBeenCalledWith(stream1);
		});
	});

	describe("orientation handling", () => {
		it("starts with default landscape orientation", async () => {
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
			]);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalled();
			});

			expect(result.current.orientation).toBe("landscape");
		});

		it("restarts stream when orientation changes", async () => {
			const stream1 = createMockStream("device-1");
			const stream2 = createMockStream("device-1");

			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
			]);
			vi.mocked(CameraService.start)
				.mockResolvedValueOnce(stream1)
				.mockResolvedValueOnce(stream2);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(result.current.stream).toBe(stream1);
			});

			act(() => {
				result.current.setOrientation("portrait");
			});

			await waitFor(() => {
				expect(result.current.stream).toBe(stream2);
			});

			// Verify CameraService.start was called with new orientation
			expect(CameraService.start).toHaveBeenCalledWith(
				"device-1",
				"4k",
				"portrait",
			);
		});

		it("updates orientation state when setOrientation is called", async () => {
			vi.mocked(CameraService.getVideoDevices).mockResolvedValue([
				createMockDevice("device-1", "Camera 1"),
			]);

			const { result } = renderHook(() => useCamera("device-1"));

			await waitFor(() => {
				expect(CameraService.start).toHaveBeenCalled();
			});

			act(() => {
				result.current.setOrientation("portrait");
			});

			expect(result.current.orientation).toBe("portrait");
		});
	});
});
