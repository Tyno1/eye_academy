import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "#/components/ui/input";

describe("Input", () => {
	it("renders a text input by default", () => {
		render(<Input aria-label="Email" />);
		expect(screen.getByLabelText("Email")).toHaveAttribute("data-slot", "input");
	});

	it("applies type and name", () => {
		render(<Input aria-label="Password" type="password" name="password" />);
		const input = screen.getByLabelText("Password");
		expect(input).toHaveAttribute("type", "password");
		expect(input).toHaveAttribute("name", "password");
	});

	it("accepts typed values", async () => {
		const user = userEvent.setup();
		render(<Input aria-label="Name" />);
		const input = screen.getByLabelText("Name");
		await user.type(input, "Ada");
		expect(input).toHaveValue("Ada");
	});

	it("marks invalid state", () => {
		render(<Input aria-label="Work email" aria-invalid={true} />);
		expect(screen.getByLabelText("Work email")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
	});
});
