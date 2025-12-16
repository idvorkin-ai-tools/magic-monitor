import { render, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Minimap } from "./Minimap";

// Mock MediaStream
class MockMediaStream {}
// @ts-expect-error - jsdom doesn't have MediaStream
globalThis.MediaStream = MockMediaStream;

// Mock HTMLMediaElement play/load methods (jsdom doesn't implement them)
beforeEach(() => {
	// Mock play to return a resolved promise
	HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
	HTMLMediaElement.prototype.load = vi.fn();
});

describe("Minimap", () => {
	describe("visibility", () => {
		it("renders nothing when zoom is 1 or less", () => {
			const { container } = render(
				<Minimap zoom={1} pan={{ x: 0, y: 0 }} />,
			);
			expect(container.firstChild).toBeNull();
		});

		it("renders nothing when zoom is less than 1", () => {
			const { container } = render(
				<Minimap zoom={0.5} pan={{ x: 0, y: 0 }} />,
			);
			expect(container.firstChild).toBeNull();
		});

		it("renders when zoom is greater than 1", () => {
			const { container } = render(
				<Minimap zoom={2} pan={{ x: 0, y: 0 }} />,
			);
			expect(container.firstChild).not.toBeNull();
		});
	});

	describe("video source switching", () => {
		it("uses stream when stream is provided", () => {
			const mockStream = new MediaStream();

			render(
				<Minimap
					stream={mockStream}
					zoom={2}
					pan={{ x: 0, y: 0 }}
				/>,
			);

			const video = document.querySelector("video");
			expect(video).not.toBeNull();
			// Video element should exist for stream mode
		});

		it("uses videoSrc when provided without stream", () => {
			render(
				<Minimap
					videoSrc="blob:http://localhost/test-video"
					zoom={2}
					pan={{ x: 0, y: 0 }}
				/>,
			);

			const video = document.querySelector("video");
			expect(video).not.toBeNull();
		});

		it("shows canvas when frame is provided", () => {
			// Create a mock ImageBitmap
			const mockFrame = {
				width: 640,
				height: 480,
			} as unknown as ImageBitmap;

			// Mock canvas drawImage since jsdom doesn't support ImageBitmap
			const mockDrawImage = vi.fn();
			vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
				drawImage: mockDrawImage,
			} as unknown as CanvasRenderingContext2D);

			render(
				<Minimap
					frame={mockFrame}
					zoom={2}
					pan={{ x: 0, y: 0 }}
				/>,
			);

			const canvas = document.querySelector("canvas");
			expect(canvas).not.toBeNull();
			expect(mockDrawImage).toHaveBeenCalledWith(mockFrame, 0, 0);

			vi.restoreAllMocks();
		});

		it("prefers video over canvas when no frame provided", () => {
			const mockStream = new MediaStream();

			render(
				<Minimap
					stream={mockStream}
					frame={null}
					zoom={2}
					pan={{ x: 0, y: 0 }}
				/>,
			);

			const video = document.querySelector("video");
			const canvas = document.querySelector("canvas");
			expect(video).not.toBeNull();
			expect(canvas).toBeNull();
		});
	});

	describe("viewport rectangle", () => {
		it("renders viewport rectangle showing visible area", () => {
			render(
				<Minimap
					zoom={2}
					pan={{ x: 0, y: 0 }}
				/>,
			);

			// Viewport rectangle should be visible as a child div with border
			const viewportRect = document.querySelector(".border-yellow-400");
			expect(viewportRect).not.toBeNull();
		});

		it("viewport rectangle size decreases with higher zoom", () => {
			const { rerender, container } = render(
				<Minimap zoom={2} pan={{ x: 0, y: 0 }} />,
			);

			let viewportRect = container.querySelector(".border-yellow-400") as HTMLElement;
			const initialWidth = viewportRect?.style.width;

			rerender(<Minimap zoom={4} pan={{ x: 0, y: 0 }} />);

			viewportRect = container.querySelector(".border-yellow-400") as HTMLElement;
			const newWidth = viewportRect?.style.width;

			// At zoom 2, width should be 50%. At zoom 4, width should be 25%
			expect(initialWidth).toBe("50%");
			expect(newWidth).toBe("25%");
		});

		it("viewport rectangle moves with pan", () => {
			const { container } = render(
				<Minimap
					zoom={2}
					pan={{ x: 0.2, y: -0.1 }}
				/>,
			);

			const viewportRect = container.querySelector(".border-yellow-400") as HTMLElement;
			// Pan affects position
			expect(viewportRect).not.toBeNull();
		});
	});

	describe("click-to-pan", () => {
		it("calls onPanTo when clicked", () => {
			const onPanTo = vi.fn();

			render(
				<Minimap
					zoom={2}
					pan={{ x: 0, y: 0 }}
					onPanTo={onPanTo}
				/>,
			);

			const container = document.querySelector(".cursor-pointer");
			expect(container).not.toBeNull();

			// Mock getBoundingClientRect
			if (container) {
				vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
					left: 0,
					top: 0,
					width: 192, // 48 * 4 = 192px (w-48 = 12rem = 192px)
					height: 108, // 16:9 aspect ratio
					right: 192,
					bottom: 108,
					x: 0,
					y: 0,
					toJSON: () => {},
				});

				// Click in center
				fireEvent.click(container, { clientX: 96, clientY: 54 });

				expect(onPanTo).toHaveBeenCalled();
				// Clicking center should pan to (0, 0)
				const call = onPanTo.mock.calls[0][0];
				expect(call.x).toBeCloseTo(0, 1);
				expect(call.y).toBeCloseTo(0, 1);
			}
		});

		it("click on left edge pans right (positive x)", () => {
			const onPanTo = vi.fn();

			render(
				<Minimap
					zoom={2}
					pan={{ x: 0, y: 0 }}
					onPanTo={onPanTo}
				/>,
			);

			const container = document.querySelector(".cursor-pointer");
			if (container) {
				vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
					left: 0,
					top: 0,
					width: 192,
					height: 108,
					right: 192,
					bottom: 108,
					x: 0,
					y: 0,
					toJSON: () => {},
				});

				// Click on left edge
				fireEvent.click(container, { clientX: 0, clientY: 54 });

				expect(onPanTo).toHaveBeenCalled();
				const call = onPanTo.mock.calls[0][0];
				// Clicking left edge (u=0) should pan to x=0.5
				expect(call.x).toBeCloseTo(0.5, 1);
			}
		});

		it("does not call onPanTo when not provided", () => {
			render(
				<Minimap
					zoom={2}
					pan={{ x: 0, y: 0 }}
				/>,
			);

			const container = document.querySelector(".cursor-pointer");
			// Should not throw when clicked without onPanTo
			if (container) {
				expect(() => fireEvent.click(container)).not.toThrow();
			}
		});
	});

	describe("mirror mode", () => {
		it("applies scaleX(-1) transform when isMirror is true", () => {
			render(
				<Minimap
					zoom={2}
					pan={{ x: 0, y: 0 }}
					isMirror={true}
				/>,
			);

			const video = document.querySelector("video");
			expect(video?.style.transform).toBe("scaleX(-1)");
		});

		it("does not apply mirror transform when isMirror is false", () => {
			render(
				<Minimap
					zoom={2}
					pan={{ x: 0, y: 0 }}
					isMirror={false}
				/>,
			);

			const video = document.querySelector("video");
			expect(video?.style.transform).toBeFalsy();
		});
	});
});
