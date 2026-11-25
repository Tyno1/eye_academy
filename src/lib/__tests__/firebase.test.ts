import { beforeEach, describe, expect, it, vi } from "vitest";

const initializeApp = vi.fn((_config?: unknown) => ({ name: "app" }));
const getAuth = vi.fn((_app?: unknown) => ({ name: "auth" }));

vi.mock("firebase/app", () => ({
	initializeApp: (config?: unknown) => initializeApp(config),
}));

vi.mock("firebase/auth", () => ({
	getAuth: (app?: unknown) => getAuth(app),
}));

describe("firebase", () => {
	beforeEach(() => {
		initializeApp.mockClear();
		getAuth.mockClear();
		vi.resetModules();
	});

	it("initializes the web app and exports auth", async () => {
		const mod = await import("#/lib/firebase");
		expect(initializeApp).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "eye-academy-88034",
			}),
		);
		expect(getAuth).toHaveBeenCalledWith({ name: "app" });
		expect(mod.auth).toEqual({ name: "auth" });
	});
});
