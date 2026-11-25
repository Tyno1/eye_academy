import { describe, expect, it } from "vitest";
import { authSearch, safePath } from "#/lib/auth-search";

describe("authSearch", () => {
	it("keeps a string redirect", () => {
		expect(authSearch({ redirect: "/viva" })).toEqual({ redirect: "/viva" });
	});

	it("drops non-string redirects", () => {
		expect(authSearch({ redirect: 12 })).toEqual({ redirect: undefined });
		expect(authSearch({})).toEqual({ redirect: undefined });
	});
});

describe("safePath", () => {
	it("allows same-origin paths", () => {
		expect(safePath("/viva")).toBe("/viva");
		expect(safePath("/viva?x=1")).toBe("/viva?x=1");
	});

	it("rejects open redirects and auth loops", () => {
		expect(safePath(undefined)).toBe("/");
		expect(safePath("https://evil.test")).toBe("/");
		expect(safePath("//evil.test")).toBe("/");
		expect(safePath("/\\evil")).toBe("/");
		expect(safePath("/login")).toBe("/");
		expect(safePath("/register")).toBe("/");
		expect(safePath("viva")).toBe("/");
	});
});
