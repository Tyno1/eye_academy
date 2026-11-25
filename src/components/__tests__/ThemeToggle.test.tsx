import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import ThemeToggle from "#/components/ThemeToggle";

describe("ThemeToggle", () => {
	beforeEach(() => {
		window.localStorage.clear();
		document.documentElement.classList.remove("light", "dark");
		document.documentElement.removeAttribute("data-theme");
	});

	it("starts in auto mode", () => {
		render(<ThemeToggle />);
		expect(
			screen.getByRole("button", {
				name: /Theme mode: auto/,
			}),
		).toBeInTheDocument();
	});

	it("cycles light → dark → auto and stores the choice", async () => {
		const user = userEvent.setup();
		render(<ThemeToggle />);
		const button = screen.getByRole("button");

		await user.click(button);
		expect(button).toHaveAttribute(
			"aria-label",
			"Theme mode: light. Click to switch mode.",
		);
		expect(window.localStorage.getItem("theme")).toBe("light");
		expect(document.documentElement).toHaveClass("light");
		expect(document.documentElement).toHaveAttribute("data-theme", "light");

		await user.click(button);
		expect(button).toHaveAttribute(
			"aria-label",
			"Theme mode: dark. Click to switch mode.",
		);
		expect(window.localStorage.getItem("theme")).toBe("dark");
		expect(document.documentElement).toHaveClass("dark");

		await user.click(button);
		expect(button).toHaveAttribute(
			"aria-label",
			"Theme mode: auto (system). Click to switch to light mode.",
		);
		expect(window.localStorage.getItem("theme")).toBe("auto");
		expect(document.documentElement).not.toHaveAttribute("data-theme");
	});

	it("restores a stored theme", () => {
		window.localStorage.setItem("theme", "dark");
		render(<ThemeToggle />);
		expect(
			screen.getByRole("button", {
				name: "Theme mode: dark. Click to switch mode.",
			}),
		).toBeInTheDocument();
		expect(document.documentElement).toHaveClass("dark");
	});
});
