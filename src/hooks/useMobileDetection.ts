import { useEffect, useState } from "react";
import {
	DeviceService,
	type DeviceServiceType,
} from "../services/DeviceService";

interface MobileDetectionResult {
	isMobile: boolean;
	isLowMemory: boolean;
	deviceMemoryGB: number | null;
	screenWidth: number;
}

/**
 * Detects mobile devices and low-memory conditions.
 * Uses screen size, touch capability, and device memory API.
 */
export function useMobileDetection(
	service: DeviceServiceType = DeviceService,
): MobileDetectionResult {
	const [state, setState] = useState<MobileDetectionResult>(() =>
		detectDevice(service),
	);

	useEffect(() => {
		const handleResize = () => {
			setState(detectDevice(service));
		};

		return service.addResizeListener(handleResize);
	}, [service]);

	return state;
}

function detectDevice(service: DeviceServiceType): MobileDetectionResult {
	const screenWidth = service.getScreenWidth();
	const deviceMemoryGB = service.getDeviceMemoryGB();
	const isTouchDevice = service.isTouchDevice();

	// Consider "mobile" if:
	// 1. Small screen (<768px) OR
	// 2. Touch-primary device with medium screen (<1024px)
	const isSmallScreen = screenWidth < 768;
	const isMediumTouchScreen = isTouchDevice && screenWidth < 1024;

	const isMobile = isSmallScreen || isMediumTouchScreen;

	// Consider "low memory" if:
	// 1. Device memory API reports < 4GB (primary signal)
	// 2. Fall back to mobile detection only if deviceMemory API unavailable
	const isLowMemory = deviceMemoryGB !== null ? deviceMemoryGB < 4 : isMobile;

	return {
		isMobile,
		isLowMemory,
		deviceMemoryGB,
		screenWidth,
	};
}
