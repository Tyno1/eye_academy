import { describe, expect, it, vi } from "vitest";

const createTanStackRouter = vi.fn((options: unknown) => ({
	options,
	name: "router",
}));

vi.mock("@tanstack/react-router", () => ({
	createRouter: (options: unknown) => createTanStackRouter(options),
}));

vi.mock("../routeTree.gen", () => ({
	routeTree: { id: "route-tree" },
}));

describe("getRouter", () => {
	it("creates the app router with the generated route tree", async () => {
		const { getRouter } = await import("#/router");
		const router = getRouter();
		expect(createTanStackRouter).toHaveBeenCalledWith(
			expect.objectContaining({
				routeTree: { id: "route-tree" },
				scrollRestoration: true,
				defaultPreload: "intent",
			}),
		);
		expect(router).toEqual(
			expect.objectContaining({
				name: "router",
			}),
		);
	});
});
