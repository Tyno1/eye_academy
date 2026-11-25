import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const redirectIfSignedOut = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: {
		component: () => ReactNode;
		beforeLoad?: (args: unknown) => void;
	}) => ({
		options,
	}),
	Outlet: () => <div>Authed outlet</div>,
}));

vi.mock("#/lib/auth-guard", () => ({
	redirectIfSignedOut: (...args: unknown[]) => redirectIfSignedOut(...args),
}));

describe("_authed route", () => {
	it("renders the outlet", async () => {
		const { Route } = await import("#/routes/_authed");
		const AuthedLayout = Route.options.component as () => ReactNode;
		render(<AuthedLayout />);
		expect(screen.getByText("Authed outlet")).toBeInTheDocument();
	});

	it("guards signed-out users in beforeLoad", async () => {
		const { Route } = await import("#/routes/_authed");
		Route.options.beforeLoad?.({
			context: { session: null },
			location: { href: "/viva" },
		} as never);
		expect(redirectIfSignedOut).toHaveBeenCalledWith(null, "/viva");
	});
});
