import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionThumbnail } from "../types/sessions";
import { Timeline } from "./Timeline";

describe("Timeline", () => {
	const mockOnSeek = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock pointer capture methods for jsdom
		if (!HTMLElement.prototype.setPointerCapture) {
			HTMLElement.prototype.setPointerCapture = vi.fn();
		}
		if (!HTMLElement.prototype.releasePointerCapture) {
			HTMLElement.prototype.releasePointerCapture = vi.fn();
		}
	});

	describe("rendering with basic props", () => {
		it("renders timeline track", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			// Timeline track should exist
			const track = container.querySelector(".bg-gray-700");
			expect(track).toBeTruthy();
		});

		it("renders progress bar at correct position", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const progressBar = container.querySelector(".bg-blue-500");
			expect(progressBar).toBeTruthy();
			expect(progressBar).toHaveStyle({ width: "50%" });
		});

		it("renders playhead at correct position", () => {
			const { container } = render(
				<Timeline
					currentTime={2.5}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const playhead = container.querySelector(".bg-white.rounded-full");
			expect(playhead).toBeTruthy();
			expect(playhead).toHaveStyle({ left: "25%" });
		});

		it("handles zero duration without errors", () => {
			const { container } = render(
				<Timeline
					currentTime={0}
					duration={0}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const progressBar = container.querySelector(".bg-blue-500");
			expect(progressBar).toHaveStyle({ width: "0%" });
		});
	});

	describe("seeking interaction", () => {
		it("calls onSeek when timeline is clicked", () => {
			// Mock getBoundingClientRect before rendering
			const mockGetBoundingClientRect = vi.fn().mockReturnValue({
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

			const { container } = render(
				<Timeline
					currentTime={0}
					duration={100}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const track = container.querySelector(".bg-gray-700") as HTMLElement;
			expect(track).toBeTruthy();

			// Apply mock after getting the element
			track.getBoundingClientRect = mockGetBoundingClientRect;

			// Click at 50% position (clientX = 500)
			fireEvent.pointerDown(track, { clientX: 500 });

			expect(mockOnSeek).toHaveBeenCalledWith(50); // 50% of 100 duration
		});

		it("handles drag to seek", () => {
			const { container } = render(
				<Timeline
					currentTime={0}
					duration={100}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const track = container.querySelector(".bg-gray-700") as HTMLElement;

			track.getBoundingClientRect = vi.fn().mockReturnValue({
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

			// Start drag
			fireEvent.pointerDown(track, { clientX: 250, pointerId: 1 });
			expect(mockOnSeek).toHaveBeenCalledWith(25);

			// Drag to new position
			fireEvent.pointerMove(track, { clientX: 750, pointerId: 1 });
			expect(mockOnSeek).toHaveBeenCalledWith(75);

			// Release
			fireEvent.pointerUp(track, { clientX: 750, pointerId: 1 });
		});

		it("does not seek when disabled", () => {
			const { container } = render(
				<Timeline
					currentTime={0}
					duration={100}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					disabled={true}
				/>,
			);

			const track = container.querySelector(".bg-gray-700") as HTMLElement;

			track.getBoundingClientRect = vi.fn().mockReturnValue({
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

			fireEvent.pointerDown(track, { clientX: 500 });

			expect(mockOnSeek).not.toHaveBeenCalled();
		});

		it("clamps seek position to 0-100%", () => {
			const { container } = render(
				<Timeline
					currentTime={0}
					duration={100}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const track = container.querySelector(".bg-gray-700") as HTMLElement;

			track.getBoundingClientRect = vi.fn().mockReturnValue({
				left: 100,
				width: 1000,
				top: 0,
				right: 1100,
				bottom: 20,
				height: 20,
				x: 100,
				y: 0,
				toJSON: () => ({}),
			});

			// Click before start (clientX < left)
			fireEvent.pointerDown(track, { clientX: 50 });
			expect(mockOnSeek).toHaveBeenCalledWith(0);

			// Click after end (clientX > right)
			fireEvent.pointerDown(track, { clientX: 2000 });
			expect(mockOnSeek).toHaveBeenCalledWith(100);
		});
	});

	describe("thumbnails display", () => {
		const mockThumbnails: SessionThumbnail[] = [
			{ time: 0, dataUrl: "data:image/jpeg;base64,thumb0" },
			{ time: 5, dataUrl: "data:image/jpeg;base64,thumb5" },
			{ time: 10, dataUrl: "data:image/jpeg;base64,thumb10" },
		];

		it("renders thumbnails when provided", () => {
			const { container } = render(
				<Timeline
					currentTime={2}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					thumbnails={mockThumbnails}
				/>,
			);

			// Images have alt="" so query by tag instead of role
			const thumbnailImages = container.querySelectorAll("img");
			expect(thumbnailImages).toHaveLength(3);
		});

		it("does not render thumbnails when not provided", () => {
			render(
				<Timeline
					currentTime={2}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const thumbnailImages = screen.queryAllByRole("img");
			expect(thumbnailImages).toHaveLength(0);
		});

		it("renders thumbnails with correct data URLs", () => {
			const { container } = render(
				<Timeline
					currentTime={2}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					thumbnails={mockThumbnails}
				/>,
			);

			const thumbnailImages = container.querySelectorAll("img");
			expect(thumbnailImages[0]).toHaveAttribute("src", "data:image/jpeg;base64,thumb0");
			expect(thumbnailImages[1]).toHaveAttribute("src", "data:image/jpeg;base64,thumb5");
			expect(thumbnailImages[2]).toHaveAttribute("src", "data:image/jpeg;base64,thumb10");
		});

		it("clicking thumbnail seeks to that time", () => {
			render(
				<Timeline
					currentTime={0}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					thumbnails={mockThumbnails}
				/>,
			);

			const thumbnailButtons = screen.getAllByRole("button");
			// Click second thumbnail (time: 5)
			fireEvent.click(thumbnailButtons[1]);

			expect(mockOnSeek).toHaveBeenCalledWith(5);
		});

		it("highlights current thumbnail", () => {
			const { container } = render(
				<Timeline
					currentTime={6}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					thumbnails={mockThumbnails}
				/>,
			);

			// Current time is 6, which falls in the second thumbnail's range (5-10)
			const thumbnailButtons = container.querySelectorAll("button");
			expect(thumbnailButtons[1]).toHaveClass("ring-2", "ring-blue-500");
		});

		it("scales thumbnails based on thumbnailSize prop", () => {
			const { container } = render(
				<Timeline
					currentTime={0}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					thumbnails={mockThumbnails}
					thumbnailSize={0} // Minimum size
				/>,
			);

			const thumbnailButtons = container.querySelectorAll("button");
			// At size 0: width = 48 + (0/100) * 152 = 48
			// height = 48 * (9/16) = 27
			expect(thumbnailButtons[0]).toHaveStyle({ width: "48px", height: "27px" });
		});

		it("scales thumbnails to maximum size", () => {
			const { container } = render(
				<Timeline
					currentTime={0}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					thumbnails={mockThumbnails}
					thumbnailSize={100} // Maximum size
				/>,
			);

			const thumbnailButtons = container.querySelectorAll("button");
			// At size 100: width = 48 + (100/100) * 152 = 200
			// height = Math.round(200 * (9/16)) = Math.round(112.5) = 113 (rounds up)
			expect(thumbnailButtons[0]).toHaveStyle({ width: "200px", height: "113px" });
		});
	});

	describe("in/out points (trim markers)", () => {
		it("renders in point marker", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={100}
					inPoint={20}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const inMarker = container.querySelector('[title="In point"]');
			expect(inMarker).toBeTruthy();
			expect(inMarker).toHaveStyle({ left: "20%" });
		});

		it("renders out point marker", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={100}
					inPoint={null}
					outPoint={80}
					onSeek={mockOnSeek}
				/>,
			);

			const outMarker = container.querySelector('[title="Out point"]');
			expect(outMarker).toBeTruthy();
			expect(outMarker).toHaveStyle({ left: "80%" });
		});

		it("renders trim selection highlight when both points set", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={100}
					inPoint={20}
					outPoint={80}
					onSeek={mockOnSeek}
				/>,
			);

			const trimSelection = container.querySelector(".bg-green-600\\/50");
			expect(trimSelection).toBeTruthy();
			expect(trimSelection).toHaveStyle({
				left: "20%",
				width: "60%", // 80% - 20%
			});
		});

		it("does not render trim selection when only in point set", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={100}
					inPoint={20}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const trimSelection = container.querySelector(".bg-green-600\\/50");
			expect(trimSelection).toBeFalsy();
		});

		it("does not render trim selection when only out point set", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={100}
					inPoint={null}
					outPoint={80}
					onSeek={mockOnSeek}
				/>,
			);

			const trimSelection = container.querySelector(".bg-green-600\\/50");
			expect(trimSelection).toBeFalsy();
		});

		it("does not render markers when points are null", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={100}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			expect(container.querySelector('[title="In point"]')).toBeFalsy();
			expect(container.querySelector('[title="Out point"]')).toBeFalsy();
		});
	});

	describe("mobile mode", () => {
		it("applies mobile styling when isMobile is true", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					isMobile={true}
				/>,
			);

			const track = container.querySelector(".bg-gray-700");
			expect(track).toHaveClass("h-2"); // Mobile height
		});

		it("applies desktop styling when isMobile is false", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					isMobile={false}
				/>,
			);

			const track = container.querySelector(".bg-gray-700");
			expect(track).toHaveClass("h-3"); // Desktop height
		});

		it("defaults to desktop styling", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const track = container.querySelector(".bg-gray-700");
			expect(track).toHaveClass("h-3"); // Desktop height
		});
	});

	describe("disabled state", () => {
		it("applies disabled styling when disabled", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					disabled={true}
				/>,
			);

			const track = container.querySelector(".bg-gray-700");
			expect(track).toHaveClass("cursor-not-allowed", "opacity-50");
		});

		it("applies normal cursor when not disabled", () => {
			const { container } = render(
				<Timeline
					currentTime={5}
					duration={10}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
					disabled={false}
				/>,
			);

			const track = container.querySelector(".bg-gray-700");
			expect(track).toHaveClass("cursor-pointer");
			expect(track).not.toHaveClass("opacity-50");
		});
	});

	describe("cleanup", () => {
		it("removes event listeners on unmount during drag", () => {
			const { container, unmount } = render(
				<Timeline
					currentTime={0}
					duration={100}
					inPoint={null}
					outPoint={null}
					onSeek={mockOnSeek}
				/>,
			);

			const track = container.querySelector(".bg-gray-700") as HTMLElement;

			track.getBoundingClientRect = vi.fn().mockReturnValue({
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

			const removeEventListenerSpy = vi.spyOn(track, "removeEventListener");

			// Start drag
			fireEvent.pointerDown(track, { clientX: 250, pointerId: 1 });

			// Unmount while dragging
			unmount();

			// Should have removed event listeners
			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				"pointermove",
				expect.any(Function),
			);
			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				"pointerup",
				expect.any(Function),
			);
			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				"pointercancel",
				expect.any(Function),
			);
		});
	});
});
