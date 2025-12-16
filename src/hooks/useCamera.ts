import { useCallback, useEffect, useRef, useState } from "react";
import * as CameraService from "../services/CameraService";
import { InsecureContextError, type Orientation, type Resolution } from "../services/CameraService";
import * as CameraSettingsService from "../services/CameraSettingsService";
import { DeviceService } from "../services/DeviceService";

const DEVICE_ID_STORAGE_KEY = "magic-monitor-camera-device-id";

export function useCamera(initialDeviceId?: string) {
	const [stream, setStream] = useState<MediaStream | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
		initialDeviceId || DeviceService.getStorageItem(DEVICE_ID_STORAGE_KEY) || "",
	);

	// Load settings for currently selected device
	const [resolution, setResolution] = useState<Resolution>(() => {
		const deviceId = initialDeviceId || DeviceService.getStorageItem(DEVICE_ID_STORAGE_KEY) || "";
		return CameraSettingsService.getSettingsForDevice(deviceId).resolution;
	});
	const [orientation, setOrientation] = useState<Orientation>(() => {
		const deviceId = initialDeviceId || DeviceService.getStorageItem(DEVICE_ID_STORAGE_KEY) || "";
		return CameraSettingsService.getSettingsForDevice(deviceId).orientation;
	});

	const [retryCount, setRetryCount] = useState(0);

	const getDevices = useCallback(async () => {
		const videoDevices = await CameraService.getVideoDevices();
		setDevices(videoDevices);

		// If we have devices but none selected, pick the first one and load its settings
		if (videoDevices.length > 0 && !selectedDeviceId) {
			const deviceId = videoDevices[0].deviceId;
			setSelectedDeviceId(deviceId);
			DeviceService.setStorageItem(DEVICE_ID_STORAGE_KEY, deviceId);

			// Load settings for the auto-selected device
			const settings = CameraSettingsService.getSettingsForDevice(deviceId);
			setResolution(settings.resolution);
			setOrientation(settings.orientation);
		}
	}, [selectedDeviceId]);

	// Handle device changes - syncs with external device enumeration
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external device list
		getDevices();

		// Skip event listener if mediaDevices unavailable (insecure context)
		if (!navigator.mediaDevices) {
			return;
		}

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

		async function setupCamera() {
			try {
				// Stop previous stream if any (use ref to avoid dependency)
				if (streamRef.current) {
					CameraService.stop(streamRef.current);
				}

				const newStream = await CameraService.start(
					selectedDeviceId || undefined,
					resolution,
					orientation,
				);

				if (!isActive) {
					CameraService.stop(newStream);
					return;
				}

				streamRef.current = newStream;
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
							DeviceService.setStorageItem(DEVICE_ID_STORAGE_KEY, settings.deviceId);
						}
					}
				}
			} catch (err) {
				if (isActive) {
					console.error("Error accessing camera:", err);
					if (err instanceof InsecureContextError) {
						setError(err.message);
					} else {
						setError("Could not access camera. Please allow permissions.");
					}
					setStream(null);
				}
			}
		}

		setupCamera();

		return () => {
			isActive = false;
			if (streamRef.current) {
				CameraService.stop(streamRef.current);
				streamRef.current = null;
			}
		};
	}, [selectedDeviceId, resolution, orientation, getDevices, retryCount]); // Re-run when device/resolution/orientation changes

	// Wrap setter to persist selection and load device-specific settings
	const handleSetSelectedDeviceId = useCallback((deviceId: string) => {
		setSelectedDeviceId(deviceId);
		DeviceService.setStorageItem(DEVICE_ID_STORAGE_KEY, deviceId);

		// Load settings for the new device
		const settings = CameraSettingsService.getSettingsForDevice(deviceId);
		setResolution(settings.resolution);
		setOrientation(settings.orientation);
	}, []);

	// Wrap resolution setter to persist per-device
	const handleSetResolution = useCallback(
		(res: Resolution) => {
			setResolution(res);
			CameraSettingsService.updateSettingForDevice(selectedDeviceId, "resolution", res);
		},
		[selectedDeviceId],
	);

	// Wrap orientation setter to persist per-device
	const handleSetOrientation = useCallback(
		(orient: Orientation) => {
			setOrientation(orient);
			CameraSettingsService.updateSettingForDevice(selectedDeviceId, "orientation", orient);
		},
		[selectedDeviceId],
	);

	// Retry camera access - triggers re-run of the setup effect
	const retry = useCallback(() => {
		setError(null);
		setRetryCount((c) => c + 1);
	}, []);

	return {
		stream,
		error,
		devices,
		selectedDeviceId,
		setSelectedDeviceId: handleSetSelectedDeviceId,
		resolution,
		setResolution: handleSetResolution,
		orientation,
		setOrientation: handleSetOrientation,
		retry,
	};
}
