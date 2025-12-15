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
		it("returns fixed blob from fix-webm-duration", async () => {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			const inputBlob = new Blob(["test"], { type: "video/webm" });
			const fixedBlob = new Blob(["fixed"], { type: "video/webm" });
			vi.mocked(fixWebmDuration).mockResolvedValue(fixedBlob);

			const result = await VideoFixService.fixDuration(inputBlob, 5000);

			expect(fixWebmDuration).toHaveBeenCalledWith(inputBlob, 5000);
			expect(result).toBe(fixedBlob);
		});

		it("passes 0 for duration when not provided (library calculates it)", async () => {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			const inputBlob = new Blob(["test data"], { type: "video/webm" });
			const fixedBlob = new Blob(["fixed"], { type: "video/webm" });
			vi.mocked(fixWebmDuration).mockResolvedValue(fixedBlob);

			await VideoFixService.fixDuration(inputBlob);

			expect(fixWebmDuration).toHaveBeenCalledWith(inputBlob, 0);
		});

		it("returns original blob on error", async () => {
			const fixWebmDuration = (await import("fix-webm-duration")).default;
			const inputBlob = new Blob(["test"], { type: "video/webm" });
			vi.mocked(fixWebmDuration).mockRejectedValue(new Error("Fix failed"));

			// Spy on console.warn to verify it's called
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await VideoFixService.fixDuration(inputBlob, 5000);

			expect(result).toBe(inputBlob);
			expect(warnSpy).toHaveBeenCalledWith(
				"fix-webm-duration failed, returning original blob:",
				expect.any(Error),
			);

			warnSpy.mockRestore();
		});
	});

	describe("needsFix", () => {
		it("returns true (fix always needed for now)", () => {
			expect(VideoFixService.needsFix()).toBe(true);
		});
	});
});
