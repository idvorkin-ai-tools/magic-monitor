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
	// Output format: [1, 300, 6] flattened, each detection = [x1, y1, x2, y2, conf, class_id]

	it("returns empty array when no detections above threshold", () => {
		// 2 detections, all with confidence 0
		const data = new Float32Array(2 * 6);
		// det 0: x1=50, y1=50, x2=100, y2=100, conf=0.1, class=0
		data[0] = 50; data[1] = 50; data[2] = 100; data[3] = 100; data[4] = 0.1; data[5] = 0;

		const result = parseYoloOutput(data, 2, 0.5, 416, 416);
		expect(result).toHaveLength(0);
	});

	it("detects card above confidence threshold", () => {
		// class 39 = AS (Ace of Spades) in alphabetical dataset order
		const data = new Float32Array(1 * 6);
		data[0] = 100; // x1
		data[1] = 100; // y1
		data[2] = 200; // x2
		data[3] = 200; // y2
		data[4] = 0.95; // confidence
		data[5] = 39; // class_id = AS

		const result = parseYoloOutput(data, 1, 0.5, 416, 416);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("A\u2660");
		expect(result[0].confidence).toBeCloseTo(0.95);
		// Center = (150, 150), size = (100, 100), normalized by 416
		expect(result[0].bbox.x).toBeCloseTo(150 / 416);
		expect(result[0].bbox.y).toBeCloseTo(150 / 416);
		expect(result[0].bbox.width).toBeCloseTo(100 / 416);
		expect(result[0].bbox.height).toBeCloseTo(100 / 416);
	});

	it("picks correct class from class_id", () => {
		const data = new Float32Array(1 * 6);
		data[0] = 50; data[1] = 50; data[2] = 100; data[3] = 100;
		data[4] = 0.85;
		data[5] = 38; // class 38 = AH (Ace of Hearts)

		const result = parseYoloOutput(data, 1, 0.5, 416, 416);
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

		const result = parseYoloOutput(data, 3, 0.5, 416, 416);
		expect(result).toHaveLength(2);
		expect(result.map((d) => d.label).sort()).toEqual(["7\u2660", "8\u2660"]);
	});
});
