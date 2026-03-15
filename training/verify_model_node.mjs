/**
 * Verify the YOLO26n card detector using onnxruntime-node (no browser needed).
 *
 * Tests that the JS parseYoloOutput logic matches real model output,
 * using the same test images as the Python verification script.
 *
 * Usage:
 *   cd training/
 *   npx --yes --package=onnxruntime-node node verify_model_node.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join, basename, extname } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ort = require("onnxruntime-node");

// Must match src/types/cards.ts DATASET_LABELS (alphabetical Roboflow order)
const DATASET_LABELS = [
	"10C","10D","10H","10S","2C","2D","2H","2S","3C","3D","3H","3S",
	"4C","4D","4H","4S","5C","5D","5H","5S","6C","6D","6H","6S",
	"7C","7D","7H","7S","8C","8D","8H","8S","9C","9D","9H","9S",
	"AC","AD","AH","AS","JC","JD","JH","JS","KC","KD","KH","KS",
	"QC","QD","QH","QS",
];

const MODEL_PATH = "card-detector.onnx";
const TEST_IMAGES = "dataset/test/images";
const TEST_LABELS = "dataset/test/labels";
const MODEL_INPUT_SIZE = 416;
const CONF_THRESHOLD = 0.5;

/**
 * Parse [1, 300, 6] output — same logic as CardDetectorService.parseYoloOutput
 */
function parseDetections(outputData, numDetections, confThreshold) {
	const detections = [];
	for (let i = 0; i < numDetections; i++) {
		const offset = i * 6;
		const x1 = outputData[offset];
		const y1 = outputData[offset + 1];
		const x2 = outputData[offset + 2];
		const y2 = outputData[offset + 3];
		const confidence = outputData[offset + 4];
		const classId = Math.round(outputData[offset + 5]);

		if (confidence < confThreshold) continue;
		if (classId < 0 || classId >= DATASET_LABELS.length) continue;

		detections.push({ label: DATASET_LABELS[classId], confidence, x1, y1, x2, y2 });
	}
	return detections;
}

/**
 * Parse YOLO label file → list of class labels
 */
function parseLabels(labelPath) {
	try {
		const text = readFileSync(labelPath, "utf-8");
		return text.trim().split("\n").filter(Boolean).map((line) => {
			const classId = parseInt(line.split(" ")[0], 10);
			return DATASET_LABELS[classId];
		});
	} catch {
		return [];
	}
}

/**
 * Load image as RGB float32 tensor [1, 3, 416, 416] using raw pixel decoding.
 * We use sharp-free BMP-style approach: decode JPEG via onnxruntime's built-in,
 * or fall back to a simple canvas-free resize.
 *
 * Since we don't have sharp/canvas in Node, we'll use the model on a dummy
 * input per-image won't give correct detections. Instead, we batch-verify
 * by loading real images with jimp-style pure-JS decoder.
 */

async function main() {
	console.log("Loading ONNX model...");
	const session = await ort.InferenceSession.create(MODEL_PATH, {
		executionProviders: ["cpu"],
	});

	const inputName = session.inputNames[0];
	const outputName = session.outputNames[0];
	console.log(`Input: ${inputName}, Output: ${outputName}`);

	// Get input/output shapes from a dummy run
	const dummyInput = new ort.Tensor("float32", new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE), [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
	const dummyResult = await session.run({ [inputName]: dummyInput });
	const outputDims = dummyResult[outputName].dims;
	console.log(`Output shape: [${outputDims}]`);

	// Verify output format matches expectations
	const expectedDims = [1, 300, 6];
	const dimsMatch = outputDims.length === 3 && outputDims[1] === 300 && outputDims[2] === 6;
	console.log(`Output format check: ${dimsMatch ? "PASS" : "FAIL"} (expected [1, 300, 6], got [${outputDims}])`);

	if (!dimsMatch) {
		console.error("Output format mismatch! The JS parser expects [1, 300, 6].");
		process.exit(1);
	}

	// Try to load real images if jpeg-js is available
	let jpegDecode;
	try {
		jpegDecode = require("jpeg-js").decode;
	} catch {
		console.log("\nInstall jpeg-js for full image verification:");
		console.log("  npx --yes --package=onnxruntime-node --package=jpeg-js node verify_model_node.mjs\n");
		console.log("Running parser-only verification with dummy data...\n");
		verifyParserOnly(dummyResult[outputName].data, outputDims[1]);
		return;
	}

	// Full verification with real images
	const imageFiles = readdirSync(TEST_IMAGES).filter((f) => f.endsWith(".jpg")).sort();
	console.log(`\nRunning inference on ${imageFiles.length} test images...\n`);

	let total = 0;
	let correct = 0;
	let missed = 0;
	let falsePositives = 0;

	for (const imgFile of imageFiles) {
		const imgPath = join(TEST_IMAGES, imgFile);
		const imgBuf = readFileSync(imgPath);
		const { data: rgba, width, height } = jpegDecode(imgBuf);

		// Resize to 416x416 using nearest-neighbor (simple, no dependencies)
		const resized = resizeNearest(rgba, width, height, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

		// Convert to [1, 3, H, W] float32 normalized
		const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
		const float32 = new Float32Array(3 * numPixels);
		for (let i = 0; i < numPixels; i++) {
			float32[i] = resized[i * 4] / 255;                    // R
			float32[numPixels + i] = resized[i * 4 + 1] / 255;    // G
			float32[2 * numPixels + i] = resized[i * 4 + 2] / 255; // B
		}

		const inputTensor = new ort.Tensor("float32", float32, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
		const results = await session.run({ [inputName]: inputTensor });
		const output = results[outputName];
		const dets = parseDetections(output.data, output.dims[1], CONF_THRESHOLD);

		// Ground truth
		const baseName = basename(imgFile, extname(imgFile));
		const labelPath = join(TEST_LABELS, baseName + ".txt");
		const gtLabels = parseLabels(labelPath);

		// Class-level matching
		const predLabels = dets.map((d) => d.label).sort();
		const gtSorted = [...gtLabels].sort();

		const remainingPreds = [...predLabels];
		for (const gt of gtSorted) {
			total++;
			const idx = remainingPreds.indexOf(gt);
			if (idx >= 0) {
				correct++;
				remainingPreds.splice(idx, 1);
			} else {
				missed++;
			}
		}
		falsePositives += remainingPreds.length;
	}

	console.log("=".repeat(50));
	console.log("Card Detector Node.js Verification Results");
	console.log("=".repeat(50));
	console.log(`Test images:        ${imageFiles.length}`);
	console.log(`Ground truth cards: ${total}`);
	console.log(`Correct detections: ${correct}`);
	console.log(`Missed:             ${missed}`);
	console.log(`False positives:    ${falsePositives}`);
	if (total > 0) {
		const recall = (correct / total * 100).toFixed(1);
		const precision = (correct + falsePositives) > 0
			? (correct / (correct + falsePositives) * 100).toFixed(1)
			: "0.0";
		console.log(`Recall:             ${recall}%`);
		console.log(`Precision:          ${precision}%`);
	}
	console.log("=".repeat(50));

	// Show sample detections
	console.log("\nSample detections (first 5 images):");
	for (const imgFile of imageFiles.slice(0, 5)) {
		const imgPath = join(TEST_IMAGES, imgFile);
		const imgBuf = readFileSync(imgPath);
		const { data: rgba, width, height } = jpegDecode(imgBuf);
		const resized = resizeNearest(rgba, width, height, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

		const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
		const float32 = new Float32Array(3 * numPixels);
		for (let i = 0; i < numPixels; i++) {
			float32[i] = resized[i * 4] / 255;
			float32[numPixels + i] = resized[i * 4 + 1] / 255;
			float32[2 * numPixels + i] = resized[i * 4 + 2] / 255;
		}

		const inputTensor = new ort.Tensor("float32", float32, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
		const results = await session.run({ [inputName]: inputTensor });
		const dets = parseDetections(results[outputName].data, results[outputName].dims[1], CONF_THRESHOLD);

		const baseName = basename(imgFile, extname(imgFile));
		const gtLabels = parseLabels(join(TEST_LABELS, baseName + ".txt"));

		const predStr = dets.map((d) => `${d.label}(${d.confidence.toFixed(2)})`).join(", ");
		console.log(`  ${imgFile.slice(0, 35).padEnd(35)} GT: [${gtLabels}]  Pred: [${predStr}]`);
	}
}

/**
 * Nearest-neighbor resize for RGBA buffer
 */
function resizeNearest(rgba, srcW, srcH, dstW, dstH) {
	const dst = new Uint8Array(dstW * dstH * 4);
	for (let y = 0; y < dstH; y++) {
		const srcY = Math.floor(y * srcH / dstH);
		for (let x = 0; x < dstW; x++) {
			const srcX = Math.floor(x * srcW / dstW);
			const srcIdx = (srcY * srcW + srcX) * 4;
			const dstIdx = (y * dstW + x) * 4;
			dst[dstIdx] = rgba[srcIdx];
			dst[dstIdx + 1] = rgba[srcIdx + 1];
			dst[dstIdx + 2] = rgba[srcIdx + 2];
			dst[dstIdx + 3] = rgba[srcIdx + 3];
		}
	}
	return dst;
}

/**
 * Verify just the parser logic without real images
 */
function verifyParserOnly(outputData, numDetections) {
	const dets = parseDetections(outputData, numDetections, 0.01);
	console.log(`Dummy input produced ${dets.length} detections above 0.01 (expected: ~0 on random noise)`);

	// Verify parser handles synthetic data correctly
	const synthetic = new Float32Array(300 * 6);
	// Inject a fake detection: 8S at high confidence
	synthetic[0] = 280; synthetic[1] = 110; synthetic[2] = 320; synthetic[3] = 140;
	synthetic[4] = 0.91; synthetic[5] = 31; // 8S
	// Second: 7S
	synthetic[6] = 250; synthetic[7] = 160; synthetic[8] = 290; synthetic[9] = 190;
	synthetic[10] = 0.87; synthetic[11] = 27; // 7S

	const parsed = parseDetections(synthetic, 300, 0.5);
	console.log(`Synthetic test: ${parsed.length} detections (expected: 2)`);
	for (const d of parsed) {
		console.log(`  ${d.label} conf=${d.confidence.toFixed(2)} box=[${d.x1.toFixed(0)},${d.y1.toFixed(0)},${d.x2.toFixed(0)},${d.y2.toFixed(0)}]`);
	}

	const pass = parsed.length === 2 && parsed[0].label === "8S" && parsed[1].label === "7S";
	console.log(`\nParser verification: ${pass ? "PASS" : "FAIL"}`);
}

main().catch(console.error);
