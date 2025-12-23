import { describe, expect, it } from "vitest";
import { formatDuration } from "./formatters";

describe("formatDuration", () => {
	it("formats basic seconds (65s -> 1:05)", () => {
		expect(formatDuration(65)).toBe("1:05");
	});

	it("formats zero seconds", () => {
		expect(formatDuration(0)).toBe("0:00");
	});

	it("formats exact minutes with no remaining seconds", () => {
		expect(formatDuration(60)).toBe("1:00");
		expect(formatDuration(120)).toBe("2:00");
		expect(formatDuration(300)).toBe("5:00");
	});

	it("formats seconds less than 60", () => {
		expect(formatDuration(5)).toBe("0:05");
		expect(formatDuration(30)).toBe("0:30");
		expect(formatDuration(59)).toBe("0:59");
	});

	it("pads single-digit seconds with leading zero", () => {
		expect(formatDuration(61)).toBe("1:01");
		expect(formatDuration(125)).toBe("2:05");
		expect(formatDuration(309)).toBe("5:09");
	});

	it("formats large numbers (3661s -> 61:01)", () => {
		expect(formatDuration(3661)).toBe("61:01");
		expect(formatDuration(5999)).toBe("99:59");
		expect(formatDuration(7200)).toBe("120:00");
	});

	it("handles fractional seconds by flooring", () => {
		expect(formatDuration(65.7)).toBe("1:05");
		expect(formatDuration(65.2)).toBe("1:05");
		expect(formatDuration(0.9)).toBe("0:00");
		expect(formatDuration(59.99)).toBe("0:59");
	});

	it("handles negative numbers by treating them as 0", () => {
		// Negative durations don't make sense, treat them as 0
		expect(formatDuration(-65)).toBe("0:00");
		expect(formatDuration(-1)).toBe("0:00");
		expect(formatDuration(-60)).toBe("0:00");
	});

	it("handles NaN input", () => {
		// Math.floor(NaN) = NaN, NaN % 60 = NaN
		expect(formatDuration(Number.NaN)).toBe("NaN:NaN");
	});

	it("handles positive Infinity", () => {
		// Math.floor(Infinity / 60) = Infinity, Infinity % 60 = NaN
		expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("Infinity:NaN");
	});

	it("handles negative Infinity", () => {
		// Negative Infinity is treated as 0 (negative durations don't make sense)
		expect(formatDuration(Number.NEGATIVE_INFINITY)).toBe("0:00");
	});
});
