import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerFnMock } from "#/test/mock-server-fn";

const requireUser = vi.fn();
const attemptDoc = {
	get: vi.fn(),
	set: vi.fn(),
};
const collectionGet = vi.fn();
const adminFirestore = vi.fn(() => ({
	collection: vi.fn(() => ({
		orderBy: vi.fn(() => ({
			get: collectionGet,
		})),
	})),
	doc: vi.fn(() => attemptDoc),
}));

vi.mock("@tanstack/react-start", () => createServerFnMock());

vi.mock("#/server/firebaseAdmin", () => ({
	requireUser: (...args: unknown[]) => requireUser(...args),
	adminFirestore: () => adminFirestore(),
}));

vi.mock("firebase-admin/firestore", () => ({
	FieldValue: {
		arrayUnion: (...items: unknown[]) => ({ __union: items }),
	},
}));

describe("tools", () => {
	const attemptId = "11111111-1111-4111-8111-111111111111";

	beforeEach(() => {
		vi.resetModules();
		requireUser.mockReset();
		attemptDoc.get.mockReset();
		attemptDoc.set.mockReset();
		collectionGet.mockReset();
		adminFirestore.mockClear();
		requireUser.mockResolvedValue({ uid: "u1", email: "a@b.com" });
	});

	it("lists attempts for the signed-in user", async () => {
		collectionGet.mockResolvedValue({
			docs: [
				{
					id: attemptId,
					data: () => ({
						status: "ended",
						createdAt: "2026-11-25T12:00:00.000Z",
						transcript: [{ role: "trainee", text: "hi" }],
					}),
				},
				{
					id: "not-a-uuid",
					data: () => ({ status: "active" }),
				},
			],
		});
		const { listAttempts } = await import("#/server/tools");
		await expect(listAttempts()).resolves.toEqual([
			{
				id: attemptId,
				status: "ended",
				createdAt: "2026-11-25T12:00:00.000Z",
				turns: 1,
			},
		]);
	});

	it("creates an empty attempt when none exists", async () => {
		attemptDoc.get.mockResolvedValue({ exists: false });
		attemptDoc.set.mockResolvedValue(undefined);
		const { loadAttempt } = await import("#/server/tools");
		await expect(loadAttempt({ data: { attemptId } })).resolves.toEqual({
			id: attemptId,
			status: "active",
			transcript: [],
			revealed: [],
			answers: [],
			revision: null,
		});
		expect(attemptDoc.set).toHaveBeenCalled();
	});

	it("loads and normalizes an existing attempt", async () => {
		attemptDoc.get.mockResolvedValue({
			exists: true,
			data: () => ({
				status: "active",
				transcript: [
					{ role: "examiner", text: "Hello", at: 2 },
					{ role: "trainee", text: "IOP?", at: 1 },
					{ role: "bad", text: "skip" },
				],
				revealed: [{ id: "iop_right", spoken: "Right IOP is 58." }],
				answers: ["acute angle closure"],
				revision: {
					point: "Treat both eyes",
					page: 3,
					excerpt: "both eyes",
				},
			}),
		});
		const { loadAttempt } = await import("#/server/tools");
		const attempt = await loadAttempt({ data: { attemptId } });
		expect(attempt.transcript.map((line) => line.text)).toEqual([
			"IOP?",
			"Hello",
		]);
		expect(attempt.revealed).toEqual([
			{ id: "iop_right", spoken: "Right IOP is 58." },
		]);
		expect(attempt.revision?.page).toBe(3);
	});

	it("looks up a finding and stores the spoken reply", async () => {
		attemptDoc.set.mockResolvedValue(undefined);
		const { getFinding } = await import("#/server/tools");
		const result = await getFinding({
			data: {
				attemptId,
				query: "intraocular pressure",
				said: "right intraocular pressure",
				at: 100,
			},
		});
		expect(result.available).toBe(true);
		expect(result.spoken).toContain("58 mmHg");
		expect(attemptDoc.set).toHaveBeenCalled();
	});

	it("records a plan answer and returns a follow-up", async () => {
		attemptDoc.get.mockResolvedValue({
			data: () => ({ transcript: [] }),
		});
		attemptDoc.set.mockResolvedValue(undefined);
		const { recordAnswer } = await import("#/server/tools");
		const result = await recordAnswer({
			data: {
				attemptId,
				text: "Acute angle closure, treat with iridotomy",
				stage: "plan",
			},
		});
		expect(result).toEqual({
			saved: true,
			spoken: "Why treat the left eye as well?",
		});
	});

	it("ends the viva on the follow-up answer", async () => {
		attemptDoc.get.mockResolvedValue({
			data: () => ({ transcript: [] }),
		});
		attemptDoc.set.mockResolvedValue(undefined);
		const { recordAnswer } = await import("#/server/tools");
		const result = await recordAnswer({
			data: {
				attemptId,
				text: "Because the left angle is at risk",
				stage: "answer",
			},
		});
		expect(result.spoken).toBe("The viva is complete.");
		expect(attemptDoc.set).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "ended",
			}),
			{ merge: true },
		);
	});

	it("marks an attempt as ended", async () => {
		attemptDoc.set.mockResolvedValue(undefined);
		const { endViva } = await import("#/server/tools");
		await expect(endViva({ data: { attemptId } })).resolves.toEqual({
			status: "ended",
		});
	});
});
