import { beforeEach, describe, expect, it, vi } from "vitest";

const getApps = vi.fn(() => []);
const initializeApp = vi.fn();
const cert = vi.fn((value: unknown) => value);
const createSessionCookie = vi.fn();
const verifySessionCookie = vi.fn();
const getFirestore = vi.fn(() => ({ name: "firestore" }));
const getCookie = vi.fn();

vi.mock("firebase-admin/app", () => ({
	getApps: () => getApps(),
	initializeApp: (...args: unknown[]) => initializeApp(...args),
	cert: (value: unknown) => cert(value),
}));

vi.mock("firebase-admin/auth", () => ({
	getAuth: () => ({
		createSessionCookie: (...args: unknown[]) => createSessionCookie(...args),
		verifySessionCookie: (...args: unknown[]) => verifySessionCookie(...args),
	}),
}));

vi.mock("firebase-admin/firestore", () => ({
	getFirestore: () => getFirestore(),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getCookie: (...args: unknown[]) => getCookie(...args),
}));

vi.mock("#/server/session", () => ({
	SESSION_COOKIE: "__session",
}));

describe("firebaseAdmin", () => {
	beforeEach(() => {
		vi.resetModules();
		getApps.mockReturnValue([]);
		initializeApp.mockReset();
		createSessionCookie.mockReset();
		verifySessionCookie.mockReset();
		getCookie.mockReset();
		process.env.FIREBASE_PROJECT_ID = "eye-academy-88034";
		process.env.FIREBASE_CLIENT_EMAIL = "admin@example.com";
		process.env.FIREBASE_PRIVATE_KEY = "line1\\nline2";
	});

	it("throws when admin env vars are missing", async () => {
		delete process.env.FIREBASE_PRIVATE_KEY;
		const { adminFirestore } = await import("#/server/firebaseAdmin");
		expect(() => adminFirestore()).toThrow(/Firebase Admin is not configured/);
	});

	it("mints a session cookie", async () => {
		createSessionCookie.mockResolvedValue("cookie-value");
		const { mintSessionCookie } = await import("#/server/firebaseAdmin");
		await expect(mintSessionCookie("id-token")).resolves.toEqual({
			cookie: "cookie-value",
			maxAge: 5 * 24 * 60 * 60,
		});
		expect(createSessionCookie).toHaveBeenCalledWith("id-token", {
			expiresIn: 5 * 24 * 60 * 60 * 1000,
		});
	});

	it("maps mint failures to a session error", async () => {
		createSessionCookie.mockRejectedValue(new Error("bad token"));
		const { mintSessionCookie } = await import("#/server/firebaseAdmin");
		await expect(mintSessionCookie("id-token")).rejects.toThrow(
			"Could not start the session.",
		);
	});

	it("reads a valid session cookie", async () => {
		verifySessionCookie.mockResolvedValue({
			uid: "u1",
			email: "a@b.com",
		});
		const { readSessionCookie } = await import("#/server/firebaseAdmin");
		await expect(readSessionCookie("cookie")).resolves.toEqual({
			uid: "u1",
			email: "a@b.com",
		});
	});

	it("returns null for an invalid session cookie", async () => {
		verifySessionCookie.mockRejectedValue(new Error("expired"));
		const { readSessionCookie } = await import("#/server/firebaseAdmin");
		await expect(readSessionCookie("cookie")).resolves.toBeNull();
	});

	it("requires a signed-in user", async () => {
		getCookie.mockReturnValue("cookie");
		verifySessionCookie.mockResolvedValue({ uid: "u1", email: null });
		const { requireUser } = await import("#/server/firebaseAdmin");
		await expect(requireUser()).resolves.toEqual({ uid: "u1", email: null });
	});

	it("rejects when the session cookie is missing", async () => {
		getCookie.mockReturnValue(undefined);
		const { requireUser } = await import("#/server/firebaseAdmin");
		await expect(requireUser()).rejects.toThrow("Sign in required.");
	});
});
