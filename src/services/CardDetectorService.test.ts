import { describe, expect, it } from "vitest";
import { nms, parseYoloOutput, type LetterboxInfo } from "./CardDetectorService";
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
	// Output format: [1, 300, 6] flattened, each detection = [x1, y1, x2, y2, conf, class_id]

	// No letterbox padding (square source, fills entire model input)
	const noLetterbox: LetterboxInfo = { offsetX: 0, offsetY: 0, scaledW: 416, scaledH: 416 };

	// 16:9 source letterboxed into 416x416: image is 416x234 centered, with 91px padding top/bottom
	const wideLetterbox: LetterboxInfo = {
		offsetX: 0,
		offsetY: Math.floor((416 - 234) / 2), // 91
		scaledW: 416,
		scaledH: 234,
	};

	it("returns empty array when no detections above threshold", () => {
		const data = new Float32Array(2 * 6);
		data[0] = 50; data[1] = 50; data[2] = 100; data[3] = 100; data[4] = 0.1; data[5] = 0;

		const result = parseYoloOutput(data, 2, 0.5, noLetterbox);
		expect(result).toHaveLength(0);
	});

	it("detects card above confidence threshold (no letterbox)", () => {
		// class 39 = AS (Ace of Spades) in alphabetical dataset order
		const data = new Float32Array(1 * 6);
		data[0] = 100; // x1
		data[1] = 100; // y1
		data[2] = 200; // x2
		data[3] = 200; // y2
		data[4] = 0.95; // confidence
		data[5] = 39; // class_id = AS

		const result = parseYoloOutput(data, 1, 0.5, noLetterbox);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("A\u2660");
		expect(result[0].confidence).toBeCloseTo(0.95);
		// Center = (150, 150), size = (100, 100), normalized by 416
		expect(result[0].bbox.x).toBeCloseTo(150 / 416);
		expect(result[0].bbox.y).toBeCloseTo(150 / 416);
		expect(result[0].bbox.width).toBeCloseTo(100 / 416);
		expect(result[0].bbox.height).toBeCloseTo(100 / 416);
	});

	it("undoes letterbox padding for wide video", () => {
		// Detection at model-pixel (208, 208) — center of 416x416.
		// With wideLetterbox (offsetY=91, scaledH=234), the image center is at y=91+117=208.
		// So model-pixel 208 maps to video-normalized y = (208-91)/234 = 0.5
		const data = new Float32Array(1 * 6);
		data[0] = 158; // x1
		data[1] = 158; // y1
		data[2] = 258; // x2
		data[3] = 258; // y2
		data[4] = 0.9;
		data[5] = 39; // AS

		const result = parseYoloOutput(data, 1, 0.5, wideLetterbox);
		expect(result).toHaveLength(1);
		// cx = (158+258)/2 = 208, undone: (208-0)/416 = 0.5
		expect(result[0].bbox.x).toBeCloseTo(208 / 416);
		// cy = (158+258)/2 = 208, undone: (208-91)/234 ≈ 0.5
		expect(result[0].bbox.y).toBeCloseTo((208 - 91) / 234);
	});

	it("filters detections in letterbox padding area", () => {
		// Detection entirely in the top padding bar (y < offsetY)
		const data = new Float32Array(1 * 6);
		data[0] = 100; data[1] = 10; data[2] = 150; data[3] = 50;
		data[4] = 0.9; data[5] = 39;

		const result = parseYoloOutput(data, 1, 0.5, wideLetterbox);
		// cy = (10+50)/2 = 30, undone: (30-91)/234 = -0.26 → filtered out
		expect(result).toHaveLength(0);
	});

	it("picks correct class from class_id", () => {
		const data = new Float32Array(1 * 6);
		data[0] = 50; data[1] = 50; data[2] = 100; data[3] = 100;
		data[4] = 0.85;
		data[5] = 38; // class 38 = AH (Ace of Hearts)

		const result = parseYoloOutput(data, 1, 0.5, noLetterbox);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("A\u2665");
		expect(result[0].confidence).toBeCloseTo(0.85);
	});

	it("handles multiple detections", () => {
		const data = new Float32Array(3 * 6);
		// det 0: 8S (class 31), high conf
		data[0] = 280; data[1] = 110; data[2] = 320; data[3] = 140;
		data[4] = 0.91; data[5] = 31;
		// det 1: 7S (class 27), high conf
		data[6] = 250; data[7] = 160; data[8] = 290; data[9] = 190;
		data[10] = 0.87; data[11] = 27;
		// det 2: low conf, should be filtered
		data[12] = 100; data[13] = 100; data[14] = 150; data[15] = 150;
		data[16] = 0.03; data[17] = 0;

		const result = parseYoloOutput(data, 3, 0.5, noLetterbox);
		expect(result).toHaveLength(2);
		expect(result.map((d) => d.label).sort()).toEqual(["7\u2660", "8\u2660"]);
	});
});
