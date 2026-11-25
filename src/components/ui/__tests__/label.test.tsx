import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "#/components/ui/label";

describe("Label", () => {
	it("renders text", () => {
		render(<Label htmlFor="email">Email</Label>);
		expect(screen.getByText("Email")).toBeInTheDocument();
	});

	it("associates with an input via htmlFor", () => {
		render(
			<>
				<Label htmlFor="email">Email</Label>
				<input id="email" />
			</>,
		);
		expect(screen.getByLabelText("Email")).toHaveAttribute("id", "email");
	});

	it("merges className", () => {
		render(
			<Label htmlFor="name" className="text-primary">
				Name
			</Label>,
		);
		expect(screen.getByText("Name")).toHaveClass("text-primary");
	});
});
