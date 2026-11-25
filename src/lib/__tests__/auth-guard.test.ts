import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((value: unknown) => {
	const error = new Error("redirect");
	Object.assign(error, value);
	throw error;
});

vi.mock("@tanstack/react-router", () => ({
	redirect: (value: unknown) => redirect(value),
}));

describe("auth-guard", () => {
	beforeEach(() => {
		redirect.mockClear();
	});

	it("does nothing when signed out of an auth page", async () => {
		const { redirectIfSignedIn } = await import("#/lib/auth-guard");
		expect(() => redirectIfSignedIn(null, {})).not.toThrow();
		expect(redirect).not.toHaveBeenCalled();
	});

	it("redirects signed-in users away from auth pages", async () => {
		const { redirectIfSignedIn } = await import("#/lib/auth-guard");
		expect(() =>
			redirectIfSignedIn(
				{ uid: "u1", email: "a@b.com" },
				{ redirect: "/viva" },
			),
		).toThrow();
		expect(redirect).toHaveBeenCalledWith({
			href: "/viva",
			replace: true,
		});
	});

	it("does nothing when a session exists for an authed route", async () => {
		const { redirectIfSignedOut } = await import("#/lib/auth-guard");
		expect(() =>
			redirectIfSignedOut({ uid: "u1", email: null }, "/viva"),
		).not.toThrow();
		expect(redirect).not.toHaveBeenCalled();
	});

	it("sends signed-out users to login with a safe redirect", async () => {
		const { redirectIfSignedOut } = await import("#/lib/auth-guard");
		expect(() => redirectIfSignedOut(null, "/viva/abc")).toThrow();
		expect(redirect).toHaveBeenCalledWith({
			to: "/login",
			search: { redirect: "/viva/abc" },
			replace: true,
		});
	});
});
