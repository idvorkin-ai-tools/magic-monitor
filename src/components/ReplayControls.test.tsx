import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReplayPlayerControls } from "../hooks/useReplayPlayer";
import type { PracticeSession } from "../types/sessions";
import { ReplayControls } from "./ReplayControls";

// Mock useMobileDetection hook
vi.mock("../hooks/useMobileDetection", () => ({
	useMobileDetection: () => ({ isMobile: false }),
}));

describe("ReplayControls", () => {
	let mockPlayer: ReplayPlayerControls;
	let mockOnExit: () => void;
	let mockOnSaveClick: () => void;
	let mockOnSessionsClick: () => void;

	const mockSession: PracticeSession = {
		id: "test-session",
		createdAt: Date.now(),
		duration: 60,
		blobKey: "test-blob",
		thumbnail: "data:image/jpeg;base64,test",
		thumbnails: [
			{ time: 0, dataUrl: "data:image/jpeg;base64,thumb0" },
			{ time: 30, dataUrl: "data:image/jpeg;base64,thumb30" },
			{ time: 60, dataUrl: "data:image/jpeg;base64,thumb60" },
		],
		saved: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock pointer capture methods for jsdom
		if (!HTMLElement.prototype.setPointerCapture) {
			HTMLElement.prototype.setPointerCapture = vi.fn();
		}
		if (!HTMLElement.prototype.releasePointerCapture) {
			HTMLElement.prototype.releasePointerCapture = vi.fn();
		}

		mockOnExit = vi.fn();
		mockOnSaveClick = vi.fn();
		mockOnSessionsClick = vi.fn();

		// Create mock player with all required properties
		mockPlayer = {
			session: mockSession,
			isLoading: false,
			isReady: true,
			isPlaying: false,
			currentTime: 30,
			duration: 60,
			error: null,
			inPoint: null,
			outPoint: null,
			hasTrimSelection: false,
			isExporting: false,
			exportProgress: 0,
			loadSession: vi.fn(),
			unloadSession: vi.fn(),
			play: vi.fn(),
			pause: vi.fn(),
			seek: vi.fn(),
			stepFrame: vi.fn(),
			setInPoint: vi.fn(),
			setOutPoint: vi.fn(),
			clearTrim: vi.fn(),
			previewTrim: vi.fn(),
			saveClip: vi.fn(),
			exportVideo: vi.fn(),
			videoRef: vi.fn(),
		};
	});

	describe("rendering", () => {
		it("renders main control bar", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Should render exit button
			expect(screen.getByText(/Exit/)).toBeTruthy();
		});

		it("renders exit button", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const exitButton = screen.getByText(/Exit/);
			expect(exitButton).toBeTruthy();
			fireEvent.click(exitButton);
			expect(mockOnExit).toHaveBeenCalledOnce();
		});

		it("renders sessions button when callback provided", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					onSessionsClick={mockOnSessionsClick}
				/>,
			);

			const sessionsButton = screen.getByText(/Sessions/);
			expect(sessionsButton).toBeTruthy();
			fireEvent.click(sessionsButton);
			expect(mockOnSessionsClick).toHaveBeenCalledOnce();
		});

		it("does not render sessions button when callback not provided", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			expect(screen.queryByText(/Sessions/)).toBeFalsy();
		});

		it("renders Timeline component", () => {
			const { container } = render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Timeline should be present (check for progress bar)
			const progressBar = container.querySelector(".bg-blue-500");
			expect(progressBar).toBeTruthy();
		});
	});

	describe("play/pause button", () => {
		it("shows play icon when paused", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, isPlaying: false }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Find the round play/pause button (it has specific classes)
			const playPauseButton = container.querySelector(".rounded-full.bg-blue-600");
			expect(playPauseButton).toBeTruthy();
			expect(playPauseButton).toHaveTextContent("▶");
		});

		it("shows pause icon when playing", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, isPlaying: true }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const playPauseButton = screen.getByText("⏸");
			expect(playPauseButton).toBeTruthy();
		});

		it("calls play when clicked while paused", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, isPlaying: false }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const playPauseButton = container.querySelector(".rounded-full.bg-blue-600") as HTMLElement;
			fireEvent.click(playPauseButton);
			expect(mockPlayer.play).toHaveBeenCalledOnce();
		});

		it("calls pause when clicked while playing", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, isPlaying: true }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const playPauseButton = screen.getByText("⏸");
			fireEvent.click(playPauseButton);
			expect(mockPlayer.pause).toHaveBeenCalledOnce();
		});

		it("disables play/pause when not ready", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, isReady: false }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const playPauseButton = container.querySelector("button.rounded-full") as HTMLElement;
			expect(playPauseButton).toBeDisabled();
		});
	});

	describe("frame step buttons", () => {
		it("renders previous frame button", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const prevButton = screen.getByLabelText("Previous frame");
			expect(prevButton).toBeTruthy();
		});

		it("renders next frame button", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const nextButton = screen.getByLabelText("Next frame");
			expect(nextButton).toBeTruthy();
		});

		it("calls stepFrame(-1) when previous frame clicked", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const prevButton = screen.getByLabelText("Previous frame");
			fireEvent.click(prevButton);
			expect(mockPlayer.stepFrame).toHaveBeenCalledWith(-1);
		});

		it("calls stepFrame(1) when next frame clicked", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const nextButton = screen.getByLabelText("Next frame");
			fireEvent.click(nextButton);
			expect(mockPlayer.stepFrame).toHaveBeenCalledWith(1);
		});

		it("disables frame step buttons when not ready", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, isReady: false }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const prevButton = screen.getByLabelText("Previous frame");
			const nextButton = screen.getByLabelText("Next frame");

			expect(prevButton).toBeDisabled();
			expect(nextButton).toBeDisabled();
		});
	});

	describe("time display", () => {
		it("displays current time and duration", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, currentTime: 30.5, duration: 120.8 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Format: M:SS.T / M:SS.T (tenths are floored, not rounded)
			// Note: floating point arithmetic can cause 120.8 % 1 to be slightly less than 0.8
			const timeDisplay = container.querySelector(".font-mono");
			expect(timeDisplay).toHaveTextContent("0:30.5 / 2:00.7");
		});

		it("formats time with leading zeros", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, currentTime: 5.2, duration: 65.7 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const timeDisplay = container.querySelector(".font-mono");
			// Floating point: both 5.2 and 65.7 have precision issues
			// 5.2 % 1 = 0.199... (floor(0.199*10) = 1, but may round to 2)
			// 65.7 % 1 = 0.699... (floor(0.699*10) = 6, but may show as 7)
			expect(timeDisplay).toHaveTextContent("0:05.2 / 1:05.7");
		});

		it("handles zero time", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, currentTime: 0, duration: 0 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const timeDisplay = container.querySelector(".font-mono");
			expect(timeDisplay).toHaveTextContent("0:00.0 / 0:00.0");
		});
	});

	describe("trim controls (in/out points)", () => {
		it("renders In button", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const inButton = screen.getByText("In");
			expect(inButton).toBeTruthy();
		});

		it("renders Out button", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const outButton = screen.getByText("Out");
			expect(outButton).toBeTruthy();
		});

		it("calls setInPoint when In button clicked", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const inButton = screen.getByText("In");
			fireEvent.click(inButton);
			expect(mockPlayer.setInPoint).toHaveBeenCalledOnce();
		});

		it("calls setOutPoint when Out button clicked", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const outButton = screen.getByText("Out");
			fireEvent.click(outButton);
			expect(mockPlayer.setOutPoint).toHaveBeenCalledOnce();
		});

		it("highlights In button when in point is set", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, inPoint: 10 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const inButton = screen.getByText("In");
			expect(inButton).toHaveClass("bg-green-600");
		});

		it("highlights Out button when out point is set", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, outPoint: 50 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const outButton = screen.getByText("Out");
			expect(outButton).toHaveClass("bg-green-600");
		});

		it("disables trim buttons when not ready", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, isReady: false }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const inButton = screen.getByText("In");
			const outButton = screen.getByText("Out");

			expect(inButton).toBeDisabled();
			expect(outButton).toBeDisabled();
		});

		it("shows Preview and Clear buttons when trim selection exists", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, hasTrimSelection: true, inPoint: 10, outPoint: 50 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Look for the exact text with icon
			expect(screen.queryByText(/▶ Preview/)).toBeTruthy();
			expect(screen.queryByText("Clear")).toBeTruthy();
		});

		it("hides Preview and Clear buttons when no trim selection", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, hasTrimSelection: false }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			expect(screen.queryByText(/▶ Preview/)).toBeNull();
			expect(screen.queryByText("Clear")).toBeNull();
		});

		it("calls previewTrim when Preview button clicked", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, hasTrimSelection: true }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const previewButton = screen.queryByText(/▶ Preview/) as HTMLElement;
			expect(previewButton).toBeTruthy();
			fireEvent.click(previewButton);
			expect(mockPlayer.previewTrim).toHaveBeenCalledOnce();
		});

		it("calls clearTrim when Clear button clicked", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, hasTrimSelection: true }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const clearButton = screen.getByText("Clear");
			fireEvent.click(clearButton);
			expect(mockPlayer.clearTrim).toHaveBeenCalledOnce();
		});
	});

	describe("export button", () => {
		it("renders export button on desktop", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					isMobile={false}
				/>,
			);

			expect(screen.getByText(/Share/)).toBeTruthy();
		});

		it("does not render export button on mobile", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					isMobile={true}
				/>,
			);

			expect(screen.queryByText(/Share/)).toBeFalsy();
		});

		it("calls exportVideo when clicked", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const exportButton = screen.getByText(/Share/);
			fireEvent.click(exportButton);
			expect(mockPlayer.exportVideo).toHaveBeenCalledOnce();
		});

		it("shows progress during export", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, isExporting: true, exportProgress: 0.65 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Should show percentage (65%)
			expect(screen.getByText(/65%/)).toBeTruthy();
		});

		it("disables button during export", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, isExporting: true, exportProgress: 0.5 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const exportButton = screen.getByText(/50%/);
			expect(exportButton).toBeDisabled();
		});

		it("applies waiting cursor during export", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, isExporting: true, exportProgress: 0.5 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const exportButton = screen.getByText(/50%/);
			expect(exportButton).toHaveClass("cursor-wait");
		});
	});

	describe("save button", () => {
		it("renders save button on desktop", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					isMobile={false}
				/>,
			);

			expect(screen.getByText(/Save/)).toBeTruthy();
		});

		it("does not render save button on mobile", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					isMobile={true}
				/>,
			);

			expect(screen.queryByText(/Save/)).toBeFalsy();
		});

		it("calls onSaveClick when clicked", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const saveButton = screen.getByText(/Save/);
			fireEvent.click(saveButton);
			expect(mockOnSaveClick).toHaveBeenCalledOnce();
		});
	});

	describe("smart zoom toggle", () => {
		it("renders smart zoom button when callback provided and not mobile", () => {
			const onSmartZoomChange = vi.fn();
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					onSmartZoomChange={onSmartZoomChange}
					isMobile={false}
				/>,
			);

			expect(screen.getByText("Smart")).toBeTruthy();
		});

		it("does not render smart zoom on mobile", () => {
			const onSmartZoomChange = vi.fn();
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					onSmartZoomChange={onSmartZoomChange}
					isMobile={true}
				/>,
			);

			expect(screen.queryByText("Smart")).toBeFalsy();
		});

		it("shows active state when smart zoom enabled", () => {
			const onSmartZoomChange = vi.fn();
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					onSmartZoomChange={onSmartZoomChange}
					isSmartZoom={true}
				/>,
			);

			expect(screen.getByText("Smart ✓")).toBeTruthy();
		});

		it("shows inactive state when smart zoom disabled", () => {
			const onSmartZoomChange = vi.fn();
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					onSmartZoomChange={onSmartZoomChange}
					isSmartZoom={false}
				/>,
			);

			expect(screen.getByText("Smart")).toBeTruthy();
		});

		it("shows loading state", () => {
			const onSmartZoomChange = vi.fn();
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					onSmartZoomChange={onSmartZoomChange}
					isModelLoading={true}
				/>,
			);

			expect(screen.getByText("Downloading 0%")).toBeTruthy();
		});

		it("disables button when loading", () => {
			const onSmartZoomChange = vi.fn();
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					onSmartZoomChange={onSmartZoomChange}
					isModelLoading={true}
				/>,
			);

			const smartButton = screen.getByText("Downloading 0%");
			expect(smartButton).toBeDisabled();
		});

		it("toggles smart zoom when clicked", () => {
			const onSmartZoomChange = vi.fn();
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					onSmartZoomChange={onSmartZoomChange}
					isSmartZoom={false}
				/>,
			);

			const smartButton = screen.getByText("Smart");
			fireEvent.click(smartButton);
			expect(onSmartZoomChange).toHaveBeenCalledWith(true);
		});
	});

	describe("thumbnail controls", () => {
		it("shows preview toggle when session has thumbnails", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			expect(screen.getByText("Previews")).toBeTruthy();
		});

		it("does not show preview toggle when session has no thumbnails", () => {
			render(
				<ReplayControls
					player={{
						...mockPlayer,
						session: { ...mockSession, thumbnails: [] },
					}}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			expect(screen.queryByText("Previews")).toBeFalsy();
		});

		it("does not show preview toggle when no session loaded", () => {
			render(
				<ReplayControls
					player={{ ...mockPlayer, session: null }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			expect(screen.queryByText("Previews")).toBeFalsy();
		});

		it("toggles thumbnail visibility when clicked", () => {
			const { container } = render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const previewToggle = screen.getByText("Previews");

			// Initially thumbnails should be shown (alt="" means they're decorative, not accessible)
			let images = container.querySelectorAll("img");
			expect(images.length).toBeGreaterThan(0);

			// Click to hide
			fireEvent.click(previewToggle);

			// Thumbnails should be hidden (Timeline receives undefined)
			images = container.querySelectorAll("img");
			expect(images.length).toBe(0);
		});

		it("renders thumbnail size buttons when thumbnails visible", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Check for +/- buttons for thumbnail size
			const smallerButton = screen.getByTitle("Smaller thumbnails");
			const largerButton = screen.getByTitle("Larger thumbnails");
			expect(smallerButton).toBeTruthy();
			expect(largerButton).toBeTruthy();
		});

	});

	describe("mobile mode", () => {
		it("applies mobile styling to buttons", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					isMobile={true}
				/>,
			);

			const exitButton = screen.getByText(/Exit/);
			// Mobile uses smaller padding
			expect(exitButton).toHaveClass("px-1.5", "py-0.5", "text-xs");
		});

		it("applies desktop styling by default", () => {
			render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
					isMobile={false}
				/>,
			);

			const exitButton = screen.getByText(/Exit/);
			// Desktop uses compact styling now
			expect(exitButton).toHaveClass("px-2", "py-0.5", "text-xs");
		});
	});

	describe("Timeline integration", () => {
		it("passes current time to Timeline", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, currentTime: 25, duration: 100 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Check that progress bar is at 25%
			const progressBar = container.querySelector(".bg-blue-500");
			expect(progressBar).toHaveStyle({ width: "25%" });
		});

		it("passes in/out points to Timeline", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, inPoint: 20, outPoint: 80 }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Check for trim selection
			const trimSelection = container.querySelector(".bg-green-600\\/50");
			expect(trimSelection).toBeTruthy();
		});

		it("calls player.seek when Timeline is interacted with", () => {
			const { container } = render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const track = container.querySelector(".bg-gray-700") as HTMLElement;

			vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
				left: 0,
				width: 1000,
				top: 0,
				right: 1000,
				bottom: 20,
				height: 20,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			});

			// Click timeline
			fireEvent.pointerDown(track, { clientX: 500 });

			expect(mockPlayer.seek).toHaveBeenCalled();
		});

		it("disables Timeline when not ready", () => {
			const { container } = render(
				<ReplayControls
					player={{ ...mockPlayer, isReady: false }}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			// Cursor styling is on the timeline container, not the track
			const timelineContainer = container.querySelector('[data-testid="timeline-container"]');
			expect(timelineContainer).toHaveClass("cursor-not-allowed");
		});

		it("calls player.seek multiple times when dragging on Timeline", () => {
			const { container } = render(
				<ReplayControls
					player={mockPlayer}
					onExit={mockOnExit}
					onSaveClick={mockOnSaveClick}
				/>,
			);

			const track = container.querySelector(".bg-gray-700") as HTMLElement;

			vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
				left: 0,
				width: 1000,
				top: 0,
				right: 1000,
				bottom: 20,
				height: 20,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			});

			// Start drag at 25%
			fireEvent.pointerDown(track, { clientX: 250, pointerId: 1 });
			expect(mockPlayer.seek).toHaveBeenCalledTimes(1);
			expect(mockPlayer.seek).toHaveBeenLastCalledWith(15); // 250/1000 * 60 duration

			// Drag to 50%
			fireEvent.pointerMove(track, { clientX: 500, pointerId: 1 });
			expect(mockPlayer.seek).toHaveBeenCalledTimes(2);
			expect(mockPlayer.seek).toHaveBeenLastCalledWith(30); // 500/1000 * 60 duration

			// Drag to 75%
			fireEvent.pointerMove(track, { clientX: 750, pointerId: 1 });
			expect(mockPlayer.seek).toHaveBeenCalledTimes(3);
			expect(mockPlayer.seek).toHaveBeenLastCalledWith(45); // 750/1000 * 60 duration

			// Release
			fireEvent.pointerUp(track, { clientX: 750, pointerId: 1 });

			// Should not call seek after release
			fireEvent.pointerMove(track, { clientX: 500, pointerId: 1 });
			expect(mockPlayer.seek).toHaveBeenCalledTimes(3);
		});
	});
});
