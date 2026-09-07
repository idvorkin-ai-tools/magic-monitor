import { describe, expect, it } from "vitest";
import {
	anyHandIsVSign,
	fingerSpreadDegrees,
	HAND_LANDMARK_COUNT,
	type HandLandmark,
	isVSign,
	V_SIGN_THRESHOLDS,
} from "./handPose";

// ===== Synthetic hand builder =====
//
// A stylised right hand in MediaPipe's normalized image space: wrist at the
// bottom, knuckles in a row above it, fingers pointing up. Each finger is
// either extended (tip beyond the knuckles) or curled (tip folded back over
// the palm, which is what puts it inside the PIP radius).

type FingerState = "extended" | "curled";

const WRIST_POINT = { x: 0.5, y: 1.0 };
const MCP_Y = 0.7;
const MCP_X = { index: 0.44, middle: 0.5, ring: 0.56, pinky: 0.62 };

interface FingerSpec {
	state: FingerState;
	/** Degrees from straight-up; negative fans left. */
	angle?: number;
}

interface HandSpec {
	index: FingerSpec;
	middle: FingerSpec;
	ring: FingerSpec;
	pinky: FingerSpec;
}

function fingerPoints(mcpX: number, spec: FingerSpec): HandLandmark[] {
	const mcp = { x: mcpX, y: MCP_Y, z: 0 };
	const rad = ((spec.angle ?? 0) * Math.PI) / 180;
	const dir = { x: Math.sin(rad), y: -Math.cos(rad) };

	const along = (d: number) => ({
		x: mcp.x + dir.x * d,
		y: mcp.y + dir.y * d,
		z: 0,
	});

	if (spec.state === "extended") {
		return [mcp, along(0.12), along(0.22), along(0.3)];
	}

	// Curled: the knuckle still stands up, then the finger folds back down
	// over the palm so the tip ends up closer to the wrist than the PIP.
	return [
		mcp,
		along(0.12),
		{ x: mcp.x, y: mcp.y + 0.02, z: 0 },
		{ x: mcp.x, y: mcp.y + 0.06, z: 0 },
	];
}

function makeHand(spec: HandSpec): HandLandmark[] {
	const wrist = { ...WRIST_POINT, z: 0 };
	// Thumb (1-4) is not part of the V rule; plausible filler off the palm's edge.
	const thumb: HandLandmark[] = [
		{ x: 0.4, y: 0.95, z: 0 },
		{ x: 0.34, y: 0.89, z: 0 },
		{ x: 0.3, y: 0.83, z: 0 },
		{ x: 0.27, y: 0.78, z: 0 },
	];

	return [
		wrist,
		...thumb,
		...fingerPoints(MCP_X.index, spec.index),
		...fingerPoints(MCP_X.middle, spec.middle),
		...fingerPoints(MCP_X.ring, spec.ring),
		...fingerPoints(MCP_X.pinky, spec.pinky),
	];
}

const V_SIGN = makeHand({
	index: { state: "extended", angle: -20 },
	middle: { state: "extended", angle: 8 },
	ring: { state: "curled" },
	pinky: { state: "curled" },
});

const FIST = makeHand({
	index: { state: "curled" },
	middle: { state: "curled" },
	ring: { state: "curled" },
	pinky: { state: "curled" },
});

const OPEN_PALM = makeHand({
	index: { state: "extended", angle: -8 },
	middle: { state: "extended", angle: -2 },
	ring: { state: "extended", angle: 4 },
	pinky: { state: "extended", angle: 12 },
});

const INDEX_ONLY = makeHand({
	index: { state: "extended", angle: 0 },
	middle: { state: "curled" },
	ring: { state: "curled" },
	pinky: { state: "curled" },
});

// Two fingers up but held together - a "scissors closed" / two-finger point.
const NARROW_SPREAD = makeHand({
	index: { state: "extended", angle: -3 },
	middle: { state: "extended", angle: 0 },
	ring: { state: "curled" },
	pinky: { state: "curled" },
});

function transform(
	hand: HandLandmark[],
	fn: (p: HandLandmark) => HandLandmark,
): HandLandmark[] {
	return hand.map(fn);
}

describe("isVSign", () => {
	it("accepts a V", () => {
		expect(isVSign(V_SIGN)).toBe(true);
	});

	it("rejects a fist", () => {
		expect(isVSign(FIST)).toBe(false);
	});

	it("rejects an open palm", () => {
		expect(isVSign(OPEN_PALM)).toBe(false);
	});

	it("rejects a single extended index finger", () => {
		expect(isVSign(INDEX_ONLY)).toBe(false);
	});

	it("rejects two fingers up but not spread", () => {
		expect(isVSign(NARROW_SPREAD)).toBe(false);
	});

	it("rejects a hand with too few landmarks", () => {
		expect(isVSign(V_SIGN.slice(0, 10))).toBe(false);
	});

	it("rejects missing landmarks", () => {
		expect(isVSign(undefined)).toBe(false);
		expect(isVSign(null)).toBe(false);
		expect(isVSign([])).toBe(false);
	});

	it("is scale invariant - a hand further from the camera still reads", () => {
		const small = transform(V_SIGN, (p) => ({
			x: p.x * 0.25,
			y: p.y * 0.25,
			z: p.z * 0.25,
		}));
		expect(isVSign(small)).toBe(true);
	});

	it("is rotation invariant - a sideways V still reads", () => {
		// Rotate 90 degrees about the origin: (x, y) -> (-y, x)
		const sideways = transform(V_SIGN, (p) => ({
			x: -p.y,
			y: p.x,
			z: p.z,
		}));
		expect(isVSign(sideways)).toBe(true);
	});

	it("reads a mirrored (left) hand", () => {
		const mirrored = transform(V_SIGN, (p) => ({ ...p, x: 1 - p.x }));
		expect(isVSign(mirrored)).toBe(true);
	});

	it("uses exactly 21 landmarks", () => {
		expect(V_SIGN).toHaveLength(HAND_LANDMARK_COUNT);
	});
});

describe("fingerSpreadDegrees", () => {
	const INDEX = { mcp: 5, tip: 8 };
	const MIDDLE = { mcp: 9, tip: 12 };

	it("measures the V wide enough to pass the threshold", () => {
		const spread = fingerSpreadDegrees(V_SIGN, INDEX, MIDDLE);
		expect(spread).toBeGreaterThan(V_SIGN_THRESHOLDS.MIN_SPREAD_DEG);
		// Sanity: the synthetic hand was built with a 28 degree fan.
		expect(spread).toBeCloseTo(28, 0);
	});

	it("measures near-parallel fingers below the threshold", () => {
		expect(fingerSpreadDegrees(NARROW_SPREAD, INDEX, MIDDLE)).toBeLessThan(
			V_SIGN_THRESHOLDS.MIN_SPREAD_DEG,
		);
	});
});

describe("anyHandIsVSign", () => {
	it("is false with no hands", () => {
		expect(anyHandIsVSign([])).toBe(false);
		expect(anyHandIsVSign(undefined)).toBe(false);
	});

	it("is true when either hand holds the V", () => {
		expect(anyHandIsVSign([FIST, V_SIGN])).toBe(true);
		expect(anyHandIsVSign([V_SIGN, FIST])).toBe(true);
	});

	it("is false when neither hand holds the V", () => {
		expect(anyHandIsVSign([FIST, OPEN_PALM])).toBe(false);
	});
});
