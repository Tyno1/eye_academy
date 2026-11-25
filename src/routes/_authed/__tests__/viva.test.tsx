import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
let loaderData: Array<{
	id: string;
	status: "active" | "ended";
	createdAt: string | null;
	turns: number;
}> = [];

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: () => ReactNode }) => ({
		options,
		useLoaderData: () => loaderData,
	}),
	Link: ({
		to,
		params,
		children,
		className,
	}: {
		to: string;
		params?: { attemptId: string };
		children: ReactNode;
		className?: string;
	}) => (
		<a href={`${to}/${params?.attemptId ?? ""}`} className={className}>
			{children}
		</a>
	),
	useNavigate: () => navigate,
}));

vi.mock("#/server/tools", () => ({
	listAttempts: vi.fn(),
}));

describe("Viva list route", () => {
	beforeEach(() => {
		navigate.mockReset();
		loaderData = [];
		vi.stubGlobal("crypto", {
			randomUUID: () => "22222222-2222-4222-8222-222222222222",
		});
		vi.resetModules();
	});

	it("shows an empty state", async () => {
		const { Route } = await import("#/routes/_authed/viva");
		const Page = Route.options.component as () => ReactNode;
		render(<Page />);
		expect(screen.getByText("No attempts yet.")).toBeInTheDocument();
	});

	it("lists attempts and starts a new viva", async () => {
		const user = userEvent.setup();
		loaderData = [
			{
				id: "11111111-1111-4111-8111-111111111111",
				status: "ended",
				createdAt: "2026-11-25T12:00:00.000Z",
				turns: 2,
			},
		];
		const { Route } = await import("#/routes/_authed/viva");
		const Page = Route.options.component as () => ReactNode;
		render(<Page />);

		expect(screen.getByText("Ended")).toBeInTheDocument();
		expect(screen.getByText(/2 turns/)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "New viva" }));
		expect(navigate).toHaveBeenCalledWith({
			to: "/viva/$attemptId",
			params: { attemptId: "22222222-2222-4222-8222-222222222222" },
		});
	});
});
