import { useRegisterSW } from "virtual:pwa-register/react";

export function useVersionCheck() {
	const {
		needRefresh: [needRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegisteredSW(swUrl, registration) {
			// Check for updates periodically (every 30 minutes)
			if (registration) {
				setInterval(
					() => {
						registration.update();
					},
					30 * 60 * 1000,
				);
			}
			console.log(`Service worker registered: ${swUrl}`);
		},
		onRegisterError(error) {
			console.error("Service worker registration error:", error);
		},
	});

	const reload = () => {
		updateServiceWorker(true);
	};

	return {
		updateAvailable: needRefresh,
		reload,
	};
}
