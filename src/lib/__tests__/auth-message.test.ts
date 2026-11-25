import { FirebaseError } from "firebase/app";
import { describe, expect, it } from "vitest";
import { authMessage } from "#/lib/auth-message";

describe("authMessage", () => {
	it("maps known Firebase auth codes", () => {
		expect(
			authMessage(
				new FirebaseError("auth/invalid-credential", "bad"),
				"fallback",
			),
		).toBe("Email or password is incorrect.");
		expect(
			authMessage(
				new FirebaseError("auth/email-already-in-use", "taken"),
				"fallback",
			),
		).toBe("That email is already registered.");
	});

	it("returns the fallback for unknown Firebase codes", () => {
		expect(
			authMessage(new FirebaseError("auth/something-else", "x"), "fallback"),
		).toBe("fallback");
	});

	it("passes through Firebase Admin configuration errors", () => {
		expect(
			authMessage(
				new Error("Firebase Admin is not configured. Set keys."),
				"fallback",
			),
		).toBe("Firebase Admin is not configured. Set keys.");
		expect(
			authMessage(new Error("Could not start the session."), "fallback"),
		).toBe("Could not start the session.");
	});

	it("returns the fallback for plain errors", () => {
		expect(authMessage(new Error("nope"), "Could not sign in.")).toBe(
			"Could not sign in.",
		);
		expect(authMessage("string", "fallback")).toBe("fallback");
	});
});
