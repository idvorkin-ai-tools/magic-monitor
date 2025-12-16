import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

describe("useFocusTrap", () => {
	// Clean up DOM after each test
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("returns a ref object", () => {
		const { result } = renderHook(() => useFocusTrap({ isOpen: false }));

		expect(result.current).toHaveProperty("current");
	});

	it("traps Tab key on last element to cycle to first", () => {
		const container = document.createElement("div");
		const button1 = document.createElement("button");
		const button2 = document.createElement("button");
		const button3 = document.createElement("button");
		container.appendChild(button1);
		container.appendChild(button2);
		container.appendChild(button3);
		document.body.appendChild(container);

		const { result } = renderHook(() => useFocusTrap({ isOpen: true }));
		result.current.current = container;

		// Focus the last button
		button3.focus();
		expect(document.activeElement).toBe(button3);

		// Press Tab (should cycle to first)
		fireEvent.keyDown(document, { key: "Tab" });

		expect(document.activeElement).toBe(button1);
	});

	it("traps Shift+Tab key on first element to cycle to last", () => {
		const container = document.createElement("div");
		const button1 = document.createElement("button");
		const button2 = document.createElement("button");
		const button3 = document.createElement("button");
		container.appendChild(button1);
		container.appendChild(button2);
		container.appendChild(button3);
		document.body.appendChild(container);

		const { result } = renderHook(() => useFocusTrap({ isOpen: true }));
		result.current.current = container;

		// Focus the first button
		button1.focus();
		expect(document.activeElement).toBe(button1);

		// Press Shift+Tab (should cycle to last)
		fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

		expect(document.activeElement).toBe(button3);
	});

	it("allows normal Tab navigation between middle elements", () => {
		const container = document.createElement("div");
		const button1 = document.createElement("button");
		const button2 = document.createElement("button");
		const button3 = document.createElement("button");
		container.appendChild(button1);
		container.appendChild(button2);
		container.appendChild(button3);
		document.body.appendChild(container);

		const { result } = renderHook(() => useFocusTrap({ isOpen: true }));
		result.current.current = container;

		// Focus the second button
		button2.focus();
		expect(document.activeElement).toBe(button2);

		// Press Tab - should NOT prevent default (browser handles it)
		const tabEvent = new KeyboardEvent("keydown", {
			key: "Tab",
			bubbles: true,
		});
		const preventDefaultSpy = vi.spyOn(tabEvent, "preventDefault");
		document.dispatchEvent(tabEvent);

		expect(preventDefaultSpy).not.toHaveBeenCalled();
	});

	it("calls onClose when Escape is pressed", () => {
		const onClose = vi.fn();

		const container = document.createElement("div");
		const button = document.createElement("button");
		container.appendChild(button);
		document.body.appendChild(container);

		const { result } = renderHook(() =>
			useFocusTrap({ isOpen: true, onClose }),
		);
		result.current.current = container;

		fireEvent.keyDown(document, { key: "Escape" });

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when Escape is pressed and trap is closed", () => {
		const onClose = vi.fn();

		renderHook(() => useFocusTrap({ isOpen: false, onClose }));

		fireEvent.keyDown(document, { key: "Escape" });

		expect(onClose).not.toHaveBeenCalled();
	});

	it("ignores non-Tab/non-Escape keys", () => {
		const container = document.createElement("div");
		const button1 = document.createElement("button");
		const button2 = document.createElement("button");
		container.appendChild(button1);
		container.appendChild(button2);
		document.body.appendChild(container);

		const { result } = renderHook(() => useFocusTrap({ isOpen: true }));
		result.current.current = container;

		button1.focus();

		// Press random keys
		fireEvent.keyDown(document, { key: "Enter" });
		fireEvent.keyDown(document, { key: "a" });
		fireEvent.keyDown(document, { key: "ArrowDown" });

		// Focus should not change
		expect(document.activeElement).toBe(button1);
	});

	it("handles containers with no focusable elements gracefully", () => {
		const container = document.createElement("div");
		const div = document.createElement("div");
		container.appendChild(div);
		document.body.appendChild(container);

		const { result } = renderHook(() => useFocusTrap({ isOpen: true }));
		result.current.current = container;

		// Should not throw
		fireEvent.keyDown(document, { key: "Tab" });
	});

	it("excludes disabled and tabindex=-1 elements from focus trap", () => {
		const container = document.createElement("div");
		const button1 = document.createElement("button");
		const disabledButton = document.createElement("button");
		disabledButton.disabled = true;
		const hiddenButton = document.createElement("button");
		hiddenButton.setAttribute("tabindex", "-1");
		const button2 = document.createElement("button");

		container.appendChild(button1);
		container.appendChild(disabledButton);
		container.appendChild(hiddenButton);
		container.appendChild(button2);
		document.body.appendChild(container);

		const { result } = renderHook(() => useFocusTrap({ isOpen: true }));
		result.current.current = container;

		// Focus last valid button
		button2.focus();

		// Tab should cycle to first valid button (skipping disabled)
		fireEvent.keyDown(document, { key: "Tab" });

		expect(document.activeElement).toBe(button1);
	});

	it("returns focus to previously active element on close", () => {
		const triggerButton = document.createElement("button");
		document.body.appendChild(triggerButton);
		triggerButton.focus();

		const container = document.createElement("div");
		const modalButton = document.createElement("button");
		container.appendChild(modalButton);
		document.body.appendChild(container);

		// Open the trap
		const { rerender } = renderHook(
			({ isOpen }) => useFocusTrap({ isOpen }),
			{ initialProps: { isOpen: true } },
		);

		// Close the trap
		rerender({ isOpen: false });

		// Focus should return to trigger
		expect(document.activeElement).toBe(triggerButton);
	});

	it("cleans up event listeners on unmount", () => {
		const onClose = vi.fn();

		const { unmount } = renderHook(() =>
			useFocusTrap({ isOpen: true, onClose }),
		);

		unmount();

		fireEvent.keyDown(document, { key: "Escape" });

		expect(onClose).not.toHaveBeenCalled();
	});

	it("supports inputs, textareas, selects, and links", () => {
		const container = document.createElement("div");
		const input = document.createElement("input");
		const textarea = document.createElement("textarea");
		const select = document.createElement("select");
		const link = document.createElement("a");
		link.href = "#";

		container.appendChild(input);
		container.appendChild(textarea);
		container.appendChild(select);
		container.appendChild(link);
		document.body.appendChild(container);

		const { result } = renderHook(() => useFocusTrap({ isOpen: true }));
		result.current.current = container;

		// Focus last element
		link.focus();

		// Tab should cycle to first
		fireEvent.keyDown(document, { key: "Tab" });

		expect(document.activeElement).toBe(input);
	});
});
