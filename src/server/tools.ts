import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const attemptId = z.uuid();

export type AttemptLine = {
	id: string;
	role: "trainee" | "examiner";
	text: string;
	at?: number;
};
export type RevealedFinding = { id: string; spoken: string };
export type AttemptRevision = {
	point: string;
	page: number;
	excerpt: string;
} | null;

export type AttemptView = {
	id: string;
	status: "active" | "ended";
	transcript: AttemptLine[];
	revealed: RevealedFinding[];
	answers: string[];
	revision: AttemptRevision;
};

export type AttemptSummary = {
	id: string;
	status: "active" | "ended";
	createdAt: string | null;
	turns: number;
};

export const listAttempts = createServerFn({ method: "GET" }).handler(
	async (): Promise<AttemptSummary[]> => {
		const { requireUser, adminFirestore } = await import(
			"#/server/firebaseAdmin"
		);
		const user = await requireUser();
		const snap = await adminFirestore()
			.collection(`users/${user.uid}/attempts`)
			.orderBy("createdAt", "desc")
			.get();
		return snap.docs.flatMap((doc) => {
			if (!attemptId.safeParse(doc.id).success) return [];
			const data = doc.data();
			return [
				{
					id: doc.id,
					status: data.status === "ended" ? ("ended" as const) : "active",
					createdAt: typeof data.createdAt === "string" ? data.createdAt : null,
					turns: Array.isArray(data.transcript) ? data.transcript.length : 0,
				},
			];
		});
	},
);

export const loadAttempt = createServerFn({ method: "POST" })
	.validator(z.object({ attemptId }))
	.handler(async ({ data }): Promise<AttemptView> => {
		const { requireUser, adminFirestore } = await import(
			"#/server/firebaseAdmin"
		);
		const user = await requireUser();
		const ref = attemptRef(adminFirestore(), user.uid, data.attemptId);
		const snap = await ref.get();
		if (!snap.exists) {
			await ref.set({
				status: "active",
				transcript: [],
				revealed: [],
				answers: [],
				revision: null,
				createdAt: new Date().toISOString(),
			});
			return emptyAttempt(data.attemptId);
		}
		return view(data.attemptId, snap.data() ?? {});
	});

export const getFinding = createServerFn({ method: "POST" })
	.validator(
		z.object({
			attemptId,
			query: z.string().min(1),
			said: z.string().optional(),
			at: z.number().int().positive().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const { requireUser, adminFirestore } = await import(
			"#/server/firebaseAdmin"
		);
		const { lookupFinding } = await import("#/case/findings");
		const user = await requireUser();
		const match = lookupFinding(data.query, data.said);
		const { FieldValue } = await import("firebase-admin/firestore");
		const ref = attemptRef(adminFirestore(), user.uid, data.attemptId);
		await ref.set(
			{
				transcript: FieldValue.arrayUnion({
					id: "",
					role: "examiner",
					text: match.spoken,
					at: data.at ?? Date.now(),
				}),
				...(match.kind === "finding"
					? {
							revealed: FieldValue.arrayUnion(
								...(match.findings ?? [match.finding]).map((item) => ({
									id: item.id,
									spoken: match.spoken,
								})),
							),
						}
					: {}),
			},
			{ merge: true },
		);
		return { spoken: match.spoken, available: match.kind === "finding" };
	});

export const recordUtterance = createServerFn({ method: "POST" })
	.validator(
		z.object({
			attemptId,
			role: z.enum(["trainee", "examiner"]),
			text: z.string().min(1),
			at: z.number().int().positive().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const { requireUser, adminFirestore } = await import(
			"#/server/firebaseAdmin"
		);
		const user = await requireUser();
		const { FieldValue } = await import("firebase-admin/firestore");
		const ref = attemptRef(adminFirestore(), user.uid, data.attemptId);
		await ref.set(
			{
				transcript: FieldValue.arrayUnion({
					id: "",
					role: data.role,
					text: data.text,
					at: data.at ?? Date.now(),
				}),
			},
			{ merge: true },
		);
		return { saved: true };
	});

export const recordAnswer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			attemptId,
			text: z.string().min(1),
			stage: z.enum(["plan", "answer"]),
		}),
	)
	.handler(async ({ data }) => {
		const { requireUser, adminFirestore } = await import(
			"#/server/firebaseAdmin"
		);
		const { followUpFor } = await import("#/case/findings");
		const user = await requireUser();
		const { FieldValue } = await import("firebase-admin/firestore");
		const ref = attemptRef(adminFirestore(), user.uid, data.attemptId);
		const snap = await ref.get();
		const existing = snap.data()?.transcript;
		const already = Array.isArray(existing)
			? existing.some((item: unknown) => {
					if (!item || typeof item !== "object") return false;
					const line = item as { role?: unknown; text?: unknown };
					return line.role === "trainee" && line.text === data.text;
				})
			: false;
		const spoken =
			data.stage === "answer"
				? "The viva is complete."
				: followUpFor(data.text);
		await ref.set(
			{
				answers: FieldValue.arrayUnion(data.text),
				...(data.stage === "answer" ? { status: "ended" as const } : {}),
				...(already
					? {}
					: {
							transcript: FieldValue.arrayUnion({
								id: "",
								role: "trainee",
								text: data.text,
								at: Date.now(),
							}),
						}),
			},
			{ merge: true },
		);
		return { saved: true, spoken };
	});

export const endViva = createServerFn({ method: "POST" })
	.validator(z.object({ attemptId }))
	.handler(async ({ data }) => {
		const { requireUser, adminFirestore } = await import(
			"#/server/firebaseAdmin"
		);
		const user = await requireUser();
		await attemptRef(adminFirestore(), user.uid, data.attemptId).set(
			{ status: "ended" },
			{ merge: true },
		);
		return { status: "ended" as const };
	});

function attemptRef(
	db: ReturnType<typeof import("firebase-admin/firestore").getFirestore>,
	uid: string,
	id: string,
) {
	return db.doc(`users/${uid}/attempts/${id}`);
}

function emptyAttempt(id: string): AttemptView {
	return {
		id,
		status: "active",
		transcript: [],
		revealed: [],
		answers: [],
		revision: null,
	};
}

function view(id: string, data: FirebaseData): AttemptView {
	const status = data.status === "ended" ? "ended" : "active";
	return {
		id,
		status,
		transcript: lineList(data.transcript),
		revealed: revealedList(data.revealed),
		answers: stringList(data.answers),
		revision: revisionValue(data.revision),
	};
}

type FirebaseData = {
	status?: unknown;
	transcript?: unknown;
	revealed?: unknown;
	answers?: unknown;
	revision?: unknown;
};

function lineList(value: unknown): AttemptLine[] {
	if (!Array.isArray(value)) return [];
	const lines: AttemptLine[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const line = item as { role?: unknown; text?: unknown; at?: unknown };
		if (
			(line.role !== "trainee" && line.role !== "examiner") ||
			typeof line.text !== "string"
		) {
			continue;
		}
		lines.push({
			id: "",
			role: line.role,
			text: line.text,
			at: typeof line.at === "number" ? line.at : undefined,
		});
	}
	lines.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
	return lines.map((line, index) => ({
		...line,
		id: `${index}-${line.role}`,
	}));
}

function revealedList(value: unknown): RevealedFinding[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (!item || typeof item !== "object") return [];
		const finding = item as { id?: unknown; spoken?: unknown };
		if (typeof finding.id !== "string" || typeof finding.spoken !== "string") {
			return [];
		}
		return [{ id: finding.id, spoken: finding.spoken }];
	});
}

function stringList(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function revisionValue(value: unknown): AttemptRevision {
	if (!value || typeof value !== "object") return null;
	const revision = value as {
		point?: unknown;
		page?: unknown;
		excerpt?: unknown;
	};
	if (
		typeof revision.point !== "string" ||
		typeof revision.page !== "number" ||
		typeof revision.excerpt !== "string"
	) {
		return null;
	}
	return {
		point: revision.point,
		page: revision.page,
		excerpt: revision.excerpt,
	};
}
