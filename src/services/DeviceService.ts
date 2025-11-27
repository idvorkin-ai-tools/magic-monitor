/**
 * Humble Object for device/browser detection APIs.
 * Isolates navigator and window calls for testability.
 */
export const DeviceService = {
	getScreenWidth(): number {
		return window.innerWidth;
	},

	getDeviceMemoryGB(): number | null {
		if ("deviceMemory" in navigator) {
			return (navigator as { deviceMemory?: number }).deviceMemory ?? null;
		}
		return null;
	},

	isTouchDevice(): boolean {
		return "ontouchstart" in window || navigator.maxTouchPoints > 0;
	},

	addResizeListener(callback: () => void): () => void {
		window.addEventListener("resize", callback);
		return () => window.removeEventListener("resize", callback);
	},

	getStorageItem(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},

	setStorageItem(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch {
			// localStorage not available
		}
	},
};

export type DeviceServiceType = typeof DeviceService;
