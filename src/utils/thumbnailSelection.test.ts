import { describe, expect, it } from "vitest";
import type { SessionThumbnail } from "../types/sessions";
import { selectThumbnailsForDisplay } from "./thumbnailSelection";

// Helper to create thumbnails at specific times
function makeThumbnails(times: number[]): SessionThumbnail[] {
	return times.map((time) => ({
		time,
		dataUrl: `data:image/jpeg;base64,fake${time}`,
	}));
}

describe("selectThumbnailsForDisplay", () => {
	describe("edge cases", () => {
		it("returns empty array for empty input", () => {
			expect(selectThumbnailsForDisplay([], 60, false)).toEqual([]);
		});

		it("returns empty array for zero duration", () => {
			const thumbs = makeThumbnails([0, 3, 6]);
			expect(selectThumbnailsForDisplay(thumbs, 0, false)).toEqual([]);
		});

		it("returns single thumbnail for single input", () => {
			const thumbs = makeThumbnails([0]);
			const result = selectThumbnailsForDisplay(thumbs, 10, false);
			expect(result).toHaveLength(1);
		});

		it("handles actualCount=1 without division by zero", () => {
			// Try: very short clip with many thumbnails
			// 0.5s clip, target 10 = 0.05s interval, clamped to 1s min
			// actualCount = ceil(0.5/1) = 1
			const shortThumbs = makeThumbnails([0, 0.1, 0.2, 0.3, 0.4]);
			const result = selectThumbnailsForDisplay(shortThumbs, 0.5, false);
			// Should return first thumbnail without error
			expect(result).toHaveLength(1);
			expect(result[0].time).toBe(0);
		});
	});

	describe("mobile (target: 4)", () => {
		it("returns all thumbnails when fewer than target", () => {
			const thumbs = makeThumbnails([0, 10, 20]);
			const result = selectThumbnailsForDisplay(thumbs, 30, true);
			expect(result).toHaveLength(3);
		});

		it("selects ~4 thumbnails for 30s clip", () => {
			// 30s clip with thumbnails every 3s = 10 thumbnails
			const thumbs = makeThumbnails([0, 3, 6, 9, 12, 15, 18, 21, 24, 27]);
			const result = selectThumbnailsForDisplay(thumbs, 30, true);
			// Target 4, interval = 30/4 = 7.5s (within 1-15 bounds)
			expect(result.length).toBeGreaterThanOrEqual(3);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("respects max interval (15s) for long clips", () => {
			// 5 minute (300s) clip
			// Target 4 would be 75s interval, but max is 15s
			// So we should get 300/15 = 20 thumbnails
			const times = Array.from({ length: 100 }, (_, i) => i * 3);
			const thumbs = makeThumbnails(times);
			const result = selectThumbnailsForDisplay(thumbs, 300, true);
			expect(result.length).toBeGreaterThanOrEqual(15);
		});
	});

	describe("desktop (target: 10)", () => {
		it("selects ~10 thumbnails for 60s clip", () => {
			// 60s clip with thumbnails every 3s = 20 thumbnails
			const times = Array.from({ length: 20 }, (_, i) => i * 3);
			const thumbs = makeThumbnails(times);
			const result = selectThumbnailsForDisplay(thumbs, 60, false);
			// Target 10, interval = 60/10 = 6s (within 1-15 bounds)
			expect(result.length).toBeGreaterThanOrEqual(8);
			expect(result.length).toBeLessThanOrEqual(12);
		});

		it("respects min interval (1s) for short clips", () => {
			// 5 second clip
			// Target 10 would be 0.5s interval, but min is 1s
			// So we should get 5/1 = 5 thumbnails
			const thumbs = makeThumbnails([0, 1, 2, 3, 4]);
			const result = selectThumbnailsForDisplay(thumbs, 5, false);
			expect(result.length).toBeLessThanOrEqual(5);
		});
	});

	describe("evenly spaced selection", () => {
		it("selects evenly spaced thumbnails", () => {
			const thumbs = makeThumbnails([0, 5, 10, 15, 20, 25, 30, 35, 40, 45]);
			const result = selectThumbnailsForDisplay(thumbs, 50, true); // mobile, target 4

			// Should pick roughly evenly spaced ones
			expect(result[0].time).toBe(0); // First
			expect(result[result.length - 1].time).toBe(45); // Last
		});
	});
});
