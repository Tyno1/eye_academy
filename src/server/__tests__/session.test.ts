import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerFnMock } from "#/test/mock-server-fn";

const getCookie = vi.fn();
const setCookie = vi.fn();
const deleteCookie = vi.fn();
const readSessionCookie = vi.fn();
const mintSessionCookie = vi.fn();

vi.mock("@tanstack/react-start", () => createServerFnMock());

vi.mock("@tanstack/react-start/server", () => ({
	getCookie: (...args: unknown[]) => getCookie(...args),
	setCookie: (...args: unknown[]) => setCookie(...args),
	deleteCookie: (...args: unknown[]) => deleteCookie(...args),
}));

vi.mock("#/server/firebaseAdmin", () => ({
	readSessionCookie: (...args: unknown[]) => readSessionCookie(...args),
	mintSessionCookie: (...args: unknown[]) => mintSessionCookie(...args),
}));

describe("session", () => {
	beforeEach(() => {
		getCookie.mockReset();
		setCookie.mockReset();
		deleteCookie.mockReset();
		readSessionCookie.mockReset();
		mintSessionCookie.mockReset();
		vi.resetModules();
	});

	it("returns null when there is no session cookie", async () => {
		getCookie.mockReturnValue(undefined);
		const { getSession } = await import("#/server/session");
		await expect(getSession()).resolves.toBeNull();
	});

	it("reads the session from the cookie", async () => {
		getCookie.mockReturnValue("cookie");
		readSessionCookie.mockResolvedValue({ uid: "u1", email: "a@b.com" });
		const { getSession } = await import("#/server/session");
		await expect(getSession()).resolves.toEqual({
			uid: "u1",
			email: "a@b.com",
		});
	});

	it("creates a session cookie from an id token", async () => {
		mintSessionCookie.mockResolvedValue({
			cookie: "session-cookie",
			maxAge: 100,
		});
		const { createSession } = await import("#/server/session");
		await createSession({ data: { idToken: "token" } });
		expect(setCookie).toHaveBeenCalledWith(
			"__session",
			"session-cookie",
			expect.objectContaining({
				httpOnly: true,
				maxAge: 100,
				path: "/",
			}),
		);
	});

	it("clears the session cookie", async () => {
		const { clearSession } = await import("#/server/session");
		await clearSession();
		expect(deleteCookie).toHaveBeenCalledWith("__session", { path: "/" });
	});

	it("establishes a session from a Firebase user", async () => {
		mintSessionCookie.mockResolvedValue({
			cookie: "session-cookie",
			maxAge: 100,
		});
		const { establishSession } = await import("#/server/session");
		const user = {
			getIdToken: vi.fn().mockResolvedValue("id-token"),
		};
		await establishSession(user as never);
		expect(user.getIdToken).toHaveBeenCalledOnce();
		expect(mintSessionCookie).toHaveBeenCalledWith("id-token");
	});
});
