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

export async function start(deviceId?: string): Promise<MediaStream> {
	if (!isSecureContext()) {
		throw new InsecureContextError();
	}

	const constraints: MediaStreamConstraints = {
		video: {
			width: { ideal: 1920 },
			height: { ideal: 1080 },
			frameRate: { ideal: 30 },
			deviceId: deviceId ? { exact: deviceId } : undefined,
		},
	};

	console.log("Requesting camera with constraints:", constraints);
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
