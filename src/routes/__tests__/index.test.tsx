import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = {
	current: {
		email: null as string | null,
		signedIn: false,
	},
};

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: () => ReactNode }) => ({
		options,
	}),
	Link: ({
		to,
		children,
		className,
	}: {
		to: string;
		children: ReactNode;
		className?: string;
	}) => (
		<a href={to} className={className}>
			{children}
		</a>
	),
}));

vi.mock("#/providers/auth-context", () => ({
	useAuth: () => authState.current,
}));

describe("Home route", () => {
	beforeEach(() => {
		authState.current = { email: null, signedIn: false };
		vi.resetModules();
	});

	it("shows sign-in links when signed out", async () => {
		const { Route } = await import("#/routes/index");
		const Home = Route.options.component as () => ReactNode;
		render(<Home />);
		expect(screen.getByRole("heading", { name: "Eye Academy" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/login",
		);
		expect(
			screen.getByRole("link", { name: "Create an account" }),
		).toHaveAttribute("href", "/register");
	});

	it("shows viva entry when signed in", async () => {
		authState.current = {
			email: "trainee@example.com",
			signedIn: true,
		};
		const { Route } = await import("#/routes/index");
		const Home = Route.options.component as () => ReactNode;
		render(<Home />);
		expect(screen.getByRole("link", { name: "Your vivas" })).toHaveAttribute(
			"href",
			"/viva",
		);
		expect(screen.getByText("Signed in as trainee@example.com")).toBeInTheDocument();
	});
});
