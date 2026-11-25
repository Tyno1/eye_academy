import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const attempt = {
	id: "11111111-1111-4111-8111-111111111111",
	status: "active" as const,
	transcript: [
		{ id: "0-trainee", role: "trainee" as const, text: "Right IOP?" },
		{
			id: "1-examiner",
			role: "examiner" as const,
			text: "Right Intraocular pressure is 58 mmHg.",
		},
	],
	revealed: [
		{
			id: "iop_right",
			spoken: "Right Intraocular pressure is 58 mmHg.",
		},
	],
	answers: [] as string[],
	revision: null,
};

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: () => ReactNode }) => ({
		options,
		useParams: () => ({ attemptId: attempt.id }),
		useLoaderData: () => attempt,
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

vi.mock("#/lib/realtimeClient", () => ({
	connectViva: vi.fn(),
}));

vi.mock("#/server/revision", () => ({
	revisionPoint: vi.fn(),
}));

vi.mock("#/server/tools", () => ({
	loadAttempt: vi.fn(async () => attempt),
}));

describe("Viva attempt route", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("renders the transcript and start control", async () => {
		const { Route } = await import("#/routes/_authed/viva_.$attemptId");
		const Page = Route.options.component as () => ReactNode;
		render(<Page />);

		expect(screen.getByText("Right IOP?")).toBeInTheDocument();
		expect(
			screen.getByText("Right Intraocular pressure is 58 mmHg."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Start recording|Start viva|Start/i }),
		).toBeInTheDocument();
	});
});
