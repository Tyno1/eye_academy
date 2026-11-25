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

vi.mock("#/components/RegisterForm", () => ({
	default: ({ redirectTo }: { redirectTo?: string }) => (
		<div>Register form {redirectTo}</div>
	),
}));

vi.mock("#/lib/auth-guard", () => ({
	redirectIfSignedIn: vi.fn(),
}));

describe("Register route", () => {
	it("renders RegisterForm with the redirect search value", async () => {
		const { Route } = await import("#/routes/register");
		const RegisterPage = Route.options.component as () => ReactNode;
		render(<RegisterPage />);
		expect(screen.getByText("Register form /viva")).toBeInTheDocument();
	});
});
