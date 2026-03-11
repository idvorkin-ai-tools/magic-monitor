import { describe, expect, it } from "vitest";
import { nms, parseYoloOutput } from "./CardDetectorService";
import type { CardDetection } from "../types/cards";

describe("nms", () => {
	it("keeps non-overlapping detections", () => {
		const detections: CardDetection[] = [
			{
				card: { rank: "A", suit: "\u2660" },
				label: "A\u2660",
				bbox: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 },
				confidence: 0.9,
			},
			{
				card: { rank: "K", suit: "\u2665" },
				label: "K\u2665",
				bbox: { x: 0.8, y: 0.8, width: 0.1, height: 0.1 },
				confidence: 0.8,
			},
		];

		const result = nms(detections);
		expect(result).toHaveLength(2);
	});

	it("removes overlapping detection with lower confidence", () => {
		const detections: CardDetection[] = [
			{
				card: { rank: "A", suit: "\u2660" },
				label: "A\u2660",
				bbox: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 },
				confidence: 0.9,
			},
			{
				card: { rank: "K", suit: "\u2665" },
				label: "K\u2665",
				bbox: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 },
				confidence: 0.7,
			},
		];

		const result = nms(detections);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("A\u2660");
	});

	it("returns empty array for empty input", () => {
		expect(nms([])).toEqual([]);
	});
});

describe("parseYoloOutput", () => {
	it("returns empty array when no detections above threshold", () => {
		// Create a minimal output: 56 rows x 2 predictions, all scores near 0
		const numPredictions = 2;
		const rows = 4 + 52; // 56
		const data = new Float32Array(rows * numPredictions);

		// Set bbox values (pixel coords relative to 416x416)
		// Prediction 0: cx=100, cy=100, w=50, h=50
		data[0 * numPredictions + 0] = 100;
		data[1 * numPredictions + 0] = 100;
		data[2 * numPredictions + 0] = 50;
		data[3 * numPredictions + 0] = 50;

		// All class scores stay at 0 (below threshold)

		const result = parseYoloOutput(data, numPredictions, 0.5, 416, 416);
		expect(result).toHaveLength(0);
	});

	it("detects card above confidence threshold", () => {
		const numPredictions = 1;
		const rows = 4 + 52;
		const data = new Float32Array(rows * numPredictions);

		// Bbox: center at (208, 208), size 100x100 (in 416x416 space)
		data[0] = 208; // cx
		data[1] = 208; // cy
		data[2] = 100; // w
		data[3] = 100; // h

		// PD-Mera class 39 = AS (Ace of Spades)
		data[4 + 39] = 0.95;

		const result = parseYoloOutput(data, numPredictions, 0.5, 416, 416);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("A♠");
		expect(result[0].confidence).toBeCloseTo(0.95);
		// Normalized bbox
		expect(result[0].bbox.x).toBeCloseTo(208 / 416);
		expect(result[0].bbox.y).toBeCloseTo(208 / 416);
		expect(result[0].bbox.width).toBeCloseTo(100 / 416);
		expect(result[0].bbox.height).toBeCloseTo(100 / 416);
	});

	it("picks highest scoring class", () => {
		const numPredictions = 1;
		const data = new Float32Array((4 + 52) * numPredictions);

		data[0] = 100;
		data[1] = 100;
		data[2] = 50;
		data[3] = 50;

		// PD-Mera class 38 = AH (Ace of Hearts) — higher score
		data[4 + 38] = 0.85;
		// PD-Mera class 39 = AS (Ace of Spades) — lower score
		data[4 + 39] = 0.6;

		const result = parseYoloOutput(data, numPredictions, 0.5, 416, 416);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("A♥");
		expect(result[0].confidence).toBeCloseTo(0.85);
	});
});
