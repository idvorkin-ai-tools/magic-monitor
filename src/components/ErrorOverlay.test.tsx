import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorOverlay } from "./ErrorOverlay";

describe("ErrorOverlay", () => {
	it("renders error message", () => {
		render(<ErrorOverlay message="Something went wrong" />);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		expect(screen.getByTestId("error-overlay")).toBeInTheDocument();
	});

	it("has correct accessibility attributes", () => {
		render(<ErrorOverlay message="Error" />);

		const overlay = screen.getByTestId("error-overlay");
		expect(overlay).toHaveAttribute("role", "alert");
	});

	it("renders action button when onAction provided", () => {
		const onAction = vi.fn();
		render(<ErrorOverlay message="Error" onAction={onAction} />);

		const button = screen.getByText("Go Back");
		expect(button).toBeInTheDocument();

		fireEvent.click(button);
		expect(onAction).toHaveBeenCalledTimes(1);
	});

	it("uses custom action label", () => {
		render(
			<ErrorOverlay
				message="Error"
				onAction={() => {}}
				actionLabel="Try Again"
			/>,
		);

		expect(screen.getByText("Try Again")).toBeInTheDocument();
	});

	it("does not render button when onAction not provided", () => {
		render(<ErrorOverlay message="Error" />);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("renders help text when provided", () => {
		render(<ErrorOverlay message="Error" helpText="Please try again later" />);

		expect(screen.getByText("Please try again later")).toBeInTheDocument();
	});

	it("renders tips when provided", () => {
		render(
			<ErrorOverlay
				message="Error"
				tips={["Tip one", "Tip two"]}
			/>,
		);

		expect(screen.getByText("Tip one")).toBeInTheDocument();
		expect(screen.getByText("Tip two")).toBeInTheDocument();
	});

	it("renders tips with HTML content", () => {
		render(
			<ErrorOverlay
				message="Error"
				tips={["<strong>Bold</strong> tip"]}
			/>,
		);

		const tip = screen.getByText((_, element) => {
			return element?.innerHTML === "<strong>Bold</strong> tip";
		});
		expect(tip).toBeInTheDocument();
	});

	it("applies custom z-index", () => {
		render(<ErrorOverlay message="Error" zIndex={50} />);

		const overlay = screen.getByTestId("error-overlay");
		expect(overlay).toHaveStyle({ zIndex: "50" });
	});

	it("applies custom className", () => {
		render(<ErrorOverlay message="Error" className="custom-class" />);

		const overlay = screen.getByTestId("error-overlay");
		expect(overlay).toHaveClass("custom-class");
	});

	it("uses custom testId", () => {
		render(<ErrorOverlay message="Error" testId="my-error" />);

		expect(screen.getByTestId("my-error")).toBeInTheDocument();
	});

	it("renders error icon", () => {
		render(<ErrorOverlay message="Error" />);

		// Find the exclamation mark icon
		expect(screen.getByText("!")).toBeInTheDocument();
	});
});
