import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingOverlay } from "./LoadingOverlay";

describe("LoadingOverlay", () => {
	it("renders with default message", () => {
		render(<LoadingOverlay />);

		expect(screen.getByText("Loading...")).toBeInTheDocument();
		expect(screen.getByTestId("loading-overlay")).toBeInTheDocument();
	});

	it("renders with custom message", () => {
		render(<LoadingOverlay message="Loading video..." />);

		expect(screen.getByText("Loading video...")).toBeInTheDocument();
	});

	it("has correct accessibility attributes", () => {
		render(<LoadingOverlay />);

		const overlay = screen.getByTestId("loading-overlay");
		expect(overlay).toHaveAttribute("role", "status");
		expect(overlay).toHaveAttribute("aria-live", "polite");
	});

	it("renders spinner element", () => {
		render(<LoadingOverlay />);

		// Find the spinner by its class
		const overlay = screen.getByTestId("loading-overlay");
		const spinner = overlay.querySelector(".animate-spin");
		expect(spinner).toBeInTheDocument();
	});

	it("applies custom z-index", () => {
		render(<LoadingOverlay zIndex={50} />);

		const overlay = screen.getByTestId("loading-overlay");
		expect(overlay).toHaveStyle({ zIndex: "50" });
	});

	it("applies custom className", () => {
		render(<LoadingOverlay className="custom-class" />);

		const overlay = screen.getByTestId("loading-overlay");
		expect(overlay).toHaveClass("custom-class");
	});

	it("uses custom testId", () => {
		render(<LoadingOverlay testId="my-loader" />);

		expect(screen.getByTestId("my-loader")).toBeInTheDocument();
	});
});
