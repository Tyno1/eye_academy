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
			data: () => ({ answers: ["zzzz qqqq xxxx"] }),
		});
		const { revisionPoint } = await import("#/server/revision");
		await expect(revisionPoint({ data: { attemptId } })).resolves.toEqual({
			point:
				"The reference note does not support a revision point for that answer.",
			page: null,
			excerpt: null,
			retrievedPages: [],
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
		const { retrievedPages, ...revision } = result;
		expect(retrievedPages).toContain(3);
		expect(attemptDoc.set).toHaveBeenCalledWith(
			{ revision, retrievedPages },
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
		await expect(revisionPoint({ data: { attemptId } })).resolves.toMatchObject(
			{
				point:
					"The reference note does not support a revision point for that answer.",
				page: null,
				excerpt: null,
			},
		);
		expect(attemptDoc.set).not.toHaveBeenCalled();
	});

	it("accepts an excerpt that wraps across lines in the PDF text", async () => {
		attemptDoc.get.mockResolvedValue({
			data: () => ({ answers: ["laser iridotomy fellow eye prophylactic"] }),
		});
		attemptDoc.set.mockResolvedValue(undefined);
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								point: "Treat the fellow eye with a prophylactic iridotomy.",
								page: 6,
								excerpt:
									"without treatment around 40 to 50% of fellow eyes have an attack within 5 to 10 years",
							}),
						},
					},
				],
			}),
		});
		const { revisionPoint } = await import("#/server/revision");
		const result = await revisionPoint({ data: { attemptId } });
		expect(result.page).toBe(6);
		expect(result.retrievedPages).toContain(6);
	});

	it("files the cinema and chlorphenamine trigger under page 4", async () => {
		const chunks = (await import("../../../data/note_chunks.json"))
			.default as Array<{ page: number; text: string }>;
		const hits = chunks
			.filter((chunk) => chunk.text.includes("chlorphenamine"))
			.map((chunk) => chunk.page);
		expect(hits).toEqual([4]);
	});
});
