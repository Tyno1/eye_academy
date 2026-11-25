import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Footer from "#/components/Footer";

describe("Footer", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows the current year and case label", () => {
		render(<Footer />);
		expect(screen.getByText("© 2026 Eye Academy")).toBeInTheDocument();
		expect(screen.getByText("Case EA-VIVA-001 · Fictional")).toBeInTheDocument();
	});
});
