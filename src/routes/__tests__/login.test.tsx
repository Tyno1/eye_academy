import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const search = { redirect: "/viva" };

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: {
		component: () => ReactNode;
		beforeLoad?: (args: unknown) => void;
	}) => ({
		options,
		useSearch: () => search,
	}),
}));

vi.mock("#/components/LoginForm", () => ({
	default: ({ redirectTo }: { redirectTo?: string }) => (
		<div>Login form {redirectTo}</div>
	),
}));

vi.mock("#/lib/auth-guard", () => ({
	redirectIfSignedIn: vi.fn(),
}));

describe("Login route", () => {
	it("renders LoginForm with the redirect search value", async () => {
		const { Route } = await import("#/routes/login");
		const LoginPage = Route.options.component as () => ReactNode;
		render(<LoginPage />);
		expect(screen.getByText("Login form /viva")).toBeInTheDocument();
	});
});
