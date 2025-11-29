import { describe, expect, it } from "vitest";
import {
	calculateMagnitude,
	extractAcceleration,
	isShakeDetected,
} from "./shakeDetection";

describe("calculateMagnitude", () => {
	it("returns 0 for zero acceleration", () => {
		expect(calculateMagnitude({ x: 0, y: 0, z: 0 })).toBe(0);
	});

	it("calculates magnitude correctly for single axis", () => {
		expect(calculateMagnitude({ x: 3, y: 0, z: 0 })).toBe(3);
		expect(calculateMagnitude({ x: 0, y: 4, z: 0 })).toBe(4);
		expect(calculateMagnitude({ x: 0, y: 0, z: 5 })).toBe(5);
	});

	it("calculates 3D magnitude using Pythagorean theorem", () => {
		// 3-4-5 triangle extended to 3D: sqrt(3^2 + 4^2 + 0^2) = 5
		expect(calculateMagnitude({ x: 3, y: 4, z: 0 })).toBe(5);
		// sqrt(1^2 + 2^2 + 2^2) = sqrt(9) = 3
		expect(calculateMagnitude({ x: 1, y: 2, z: 2 })).toBe(3);
	});

	it("handles negative values", () => {
		expect(calculateMagnitude({ x: -3, y: -4, z: 0 })).toBe(5);
	});
});

describe("isShakeDetected", () => {
	const threshold = 25;
	const cooldownMs = 2000;

	it("returns false when magnitude is below threshold", () => {
		expect(isShakeDetected(20, threshold, 1000, 0, cooldownMs)).toBe(false);
	});

	it("returns false when magnitude equals threshold", () => {
		expect(isShakeDetected(25, threshold, 1000, 0, cooldownMs)).toBe(false);
	});

	it("returns true when magnitude exceeds threshold and cooldown passed", () => {
		expect(isShakeDetected(30, threshold, 3000, 0, cooldownMs)).toBe(true);
	});

	it("returns false when still in cooldown period", () => {
		const lastShake = 1000;
		const currentTime = 2500; // Only 1500ms since last shake
		expect(
			isShakeDetected(30, threshold, currentTime, lastShake, cooldownMs),
		).toBe(false);
	});

	it("returns true when cooldown has passed", () => {
		const lastShake = 1000;
		const currentTime = 3500; // 2500ms since last shake, exceeds 2000ms cooldown
		expect(
			isShakeDetected(30, threshold, currentTime, lastShake, cooldownMs),
		).toBe(true);
	});

	it("returns true on first shake (lastShakeTime is 0)", () => {
		// With lastShakeTime=0 and currentTime=3000, difference is 3000ms > 2000ms cooldown
		expect(isShakeDetected(30, threshold, 3000, 0, cooldownMs)).toBe(true);
	});
});

describe("extractAcceleration", () => {
	it("returns null when acceleration is missing", () => {
		const event = {
			acceleration: null,
			accelerationIncludingGravity: null,
		} as DeviceMotionEvent;
		expect(extractAcceleration(event)).toBeNull();
	});

	it("prefers acceleration over accelerationIncludingGravity", () => {
		const event = {
			acceleration: { x: 1, y: 2, z: 3 },
			accelerationIncludingGravity: { x: 10, y: 20, z: 30 },
		} as DeviceMotionEvent;
		expect(extractAcceleration(event)).toEqual({ x: 1, y: 2, z: 3 });
	});

	it("falls back to accelerationIncludingGravity when acceleration is null", () => {
		const event = {
			acceleration: null,
			accelerationIncludingGravity: { x: 10, y: 20, z: 30 },
		} as DeviceMotionEvent;
		expect(extractAcceleration(event)).toEqual({ x: 10, y: 20, z: 30 });
	});

	it("returns null when any component is null", () => {
		const event = {
			acceleration: { x: 1, y: null, z: 3 },
			accelerationIncludingGravity: null,
		} as unknown as DeviceMotionEvent;
		expect(extractAcceleration(event)).toBeNull();
	});
});
