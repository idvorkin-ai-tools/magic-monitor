import { beforeEach, describe, expect, it, vi } from "vitest";
import { VideoFixService } from "./VideoFixService";

// Mock fix-webm-duration
vi.mock("fix-webm-duration", () => ({
	default: vi.fn(),
}));

describe("VideoFixService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("fixDuration", () => {
		it("returns fixed blob from fix-webm-duration with wasFixed=true", async () => {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			const inputBlob = new Blob(["test"], { type: "video/webm" });
			const fixedBlob = new Blob(["fixed"], { type: "video/webm" });
			vi.mocked(fixWebmDuration).mockResolvedValue(fixedBlob);

			const result = await VideoFixService.fixDuration(inputBlob, 5000);

			expect(fixWebmDuration).toHaveBeenCalledWith(inputBlob, 5000);
			expect(result.blob).toBe(fixedBlob);
			expect(result.wasFixed).toBe(true);
		});

		it("passes 0 for duration when not provided (library calculates it)", async () => {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			const inputBlob = new Blob(["test data"], { type: "video/webm" });
			const fixedBlob = new Blob(["fixed"], { type: "video/webm" });
			vi.mocked(fixWebmDuration).mockResolvedValue(fixedBlob);

			const result = await VideoFixService.fixDuration(inputBlob);

			expect(fixWebmDuration).toHaveBeenCalledWith(inputBlob, 0);
			expect(result.blob).toBe(fixedBlob);
			expect(result.wasFixed).toBe(true);
		});

		it("returns original blob with wasFixed=false on error", async () => {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			const inputBlob = new Blob(["test"], { type: "video/webm" });
			vi.mocked(fixWebmDuration).mockRejectedValue(new Error("Fix failed"));

			// Spy on console.warn to verify it's called
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await VideoFixService.fixDuration(inputBlob, 5000);

			expect(result.blob).toBe(inputBlob);
			expect(result.wasFixed).toBe(false);
			expect(warnSpy).toHaveBeenCalledWith(
				"fix-webm-duration failed, returning original blob:",
				expect.any(Error),
			);

			warnSpy.mockRestore();
		});
	});

	describe("needsFix", () => {
		it("returns true for WebM blobs", () => {
			const webmBlob = new Blob(["test"], { type: "video/webm" });
			expect(VideoFixService.needsFix(webmBlob)).toBe(true);
		});

		it("returns true for WebM with codecs", () => {
			const webmBlob = new Blob(["test"], { type: "video/webm;codecs=vp9" });
			expect(VideoFixService.needsFix(webmBlob)).toBe(true);
		});

		it("returns false for MP4 blobs (iOS)", () => {
			const mp4Blob = new Blob(["test"], { type: "video/mp4" });
			expect(VideoFixService.needsFix(mp4Blob)).toBe(false);
		});

		it("returns false for MP4 with codecs", () => {
			const mp4Blob = new Blob(["test"], { type: "video/mp4;codecs=avc1" });
			expect(VideoFixService.needsFix(mp4Blob)).toBe(false);
		});
	});

	describe("fixDuration with MP4", () => {
		it("skips fix for MP4 blobs and returns original", async () => {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			const mp4Blob = new Blob(["test"], { type: "video/mp4" });

			const result = await VideoFixService.fixDuration(mp4Blob, 5000);

			// Should NOT call fix-webm-duration for MP4
			expect(fixWebmDuration).not.toHaveBeenCalled();
			expect(result.blob).toBe(mp4Blob);
			expect(result.wasFixed).toBe(false);
		});
	});
});
