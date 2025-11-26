export async function getVideoDevices(): Promise<MediaDeviceInfo[]> {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter((device) => device.kind === "videoinput");
	} catch (error) {
		console.error("Error enumerating devices:", error);
		return [];
	}
}

export async function start(deviceId?: string): Promise<MediaStream> {
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
