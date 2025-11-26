import { useCallback, useEffect, useState } from "react";
import * as CameraService from "../services/CameraService";

export function useCamera(initialDeviceId?: string) {
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
		initialDeviceId || "",
	);

	const getDevices = useCallback(async () => {
		const videoDevices = await CameraService.getVideoDevices();
		setDevices(videoDevices);

		// If we have devices but none selected, pick the first one
		if (videoDevices.length > 0 && !selectedDeviceId) {
			setSelectedDeviceId(videoDevices[0].deviceId);
		}
	}, [selectedDeviceId]);

	// Handle device changes
	useEffect(() => {
		getDevices();

		const handleDeviceChange = () => {
			getDevices();
		};

		navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
		return () => {
			navigator.mediaDevices.removeEventListener(
				"devicechange",
				handleDeviceChange,
			);
		};
	}, [getDevices]);

	// Handle stream lifecycle
	useEffect(() => {
		let isActive = true;
		let currentStream: MediaStream | null = null;

		async function setupCamera() {
			try {
				// Stop previous stream if any
				if (stream) {
					CameraService.stop(stream);
				}

				const newStream = await CameraService.start(
					selectedDeviceId || undefined,
				);

				if (!isActive) {
					CameraService.stop(newStream);
					return;
				}

				currentStream = newStream;
				setStream(newStream);
				setError(null);

				// Refresh device list to get labels after permission grant
				getDevices();

				// Update selected device ID if not set
				if (!selectedDeviceId) {
					const videoTrack = newStream.getVideoTracks()[0];
					if (videoTrack) {
						const settings = videoTrack.getSettings();
						if (settings.deviceId) {
							setSelectedDeviceId(settings.deviceId);
						}
					}
				}
			} catch (err) {
				if (isActive) {
					console.error("Error accessing camera:", err);
					setError("Could not access camera. Please allow permissions.");
					setStream(null);
				}
			}
		}

		setupCamera();

		return () => {
			isActive = false;
			if (currentStream) {
				CameraService.stop(currentStream);
			}
		};
	}, [selectedDeviceId, getDevices, stream]); // Re-run when selected device changes

	return {
		stream,
		error,
		devices,
		selectedDeviceId,
		setSelectedDeviceId,
	};
}
