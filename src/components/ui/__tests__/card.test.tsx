import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";

describe("Card", () => {
	it("renders the card slots", () => {
		render(
			<Card>
				<CardHeader>
					<CardTitle>Title</CardTitle>
					<CardDescription>Description</CardDescription>
				</CardHeader>
				<CardContent>Body</CardContent>
				<CardFooter>Footer</CardFooter>
			</Card>,
		);

		expect(screen.getByText("Title")).toHaveAttribute("data-slot", "card-title");
		expect(screen.getByText("Description")).toHaveAttribute(
			"data-slot",
			"card-description",
		);
		expect(screen.getByText("Body")).toHaveAttribute("data-slot", "card-content");
		expect(screen.getByText("Footer")).toHaveAttribute("data-slot", "card-footer");
	});

	it("merges className on Card", () => {
		const { container } = render(<Card className="max-w-sm">Content</Card>);
		expect(container.firstChild).toHaveClass("max-w-sm");
		expect(container.firstChild).toHaveAttribute("data-slot", "card");
	});
});
