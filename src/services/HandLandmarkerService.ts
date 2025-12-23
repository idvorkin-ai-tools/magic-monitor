/**
 * Singleton service for MediaPipe HandLandmarker model.
 *
 * The model takes 3-5 seconds to download and initialize. This service
 * ensures the model is loaded once and shared across all components
 * (CameraStage, ReplayView) instead of reloading on every mount.
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export type LoadingPhase = "idle" | "downloading" | "initializing" | "ready" | "error";

export interface LoadingState {
	phase: LoadingPhase;
	progress: number; // 0-100 for downloading phase
	error?: Error;
}

type LoadingListener = (state: LoadingState) => void;

class HandLandmarkerServiceImpl {
	private model: HandLandmarker | null = null;
	private loadingState: LoadingState = { phase: "idle", progress: 0 };
	private loadPromise: Promise<HandLandmarker | null> | null = null;
	private listeners: Set<LoadingListener> = new Set();

	/**
	 * Get the current loading state
	 */
	getState(): LoadingState {
		return this.loadingState;
	}

	/**
	 * Get the model if loaded, or null if not ready
	 */
	getModel(): HandLandmarker | null {
		return this.model;
	}

	/**
	 * Subscribe to loading state changes
	 */
	subscribe(listener: LoadingListener): () => void {
		this.listeners.add(listener);
		// Immediately notify with current state
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

	/**
	 * Load the model if not already loaded/loading.
	 * Returns a promise that resolves when the model is ready.
	 * Safe to call multiple times - subsequent calls return the same promise.
	 */
	async load(): Promise<HandLandmarker | null> {
		// Already loaded
		if (this.model) {
			return this.model;
		}

		// Already loading - return existing promise
		if (this.loadPromise) {
			return this.loadPromise;
		}

		// Start loading
		this.loadPromise = this.loadModel();
		return this.loadPromise;
	}

	private async loadModel(): Promise<HandLandmarker | null> {
		try {
			this.updateState({ phase: "downloading", progress: 0 });

			// Use local WASM files for offline support
			const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

			// Fetch model with progress tracking
			const response = await fetch("/mediapipe/hand_landmarker.task");
			const contentLength = response.headers.get("Content-Length");
			const total = contentLength ? parseInt(contentLength, 10) : 0;

			if (!response.body) {
				throw new Error("Response body is null");
			}

			const reader = response.body.getReader();
			let receivedLength = 0;
			const chunks: Uint8Array[] = [];

			// Read chunks and track progress
			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				chunks.push(value);
				receivedLength += value.length;

				// Update progress (0-100%)
				if (total > 0) {
					this.updateState({ progress: Math.round((receivedLength / total) * 100) });
				}
			}

			// Combine chunks into single Uint8Array
			const modelBuffer = new Uint8Array(receivedLength);
			let position = 0;
			for (const chunk of chunks) {
				modelBuffer.set(chunk, position);
				position += chunk.length;
			}

			// Download complete, now initializing model
			this.updateState({ phase: "initializing", progress: 100 });

			// Create HandLandmarker with GPU delegate specified during creation
			console.log("[HandLandmarkerService] Creating HandLandmarker with GPU delegate...");
			this.model = await HandLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetBuffer: modelBuffer,
					delegate: "GPU",
				},
				runningMode: "VIDEO",
				numHands: 2,
			});

			// Log WebGL availability for GPU delegate diagnostics
			const canvas = document.createElement("canvas");
			const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
			console.log("[HandLandmarkerService] WebGL available:", !!gl, gl ? `(${gl.getParameter(gl.VERSION)})` : "");
			// Clean up diagnostic canvas to prevent memory leak
			if (gl) {
				const loseContext = gl.getExtension("WEBGL_lose_context");
				loseContext?.loseContext();
			}
			console.log("[HandLandmarkerService] HandLandmarker initialized successfully");

			this.updateState({ phase: "ready" });
			return this.model;
		} catch (error) {
			console.error("[HandLandmarkerService] Error loading HandLandmarker:", error);
			this.updateState({ phase: "error", error: error as Error });
			this.loadPromise = null; // Allow retry
			return null;
		}
	}

	/**
	 * Check if the model is ready for use
	 */
	isReady(): boolean {
		return this.loadingState.phase === "ready" && this.model !== null;
	}

	/**
	 * Check if the model is currently loading
	 */
	isLoading(): boolean {
		return this.loadingState.phase === "downloading" || this.loadingState.phase === "initializing";
	}

	/**
	 * Reset the service state (for testing only).
	 * Closes any loaded model and resets to initial state.
	 */
	_reset(): void {
		if (this.model) {
			this.model.close();
			this.model = null;
		}
		this.loadingState = { phase: "idle", progress: 0 };
		this.loadPromise = null;
		this.listeners.clear();
	}
}

// Export singleton instance
export const HandLandmarkerService = new HandLandmarkerServiceImpl();
