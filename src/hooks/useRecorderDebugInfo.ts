import { useMemo } from "react";
import {
	MediaRecorderService,
	type MediaRecorderServiceType,
} from "../services/MediaRecorderService";

export interface CodecSupport {
	mimeType: string;
	supported: boolean;
}

export interface RecorderDebugInfo {
	hasMediaRecorder: boolean;
	hasIsTypeSupported: boolean;
	selectedCodec: string;
	codecTests: CodecSupport[];
	userAgent: string;
	isIOS: boolean;
	isSafari: boolean;
	iosVersion: string | null;
}

/**
 * Hook that collects MediaRecorder debug info for troubleshooting.
 * Useful for debugging recording issues on different platforms (especially iOS).
 */
export function useRecorderDebugInfo(
	mediaRecorderService: MediaRecorderServiceType = MediaRecorderService,
): RecorderDebugInfo {
	return useMemo(() => {
		const userAgent = navigator.userAgent;
		const isIOS = /iPad|iPhone|iPod/.test(userAgent);
		const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

		// Extract iOS version
		const iosMatch = userAgent.match(/OS (\d+[_.]\d+)/);
		const iosVersion = iosMatch ? iosMatch[1].replace("_", ".") : null;

		const hasMediaRecorder = typeof MediaRecorder !== "undefined";
		const hasIsTypeSupported =
			hasMediaRecorder && typeof MediaRecorder.isTypeSupported === "function";

		// Test all codecs we try (including empty string which means "let browser pick")
		const codecsToTest = [
			"video/webm;codecs=vp9",
			"video/webm;codecs=vp8",
			"video/webm",
			"video/mp4;codecs=avc1.42E01E",
			"video/mp4;codecs=avc1.4d002a",
			"video/mp4;codecs=avc1",
			"video/mp4",
			"video/x-matroska;codecs=avc1",
			"", // Empty string - let browser pick
		];

		const codecTests: CodecSupport[] = codecsToTest.map((mimeType) => ({
			mimeType: mimeType || "(empty - browser picks)",
			supported: hasMediaRecorder
				? mimeType === ""
					? true // Empty string is always valid (browser picks)
					: hasIsTypeSupported
						? mediaRecorderService.isTypeSupported(mimeType)
						: true // If isTypeSupported unavailable, assume mp4 works
				: false,
		}));

		const selectedCodec = hasMediaRecorder
			? mediaRecorderService.getBestCodec() || "(empty - browser picks)"
			: "(MediaRecorder not available)";

		return {
			hasMediaRecorder,
			hasIsTypeSupported,
			selectedCodec,
			codecTests,
			userAgent,
			isIOS,
			isSafari,
			iosVersion,
		};
	}, [mediaRecorderService]);
}
