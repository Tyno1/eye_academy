import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "#/components/ui/button";

describe("Button", () => {
	it("renders its children", () => {
		render(<Button>Save</Button>);
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
	});

	it("forwards type and disabled", () => {
		render(
			<Button type="submit" disabled>
				Submit
			</Button>,
		);
		const button = screen.getByRole("button", { name: "Submit" });
		expect(button).toHaveAttribute("type", "submit");
		expect(button).toBeDisabled();
	});

	it("merges className", () => {
		render(<Button className="w-full">Go</Button>);
		expect(screen.getByRole("button", { name: "Go" })).toHaveClass("w-full");
	});

	it("calls onClick", async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		render(<Button onClick={onClick}>Click</Button>);
		await user.click(screen.getByRole("button", { name: "Click" }));
		expect(onClick).toHaveBeenCalledOnce();
	});
});
