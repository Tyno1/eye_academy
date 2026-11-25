import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerFnMock } from "#/test/mock-server-fn";

const requireUser = vi.fn();
const fetchMock = vi.fn();

vi.mock("@tanstack/react-start", () => createServerFnMock());

vi.mock("#/server/firebaseAdmin", () => ({
	requireUser: (...args: unknown[]) => requireUser(...args),
}));

describe("realtime", () => {
	const originalFetch = globalThis.fetch;
	const originalKey = process.env.OPENAI_API_KEY;

	beforeEach(() => {
		vi.resetModules();
		requireUser.mockReset();
		fetchMock.mockReset();
		requireUser.mockResolvedValue({ uid: "user-1", email: null });
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		process.env.OPENAI_API_KEY = "test-key";
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = originalKey;
	});

	it("throws when OPENAI_API_KEY is missing", async () => {
		delete process.env.OPENAI_API_KEY;
		const { mintSession } = await import("#/server/realtime");
		await expect(
			mintSession({ data: { attemptId: "a1" } }),
		).rejects.toThrow("Set OPENAI_API_KEY to start the viva voice.");
	});

	it("returns a client secret from OpenAI", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ value: "secret-value" }),
		});
		const { mintSession } = await import("#/server/realtime");
		await expect(mintSession({ data: { attemptId: "a1" } })).resolves.toEqual({
			value: "secret-value",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.openai.com/v1/realtime/client_secrets",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer test-key",
				}),
			}),
		);
	});

	it("throws when OpenAI rejects the request", async () => {
		fetchMock.mockResolvedValue({ ok: false });
		const { mintSession } = await import("#/server/realtime");
		await expect(mintSession({ data: { attemptId: "a1" } })).rejects.toThrow(
			"Could not start the voice session.",
		);
	});
});
