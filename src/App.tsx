import { CameraStage } from "./components/CameraStage";
import { VersionNotification } from "./components/VersionNotification";

function App() {
	return (
		<div className="w-screen h-screen bg-gray-900 overflow-hidden">
			<CameraStage />
			<VersionNotification />
		</div>
	);
}

export default App;
