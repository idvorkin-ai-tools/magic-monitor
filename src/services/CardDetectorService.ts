/**
 * Singleton service for YOLO26 playing card detection via ONNX Runtime Web.
 *
 * Uses YOLO26n (NMS-free, end-to-end) — the model outputs final detections
 * directly, no post-processing NMS needed.
 *
 * Mirrors HandLandmarkerService: loads model once, shares across components,
 * exposes loading state via subscribe pattern.
 */
import * as ort from "onnxruntime-web";
import {
	NUM_CLASSES,
	cardToLabel,
	classIndexToCard,
	type CardDetection,
} from "../types/cards";

export type LoadingPhase = "idle" | "downloading" | "initializing" | "ready" | "error";

export interface LoadingState {
	phase: LoadingPhase;
	progress: number; // 0-100 for downloading phase
	error?: Error;
}

type LoadingListener = (state: LoadingState) => void;

// YOLO26n model input size (square)
const MODEL_INPUT_SIZE = 640;
const MODEL_PATH =
	"https://idvorkin-models.s3.us-west-2.amazonaws.com/card-detector.onnx";

/**
 * Parse YOLO26 output tensor into CardDetection[].
 *
 * YOLO26 end-to-end output shape: [1, N, 56] where:
 *   - N = number of detections (variable, model decides)
 *   - 56 = 4 bbox coords + 52 class scores
 *
 * Each row is one detection: [cx, cy, w, h, class0_score, class1_score, ...]
 * No NMS needed — YOLO26 outputs final deduplicated detections.
 */
export function parseYoloOutput(
	outputData: Float32Array,
	numPredictions: number,
	confidenceThreshold: number,
	inputWidth: number,
	inputHeight: number,
): CardDetection[] {
	const detections: CardDetection[] = [];
	const stride = 4 + NUM_CLASSES; // 56

	for (let i = 0; i < numPredictions; i++) {
		const offset = i * stride;

		// Find max class score for this detection
		let maxScore = 0;
		let maxClassIdx = 0;
		for (let c = 0; c < NUM_CLASSES; c++) {
			const score = outputData[offset + 4 + c];
			if (score > maxScore) {
				maxScore = score;
				maxClassIdx = c;
			}
		}

		if (maxScore < confidenceThreshold) continue;

		const card = classIndexToCard(maxClassIdx);
		if (!card) continue;

		// Extract bbox (center format, pixel coords relative to model input)
		const cx = outputData[offset + 0] / inputWidth;
		const cy = outputData[offset + 1] / inputHeight;
		const w = outputData[offset + 2] / inputWidth;
		const h = outputData[offset + 3] / inputHeight;

		detections.push({
			card,
			label: cardToLabel(card),
			bbox: { x: cx, y: cy, width: w, height: h },
			confidence: maxScore,
		});
	}

	return detections;
}

class CardDetectorServiceImpl {
	private session: ort.InferenceSession | null = null;
	private loadingState: LoadingState = { phase: "idle", progress: 0 };
	private loadPromise: Promise<ort.InferenceSession | null> | null = null;
	private listeners: Set<LoadingListener> = new Set();

	// Reusable canvas for preprocessing
	private preprocessCanvas: HTMLCanvasElement | null = null;
	private preprocessCtx: CanvasRenderingContext2D | null = null;

	getState(): LoadingState {
		return this.loadingState;
	}

	getSession(): ort.InferenceSession | null {
		return this.session;
	}

	subscribe(listener: LoadingListener): () => void {
		this.listeners.add(listener);
		listener(this.loadingState);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notifyListeners() {
		for (const listener of this.listeners) {
			listener(this.loadingState);
		}
	}

	private updateState(state: Partial<LoadingState>) {
		this.loadingState = { ...this.loadingState, ...state };
		this.notifyListeners();
	}

	async load(): Promise<ort.InferenceSession | null> {
		if (this.session) return this.session;
		if (this.loadPromise) return this.loadPromise;

		this.loadPromise = this.loadModel();
		return this.loadPromise;
	}

	private async loadModel(): Promise<ort.InferenceSession | null> {
		try {
			this.updateState({ phase: "downloading", progress: 0 });

			// Fetch model with progress tracking
			const response = await fetch(MODEL_PATH);

			if (!response.ok) {
				throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
			}

			const contentLength = response.headers.get("Content-Length");
			const total = contentLength ? parseInt(contentLength, 10) : 0;

			if (!response.body) {
				throw new Error("Response body is null");
			}

			const reader = response.body.getReader();
			let receivedLength = 0;
			const chunks: Uint8Array[] = [];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				chunks.push(value);
				receivedLength += value.length;

				if (total > 0) {
					this.updateState({ progress: Math.round((receivedLength / total) * 100) });
				}
			}

			const modelBuffer = new Uint8Array(receivedLength);
			let position = 0;
			for (const chunk of chunks) {
				modelBuffer.set(chunk, position);
				position += chunk.length;
			}

			this.updateState({ phase: "initializing", progress: 100 });

			console.log("[CardDetectorService] Creating ONNX inference session...");
			this.session = await ort.InferenceSession.create(modelBuffer.buffer, {
				executionProviders: ["webgl"],
				graphOptimizationLevel: "all",
			});

			console.log("[CardDetectorService] ONNX session created successfully");
			console.log("[CardDetectorService] Input names:", this.session.inputNames);
			console.log("[CardDetectorService] Output names:", this.session.outputNames);

			this.updateState({ phase: "ready" });
			return this.session;
		} catch (error) {
			console.error("[CardDetectorService] Error loading model:", error);
			this.updateState({ phase: "error", error: error as Error });
			this.loadPromise = null; // Allow retry
			return null;
		}
	}

	/**
	 * Run card detection on a video frame.
	 * Returns detections above the confidence threshold.
	 */
	async detect(
		source: HTMLVideoElement | HTMLCanvasElement,
		confidenceThreshold = 0.5,
	): Promise<CardDetection[]> {
		if (!this.session) return [];

		// Preprocess: resize to MODEL_INPUT_SIZE x MODEL_INPUT_SIZE
		if (!this.preprocessCanvas) {
			this.preprocessCanvas = document.createElement("canvas");
			this.preprocessCanvas.width = MODEL_INPUT_SIZE;
			this.preprocessCanvas.height = MODEL_INPUT_SIZE;
			this.preprocessCtx = this.preprocessCanvas.getContext("2d", { willReadFrequently: true });
		}

		const ctx = this.preprocessCtx;
		if (!ctx) return [];

		ctx.drawImage(source, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
		const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

		// Convert RGBA to RGB float32 tensor [1, 3, H, W] normalized to [0, 1]
		const { data } = imageData;
		const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
		const float32Data = new Float32Array(3 * numPixels);

		for (let i = 0; i < numPixels; i++) {
			float32Data[i] = data[i * 4] / 255; // R
			float32Data[numPixels + i] = data[i * 4 + 1] / 255; // G
			float32Data[2 * numPixels + i] = data[i * 4 + 2] / 255; // B
		}

		const inputTensor = new ort.Tensor("float32", float32Data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);

		const inputName = this.session.inputNames[0];
		const results = await this.session.run({ [inputName]: inputTensor });

		const outputName = this.session.outputNames[0];
		const output = results[outputName];
		const outputData = output.data as Float32Array;

		// YOLO26 end-to-end output: [1, N, 56] where N is number of detections
		const numPredictions = output.dims[1];

		return parseYoloOutput(outputData, numPredictions, confidenceThreshold, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
	}

	isReady(): boolean {
		return this.loadingState.phase === "ready" && this.session !== null;
	}

	isLoading(): boolean {
		return this.loadingState.phase === "downloading" || this.loadingState.phase === "initializing";
	}

	_reset(): void {
		this.session?.release();
		this.session = null;
		this.loadingState = { phase: "idle", progress: 0 };
		this.loadPromise = null;
		this.listeners.clear();
		this.preprocessCanvas = null;
		this.preprocessCtx = null;
	}
}

export const CardDetectorService = new CardDetectorServiceImpl();
