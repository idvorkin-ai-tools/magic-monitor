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
		it("captures frame from video element", () => {
			const mockVideo = {
				videoWidth: 1920,
				videoHeight: 1080,
			} as HTMLVideoElement;

			const result = ThumbnailCaptureService.captureFromVideo(mockVideo);

			expect(mockCanvas.width).toBe(1920);
			expect(mockCanvas.height).toBe(1080);
			expect(mockCtx.drawImage).toHaveBeenCalledWith(mockVideo, 0, 0);
			expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.7);
			expect(result).toBe("data:image/jpeg;base64,test");
		});

		it("uses custom quality when provided", () => {
			const mockVideo = {
				videoWidth: 640,
				videoHeight: 480,
			} as HTMLVideoElement;

			ThumbnailCaptureService.captureFromVideo(mockVideo, 0.5);

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
	});
});
