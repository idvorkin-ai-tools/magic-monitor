export type Resolution = "720p" | "1080p" | "4k";
export type Orientation = "landscape" | "portrait";

export const RESOLUTION_PRESETS: Record<Resolution, { width: number; height: number; label: string }> = {
	"720p": { width: 1280, height: 720, label: "720p (HD)" },
	"1080p": { width: 1920, height: 1080, label: "1080p (Full HD)" },
	"4k": { width: 3840, height: 2160, label: "4K (Ultra HD)" },
};

export interface CameraSettings {
	resolution: Resolution;
	orientation: Orientation;
}

export function isSecureContext(): boolean {
	return typeof navigator !== "undefined" && !!navigator.mediaDevices;
}

export async function getVideoDevices(): Promise<MediaDeviceInfo[]> {
	if (!isSecureContext()) {
		return [];
	}
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter((device) => device.kind === "videoinput");
	} catch (error) {
		console.error("Error enumerating devices:", error);
		return [];
	}
}

export class InsecureContextError extends Error {
	constructor() {
		super(
			"Camera requires HTTPS. Access this page via localhost or a secure connection.",
		);
		this.name = "InsecureContextError";
	}
}

export async function start(
	deviceId?: string,
	resolution: Resolution = "4k",
	orientation: Orientation = "landscape",
): Promise<MediaStream> {
	if (!isSecureContext()) {
		throw new InsecureContextError();
	}

	const preset = RESOLUTION_PRESETS[resolution];
	// Only request width - let camera use its native aspect ratio
	const targetWidth = orientation === "portrait" ? preset.height : preset.width;

	const constraints: MediaStreamConstraints = {
		video: {
			width: { ideal: targetWidth },
			// No height constraint - camera picks based on native aspect ratio
			frameRate: { ideal: 30 },
			deviceId: deviceId ? { exact: deviceId } : undefined,
		},
	};

	console.log(`[Camera] Requesting width: ${targetWidth} (camera picks height)`);
	return navigator.mediaDevices.getUserMedia(constraints);
}

export function stop(stream: MediaStream | null): void {
	if (!stream) return;
	stream.getTracks().forEach((track) => {
		track.stop();
	});
}

/**
 * Add a listener for device changes (cameras connected/disconnected).
 * Returns a cleanup function to remove the listener.
 */
export function addDeviceChangeListener(callback: () => void): () => void {
	if (!isSecureContext()) {
		// Return no-op cleanup if not in secure context
		return () => {};
	}
	navigator.mediaDevices.addEventListener("devicechange", callback);
	return () => {
		navigator.mediaDevices.removeEventListener("devicechange", callback);
	};
}
