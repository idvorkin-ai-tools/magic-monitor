import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThumbnailCaptureService } from "./ThumbnailCaptureService";

describe("ThumbnailCaptureService", () => {
	let mockCanvas: HTMLCanvasElement;
	let mockCtx: CanvasRenderingContext2D;

	beforeEach(() => {
		// Mock canvas context
		mockCtx = {
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D;

		mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn().mockReturnValue(mockCtx),
			toDataURL: vi.fn().mockReturnValue("data:image/jpeg;base64,test"),
		} as unknown as HTMLCanvasElement;

		vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
			if (tag === "canvas") return mockCanvas;
			// Return actual video element for video tests
			return document.createElement(tag);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("captureFromVideo", () => {
		it("captures frame from video element (downscaled to maxWidth)", () => {
			const mockVideo = {
				videoWidth: 1920,
				videoHeight: 1080,
			} as HTMLVideoElement;

			const result = ThumbnailCaptureService.captureFromVideo(mockVideo);

			// Default maxWidth=640 → scale = 640/1920 = 1/3
			expect(mockCanvas.width).toBe(640);
			expect(mockCanvas.height).toBe(360);
			expect(mockCtx.drawImage).toHaveBeenCalledWith(mockVideo, 0, 0, 640, 360);
			expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.7);
			expect(result).toBe("data:image/jpeg;base64,test");
		});

		it("does not upscale when video is smaller than maxWidth", () => {
			const mockVideo = {
				videoWidth: 320,
				videoHeight: 240,
			} as HTMLVideoElement;

			ThumbnailCaptureService.captureFromVideo(mockVideo);

			// scale = min(1, 640/320) = 1 → no scaling
			expect(mockCanvas.width).toBe(320);
			expect(mockCanvas.height).toBe(240);
			expect(mockCtx.drawImage).toHaveBeenCalledWith(mockVideo, 0, 0, 320, 240);
		});

		it("uses custom quality when provided", () => {
			const mockVideo = {
				videoWidth: 640,
				videoHeight: 480,
			} as HTMLVideoElement;

			ThumbnailCaptureService.captureFromVideo(mockVideo, 0.5);

			// 640 <= maxWidth(640), so scale=1, no downscaling
			expect(mockCanvas.width).toBe(640);
			expect(mockCanvas.height).toBe(480);
			expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.5);
		});

		it("throws when canvas context unavailable", () => {
			mockCanvas.getContext = vi.fn().mockReturnValue(null);
			const mockVideo = {
				videoWidth: 640,
				videoHeight: 480,
			} as HTMLVideoElement;

			expect(() =>
				ThumbnailCaptureService.captureFromVideo(mockVideo),
			).toThrow("Cannot get canvas context");
		});
	});

	describe("captureAtTime", () => {
		// Note: Full integration tests for captureAtTime and generateThumbnailsAtIntervals
		// require actual video elements with loaded media, which jsdom doesn't support.
		// These methods work in real browsers. Unit tests cover the synchronous logic.

		it.skip("captures frame at specified time", async () => {
			// This would require mocking video element load/seek behavior
			const blob = new Blob(["test"], { type: "video/webm" });
			const result = await ThumbnailCaptureService.captureAtTime(blob, 5);
			expect(result).toMatch(/^data:image\/jpeg/);
		});

		it("rejects with timeout error if video metadata never loads", async () => {
			const blob = new Blob(["test"], { type: "video/webm" });

			// Create a video element that never fires onloadedmetadata
			const mockVideo = {
				muted: false,
				playsInline: false,
				src: "",
				onloadedmetadata: null as null | (() => void),
				onseeked: null as null | (() => void),
				onerror: null as null | (() => void),
				load: vi.fn(),
			} as unknown as HTMLVideoElement;

			const originalCreateElement = document.createElement.bind(document);
			vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
				if (tag === "video") return mockVideo;
				if (tag === "canvas") return mockCanvas;
				return originalCreateElement(tag);
			});

			// Capture the blob URL so we can verify it gets revoked
			let createdUrl: string | undefined;
			const originalCreateObjectURL = URL.createObjectURL;
			vi.spyOn(URL, "createObjectURL").mockImplementation((obj: Blob | MediaSource) => {
				createdUrl = originalCreateObjectURL(obj);
				return createdUrl;
			});

			const revokeURLSpy = vi.spyOn(URL, "revokeObjectURL");

			// Mock timers to control timeout
			vi.useFakeTimers();

			const capturePromise = ThumbnailCaptureService.captureAtTime(blob, 5);

			// Setup rejection handler immediately to prevent unhandled rejection warnings
			let rejectionError: Error | undefined;
			void capturePromise.catch((err) => {
				rejectionError = err;
			});

			// Fast-forward past the timeout (should be 10 seconds)
			await vi.advanceTimersByTimeAsync(10000);

			// Verify the promise rejected with timeout error
			expect(rejectionError).toBeInstanceOf(Error);
			expect(rejectionError?.message).toBe("Timeout loading video metadata");

			// Verify blob URL was revoked to prevent memory leak
			expect(revokeURLSpy).toHaveBeenCalledWith(createdUrl);

			vi.useRealTimers();
		});
	});

	describe("generateThumbnailsAtIntervals", () => {
		it.skip("generates thumbnails at intervals", async () => {
			// This would require mocking video element load/seek behavior
			const blob = new Blob(["test"], { type: "video/webm" });
			const results = await ThumbnailCaptureService.generateThumbnailsAtIntervals(
				blob,
				15,
			);
			expect(results).toBeInstanceOf(Array);
		});

		it("rejects with timeout error if video metadata never loads", async () => {
			const blob = new Blob(["test"], { type: "video/webm" });

			// Create a video element that never fires onloadedmetadata
			const mockVideo = {
				muted: false,
				playsInline: false,
				src: "",
				onloadedmetadata: null as null | (() => void),
				onseeked: null as null | (() => void),
				onerror: null as null | (() => void),
				load: vi.fn(),
			} as unknown as HTMLVideoElement;

			const originalCreateElement = document.createElement.bind(document);
			vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
				if (tag === "video") return mockVideo;
				if (tag === "canvas") return mockCanvas;
				return originalCreateElement(tag);
			});

			// Capture the blob URL so we can verify it gets revoked
			let createdUrl: string | undefined;
			const originalCreateObjectURL = URL.createObjectURL;
			vi.spyOn(URL, "createObjectURL").mockImplementation((obj: Blob | MediaSource) => {
				createdUrl = originalCreateObjectURL(obj);
				return createdUrl;
			});

			const revokeURLSpy = vi.spyOn(URL, "revokeObjectURL");

			// Mock timers to control timeout
			vi.useFakeTimers();

			const capturePromise =
				ThumbnailCaptureService.generateThumbnailsAtIntervals(blob, 15);

			// Setup rejection handler immediately to prevent unhandled rejection warnings
			let rejectionError: Error | undefined;
			void capturePromise.catch((err) => {
				rejectionError = err;
			});

			// Fast-forward past the timeout (should be 10 seconds)
			await vi.advanceTimersByTimeAsync(10000);

			// Verify the promise rejected with timeout error
			expect(rejectionError).toBeInstanceOf(Error);
			expect(rejectionError?.message).toBe("Timeout loading video metadata");

			// Verify blob URL was revoked to prevent memory leak
			expect(revokeURLSpy).toHaveBeenCalledWith(createdUrl);

			vi.useRealTimers();
		});
	});
});
