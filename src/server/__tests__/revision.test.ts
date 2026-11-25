import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerFnMock } from "#/test/mock-server-fn";

const requireUser = vi.fn();
const attemptDoc = {
	get: vi.fn(),
	set: vi.fn(),
};
const adminFirestore = vi.fn(() => ({
	doc: vi.fn(() => attemptDoc),
}));
const fetchMock = vi.fn();

vi.mock("@tanstack/react-start", () => createServerFnMock());

vi.mock("#/server/firebaseAdmin", () => ({
	requireUser: (...args: unknown[]) => requireUser(...args),
	adminFirestore: () => adminFirestore(),
}));

describe("revision", () => {
	const attemptId = "11111111-1111-4111-8111-111111111111";
	const originalFetch = globalThis.fetch;
	const originalKey = process.env.OPENAI_API_KEY;

	beforeEach(() => {
		vi.resetModules();
		requireUser.mockReset();
		attemptDoc.get.mockReset();
		attemptDoc.set.mockReset();
		fetchMock.mockReset();
		requireUser.mockResolvedValue({ uid: "u1", email: null });
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		process.env.OPENAI_API_KEY = "test-key";
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = originalKey;
	});

	it("returns a refusal when no note pages match", async () => {
		attemptDoc.get.mockResolvedValue({
			data: () => ({ answers: ["zzzz not in note"] }),
		});
		const { revisionPoint } = await import("#/server/revision");
		await expect(revisionPoint({ data: { attemptId } })).resolves.toEqual({
			point:
				"The reference note does not support a revision point for that answer.",
			page: null,
			excerpt: null,
		});
	});

	it("stores a cited revision point", async () => {
		attemptDoc.get.mockResolvedValue({
			data: () => ({
				answers: ["acute primary angle closure iridotomy"],
			}),
		});
		attemptDoc.set.mockResolvedValue(undefined);
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								point: "Treat the fellow eye as well.",
								page: 3,
								excerpt: "Primary angle closure suspect",
							}),
						},
					},
				],
			}),
		});

		const { revisionPoint } = await import("#/server/revision");
		const result = await revisionPoint({ data: { attemptId } });

		expect(result.page).toBe(3);
		expect(result.point).toBe("Treat the fellow eye as well.");
		expect(result.excerpt).toContain("Primary angle closure suspect");
		expect(attemptDoc.set).toHaveBeenCalledWith(
			{ revision: result },
			{ merge: true },
		);
	});

	it("rejects a drafted excerpt that is not on the cited page", async () => {
		attemptDoc.get.mockResolvedValue({
			data: () => ({
				answers: ["acute primary angle closure iridotomy"],
			}),
		});
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								point: "Invented point",
								page: 1,
								excerpt: "this text is not on the page",
							}),
						},
					},
				],
			}),
		});

		const { revisionPoint } = await import("#/server/revision");
		await expect(revisionPoint({ data: { attemptId } })).resolves.toEqual({
			point:
				"The reference note does not support a revision point for that answer.",
			page: null,
			excerpt: null,
		});
		expect(attemptDoc.set).not.toHaveBeenCalled();
	});
});
