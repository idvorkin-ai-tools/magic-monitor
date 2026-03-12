import { describe, expect, it } from "vitest";
import { parseYoloOutput } from "./CardDetectorService";

describe("parseYoloOutput", () => {
	// YOLO26 output: row-major [N, 56] where each row is [cx, cy, w, h, ...52 class scores]
	const STRIDE = 4 + 52;

	it("returns empty array when no detections above threshold", () => {
		const numPredictions = 2;
		const data = new Float32Array(numPredictions * STRIDE);

		// Set bbox values but leave class scores at 0
		data[0] = 100; // cx
		data[1] = 100; // cy
		data[2] = 50; // w
		data[3] = 50; // h

		const result = parseYoloOutput(data, numPredictions, 0.5, 640, 640);
		expect(result).toHaveLength(0);
	});

	it("detects card above confidence threshold", () => {
		const numPredictions = 1;
		const data = new Float32Array(numPredictions * STRIDE);

		// Bbox: center at (320, 320), size 100x100 (in 640x640 space)
		data[0] = 320; // cx
		data[1] = 320; // cy
		data[2] = 100; // w
		data[3] = 100; // h

		// PD-Mera class 39 = AS (Ace of Spades)
		data[4 + 39] = 0.95;

		const result = parseYoloOutput(data, numPredictions, 0.5, 640, 640);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("A♠");
		expect(result[0].confidence).toBeCloseTo(0.95);
		// Normalized bbox
		expect(result[0].bbox.x).toBeCloseTo(320 / 640);
		expect(result[0].bbox.y).toBeCloseTo(320 / 640);
		expect(result[0].bbox.width).toBeCloseTo(100 / 640);
		expect(result[0].bbox.height).toBeCloseTo(100 / 640);
	});

	it("picks highest scoring class", () => {
		const numPredictions = 1;
		const data = new Float32Array(numPredictions * STRIDE);

		data[0] = 100;
		data[1] = 100;
		data[2] = 50;
		data[3] = 50;

		// PD-Mera class 38 = AH (Ace of Hearts) — higher score
		data[4 + 38] = 0.85;
		// PD-Mera class 39 = AS (Ace of Spades) — lower score
		data[4 + 39] = 0.6;

		const result = parseYoloOutput(data, numPredictions, 0.5, 640, 640);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("A♥");
		expect(result[0].confidence).toBeCloseTo(0.85);
	});

	it("returns multiple detections", () => {
		const numPredictions = 2;
		const data = new Float32Array(numPredictions * STRIDE);

		// Detection 0
		data[0] = 100;
		data[1] = 100;
		data[2] = 50;
		data[3] = 50;
		data[4 + 39] = 0.9; // A♠

		// Detection 1
		data[STRIDE + 0] = 400;
		data[STRIDE + 1] = 400;
		data[STRIDE + 2] = 60;
		data[STRIDE + 3] = 60;
		data[STRIDE + 4 + 0] = 0.8; // 10♣

		const result = parseYoloOutput(data, numPredictions, 0.5, 640, 640);
		expect(result).toHaveLength(2);
	});
});
