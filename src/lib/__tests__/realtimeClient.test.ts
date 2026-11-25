import { beforeEach, describe, expect, it, vi } from "vitest";

const mintSession = vi.fn();

vi.mock("#/server/realtime", () => ({
	mintSession: (...args: unknown[]) => mintSession(...args),
}));

vi.mock("#/server/tools", () => ({
	endViva: vi.fn(),
	getFinding: vi.fn(),
	recordAnswer: vi.fn(),
	recordUtterance: vi.fn(),
}));

describe("connectViva", () => {
	beforeEach(() => {
		mintSession.mockReset();
		document.body.innerHTML = "";
		vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
	});

	it("removes the audio element when minting the session fails", async () => {
		mintSession.mockRejectedValue(new Error("Set OPENAI_API_KEY"));
		const { connectViva } = await import("#/lib/realtimeClient");

		await expect(
			connectViva({
				attemptId: "11111111-1111-1111-1111-111111111111",
				onLine: vi.fn(),
				onState: vi.fn(),
			}),
		).rejects.toThrow("Set OPENAI_API_KEY");

		expect(document.body.querySelector("audio")).toBeNull();
	});
});
