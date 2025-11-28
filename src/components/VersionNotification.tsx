import { useVersionCheck } from "../hooks/useVersionCheck";

export function VersionNotification() {
	const { updateAvailable, reload } = useVersionCheck();

	if (!updateAvailable) return null;

	return (
		<div className="fixed bottom-4 right-4 z-[70] animate-pulse">
			<div className="bg-blue-600 border border-blue-400/30 p-4 rounded-xl shadow-2xl max-w-sm">
				<div className="flex items-center gap-3">
					<div className="text-2xl">🚀</div>
					<div className="flex-1">
						<div className="text-white font-semibold">
							New Version Available
						</div>
						<div className="text-blue-200 text-sm">
							Reload to get the latest features
						</div>
					</div>
					<button
						onClick={reload}
						className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors"
					>
						Reload
					</button>
				</div>
			</div>
		</div>
	);
}
